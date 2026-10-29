import { createRequire } from 'node:module';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from './serve.mjs';
import { ANIMATION_CONFIG as config } from '../js/animation-config.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const viewport = { width: config.stage.width, height: config.stage.height };
const output = process.env.ARTIFACT_DIR || '.artifacts/preview';
const video = process.argv.includes('--video');
const fps = 30;
const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
let browser, encoder;
try {
  browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-lcd-text'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => window.__VIDEO_EXPORT_REQUEST__ = {});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => !!window.__VIDEO_EXPORT__);
  await page.evaluate(options => window.__VIDEO_EXPORT__.prepare(options), { viewport, output: viewport, deviceScaleFactor: 1, fps });
  await mkdir(output, { recursive: true });
  const { bridge, board, hold } = config.timing;
  const assembled = bridge.start + bridge.enter;
  const split = assembled + bridge.pause;
  const times = new Set([0, bridge.start / 2, bridge.start, assembled, split,
    split + bridge.exit / 2, board.start, board.start + board.duration / 2,
    hold.start, hold.start + hold.duration / 2, config.stage.duration]);
  for (const timeMs of [...times].sort((a, b) => a - b)) {
    await page.evaluate(timeMs => window.__VIDEO_EXPORT__.renderFrame({ timeMs }), timeMs);
    await page.screenshot({ path: path.join(output, `frame-${Number(timeMs.toFixed(3))}.png`) });
  }
  if (video) {
    encoder = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'HeroShow-preview.mp4')], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let encoderErrors = '';
    encoder.stderr.on('data', chunk => encoderErrors += chunk);
    const completion = once(encoder, 'close');
    const frameCount = Math.ceil(config.stage.duration * fps / 1000);
    for (let index = 0; index < frameCount; index++) {
      await page.evaluate(timeMs => window.__VIDEO_EXPORT__.renderFrame({ timeMs }), index * 1000 / fps);
      const jpeg = await page.screenshot({ type: 'jpeg', quality: 90 });
      if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, 'drain');
      if (index % 60 === 0) console.log(`预览渲染 ${index}/${frameCount}`);
    }
    encoder.stdin.end();
    const [code] = await completion;
    if (code !== 0) throw new Error(encoderErrors);
  }
  await writeFile(path.join(output, 'preview-check.json'), JSON.stringify({ errors, video, fps, duration: config.stage.duration }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`预览完成：${output}`);
} finally {
  if (encoder && encoder.exitCode === null) encoder.kill();
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
