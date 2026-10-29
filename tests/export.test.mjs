import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "../scripts/serve.mjs";
import { ANIMATION_CONFIG as config } from "../js/animation-config.js";
import { SHOW_CONFIG } from "../config/show.js";

const require = createRequire(import.meta.url);
// 可复用已安装的 Playwright，运行时网页本身没有任何第三方依赖。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const options = {
  fps: 60,
  viewport: { width: 1920, height: 1080 },
  output: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  seed: 12345,
};
const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
const frame = (index) => ({
  index,
  timeMs: (index * 1000) / 60,
  deltaMs: index === 0 ? 0 : 1000 / 60,
});
const frameCount = Math.ceil(config.stage.duration * 60 / 1000);
const { bridge, board, hold } = config.timing;
const assembledAt = bridge.start + bridge.enter;
const splitAt = assembledAt + bridge.pause;
const bridgeEnd = bridge.start + bridge.duration;

test(
  "队伍模板：真实 Chromium 逐帧、画面稳定性、预览和素材复用",
  { timeout: 240000 },
  async (t) => {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const browser = await chromium.launch({
      headless: true,
      // 固定软件绘制路径，避免不同 GPU 合成批次造成文字边缘 1–2 级色差。
      args: ["--disable-gpu", "--disable-lcd-text"],
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const errors = [];
    async function open({ exporting = true, dpr = 1, route } = {}) {
      const page = await browser.newPage({
        viewport: options.viewport,
        deviceScaleFactor: dpr,
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      if (exporting)
        await page.addInitScript(
          (opts) =>
            Object.defineProperty(window, "__VIDEO_EXPORT_REQUEST__", {
              value: Object.freeze(opts),
              writable: false,
            }),
          options,
        );
      if (route) await route(page);
      await page.goto(base);
      await page.waitForFunction(() => !!window.__VIDEO_EXPORT__);
      return page;
    }
    async function prepare(page, overrides = {}) {
      await page.evaluate(
        async (opts) => {
          await window.__VIDEO_EXPORT__.prepare(opts);
          await window.__VIDEO_EXPORT__.reset();
        },
        { ...options, ...overrides },
      );
    }
    async function render(page, index) {
      await page.evaluate(
        (f) => window.__VIDEO_EXPORT__.renderFrame(f),
        frame(index),
      );
    }
    const captures = new Map();
    async function hash(page) {
      const buffer = await page.screenshot({ animations: "allow" });
      const value = digest(buffer);
      captures.set(value, buffer);
      return value;
    }
    let page;
    try {
      page = await open();
      await t.test(
        "启动即禁用自动播放；元数据不要求 prepare；原有主文案保留",
        async () => {
          const manifest = await page.evaluate(() =>
            window.__VIDEO_EXPORT__.getManifest(),
          );
          assert.deepEqual(manifest, {
            name: "角川樱花骑士 · 九月队伍积分冠军",
            durationMs: config.stage.duration,
            recommendedViewport: { width: 1920, height: 1080 },
            supportsSeeking: true,
          });
          await page.waitForFunction(() =>
            document.getElementById("stage").classList.contains("ready"),
          );
          await page.waitForTimeout(120);
          assert.equal(
            await page.evaluate(() => window.pptAnimation.currentTime),
            0,
          );
          assert.deepEqual(
            await page.evaluate(() => ["eyebrow", "team-name", "score-caption", "score-number", "score-unit"].map((id) => document.getElementById(id).textContent)),
            ["九月队伍积分冠军", "角川樱花骑士", "月间队伍得分", "+197.2", "PT"],
          );
          assert.equal(await page.locator("#controls").isVisible(), false);
        },
      );
      await prepare(page);
      await t.test("指标区独立分色，队徽区域为正方形且无旗子，转场无队标", async () => {
        await render(page, Math.ceil(hold.start * 60 / 1000));
        assert.equal(await page.locator(".metric").count(), 4);
        assert.deepEqual(await page.locator(".metric-label").allTextContents(), ["月间顺位统计", "平均顺位", "一位率", "避四率"]);
        assert.deepEqual(await page.locator(".metric-number").allTextContents(), ["6-2-2-2", "2.00", "50.00%", "83.33%"]);
        const pink = "rgb(239, 146, 174)", white = "rgb(255, 255, 255)";
        assert.deepEqual(await page.locator(".metric-number").evaluateAll((elements) => elements.map((element) => [...element.children].map((glyph) => getComputedStyle(glyph).color))), [
          [pink, white, white, white, white, white, white],
          [white, white, white, white],
          [white, white, white, white, white, pink],
          [white, white, white, white, white, pink],
        ], "逐字符核对：首位次数和百分号为粉色，平均顺位、分隔符与小数点为白色");
        assert.deepEqual(await page.locator(".metric-label").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).color)), Array(4).fill(white), "四项标签为白色");
        assert.deepEqual(await page.locator(".metric-suffix").allTextContents(), ["%", "%"]);
        assert.deepEqual(await page.locator(".metric-unit").allTextContents(), Array(4).fill(""));
        assert.ok(await page.evaluate(() => [...document.querySelectorAll(".metric")].every((cell) => cell.querySelector(".metric-value").offsetWidth <= cell.clientWidth)), "四列数据均完整容纳");
        assert.ok(await page.evaluate(() => {
          const caption = document.getElementById("score-caption");
          const score = document.getElementById("score-number").getBoundingClientRect();
          return getComputedStyle(caption).color === "rgb(0, 0, 0)" && caption.getBoundingClientRect().bottom <= score.top + 40;
        }), "纯黑得分说明紧贴积分字形上方");
        assert.equal(await page.locator("#metrics-note").isVisible(), false);
        assert.ok(await page.evaluate(() => [...document.querySelectorAll(".metric-label")].every((label) => parseFloat(getComputedStyle(label).fontSize) >= 20)), "指标标签清楚可读");
        assert.equal(await page.locator(".chassis,.spectrum,.board-grid,.photo-bracket").count(), 0);
        assert.equal(await page.locator(".instrument-cluster,.hazard,.dial,.panel-vents,.metrics-hatch").count(), 0);
        assert.ok(await page.locator("#identity").evaluate((element) => {
          const title = document.getElementById("team-name");
          return element.offsetLeft + element.offsetWidth < title.offsetLeft && element.offsetTop + element.offsetHeight < 517 && Number(getComputedStyle(element).opacity) === 1;
        }), "队徽完整实色呈现，在队名左侧占据独立位置");
        assert.equal(await page.locator(".identity-ribbon").count(), 0);
        assert.ok(await page.locator("#identity").evaluate((element) => element.offsetWidth === element.offsetHeight), "队徽容器为正方形");
        assert.ok(await page.locator("#team-logo").evaluate((element) => element.offsetWidth === element.offsetHeight && getComputedStyle(element).objectFit === "contain"), "队徽素材在正方形内完整等比显示");
        assert.equal(await page.locator("#team-logo").evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a), 0.84, "队徽保留四周留白");
        assert.deepEqual(await page.evaluate(() => ["#eyebrow", "#score-unit", ".metric-unit", ".metric:nth-child(3) .metric-suffix", ".metric:nth-child(4) .metric-suffix"].map((selector) => getComputedStyle(document.querySelector(selector)).color)), Array(5).fill("rgb(239, 146, 174)"), "强调色、百分号与单位统一使用队徽原始粉色");
        assert.equal(await page.locator("#bridge img,#bridge-emblem,#bridge-logo").count(), 0);
        assert.ok(await page.evaluate(() => getComputedStyle(document.getElementById("metrics-panel")).backgroundColor !== getComputedStyle(document.getElementById("board")).backgroundColor), "数据区底色与主画面不同");
        assert.ok(await page.evaluate(() => [...document.querySelectorAll("#stage *")].every((element) => ["Top", "Right", "Bottom", "Left"].every((side) => parseFloat(getComputedStyle(element)[`border${side}Width`]) === 0))), "画布内没有框线");
      });
      await t.test("开场移除全部合影，仅队名半入画到半出画匀速左移", async () => {
        assert.equal(await page.locator("#reveal img,#intro-portrait,#reveal-portrait").count(), 0);
        const states = [];
        assert.ok(Math.abs(config.timing.introText.duration - 633 * 0.7) < 0.000001);
        for (const rate of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
          const timeMs = config.timing.introText.duration * rate;
          await page.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({timeMs}), timeMs);
          states.push(await page.evaluate(() => {
            const name = document.getElementById("reveal-name").getBoundingClientRect();
            return { left: name.left, right: name.right };
          }));
        }
        const width = states[0].right - states[0].left;
        assert.ok(Math.abs((1920 - states[0].left) / width - 0.5) < 0.005, "起点约半行位于画面内");
        assert.ok(Math.abs(states.at(-1).right / width - 0.5) < 0.03, "终点约半行位于画面内");
        for (let index = 1; index < states.length; index++) {
          assert.ok(states[index].left < states[index - 1].left, "文字连续向左，不循环回卷");
        }
        const speed = states[1].left - states[0].left;
        const lastSpeed = states.at(-1).left - states.at(-2).left;
        assert.ok(Math.abs(speed - lastSpeed) < 0.001, "文字尾段不减速");
        const slices = [];
        for (const timeMs of [assembledAt - 50, assembledAt, assembledAt + 60, splitAt, splitAt + 100]) {
          await page.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({timeMs}), timeMs);
          slices.push(await page.locator(".wipe-slice").evaluateAll((elements) => elements.map((element) => new DOMMatrix(getComputedStyle(element).transform).f)));
        }
        for (let index = 0; index < 5; index++) {
          assert.ok(slices.slice(1, 4).every((row) => row[index] === 0), "拼合后全片归零，短暂停顿期间保持固定");
          assert.ok(slices[0][index] * slices.at(-1)[index] < 0, "每片穿过拼合位置，从另一侧退出");
        }
      });
      await t.test("斜切转场位于中间，结尾保持冠军展示，阅读期前景固定", async () => {
        for (const [timeMs, visible] of [[0, ["reveal"]], [bridge.start - 0.1, ["reveal"]], [bridge.start, ["reveal", "bridge"]], [assembledAt, ["reveal", "bridge"]], [splitAt - 0.1, ["reveal", "bridge"]], [splitAt, ["board", "bridge"]], [bridgeEnd - 0.1, ["board", "bridge"]], [bridgeEnd, ["board"]], [hold.start, ["board"]], [config.stage.duration, ["board"]]]) {
          await page.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({timeMs}), timeMs);
          assert.deepEqual(await page.evaluate(() => ["board", "reveal", "bridge"].filter((id) => getComputedStyle(document.getElementById(id)).visibility === "visible")), visible, `场景边界 ${timeMs}`);
        }
        // 在遮挡中点强行切换底层场景，像素应完全不变，避免拼合时漏出硬切。
        await page.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({timeMs}), splitAt);
        const covered = await hash(page);
        await page.evaluate(() => {
          document.getElementById("reveal").style.visibility = "visible";
          document.getElementById("board").style.visibility = "hidden";
        });
        assert.equal(await hash(page), covered, "拼合时五片完整覆盖画面");
        const foreground = () => page.evaluate(() => [...document.querySelectorAll("#photo-panel,#portrait-reveal,#portrait-motion,#team-name,#score-caption,#score-row,#score-unit,#identity,#team-logo,#header,#eyebrow,.name-glyph,.metric-body")].map((element) => element.getAttribute("style")));
        assert.equal(board.start, bridgeEnd, "冠军入场起点等于亮场转接完全结束时刻");
        for (const key of ["panel", "identity", "label", "portrait", "name", "score", "unit", "metrics"]) {
          assert.ok(config.timing[key].start >= bridgeEnd, `${key} 入场不得早于转场结束`);
        }
        await page.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({timeMs}), splitAt);
        const waiting = await foreground();
        for (const timeMs of [splitAt + 100, bridgeEnd - 0.1, bridgeEnd]) {
          await page.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({timeMs}), timeMs);
          assert.deepEqual(await foreground(), waiting, "转场退出期间冠军元素保持初始状态");
        }
        await page.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({timeMs}), bridgeEnd + 120);
        assert.notDeepEqual(await foreground(), waiting, "转场结束后才开始冠军入场");
        await page.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({timeMs}), hold.start);
        const start = await foreground();
        await render(page, 240);
        assert.deepEqual(await foreground(), start, "阅读阶段前景没有漂移");
        await page.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({timeMs}), config.stage.duration);
        assert.deepEqual(await foreground(), start, "到位后整段五秒内前景保持稳定");
        assert.equal(config.stage.duration - config.timing.hold.start, 5000);
        assert.equal(config.timing.hold.duration, 5000);
        assert.equal(config.timing.board.start + config.timing.board.duration, config.timing.hold.start);
        assert.equal(await page.locator("#outro").count(), 0, "片尾独立收尾段已删除");
        assert.equal(await page.locator("#bridge .wipe-slice").count(), 5, "原片尾斜片移到中场");
        assert.equal(await page.locator("#bridge").isVisible(), false, "结束时不再出现转场");
      });
      const samples = [
        0, 8, 24, 26, 27, 37, 38, 46, 47, 50, 53, 54, 60, 72, 73, 74, 91, 92, 96, 144, 240, 330, frameCount - 1,
      ];
      const hashes = new Map();
      await t.test(
        "60 fps 顺序渲染两遍；三段关键帧像素一致",
        async () => {
          for (let pass = 0; pass < 2; pass++) {
            await page.evaluate(() => window.__VIDEO_EXPORT__.reset());
            for (let index = 0; index < frameCount; index++) {
              await render(page, index);
              if (samples.includes(index)) {
                const value = await hash(page);
                if (pass === 0) hashes.set(index, value);
                else
                  assert.equal(
                    value,
                    hashes.get(index),
                    `重复渲染第 ${index} 帧`,
                  );
              }
            }
          }
          assert.notEqual(
            hashes.get(144),
            hashes.get(240),
            "展示背景仍有轻微动效",
          );
        },
      );
      await t.test(
        "三个场景任意乱序 seek 与顺序渲染一致",
        async () => {
          for (const index of [frameCount - 1, 24, 96, 0, 38, 47, 50, 53, 54, 60, 72, 73, 74, 330]) {
            await page.evaluate(() => window.__VIDEO_EXPORT__.reset());
            await render(page, index);
            const actual = await hash(page);
            if (actual !== hashes.get(index) && process.env.ARTIFACT_DIR) {
              await mkdir(process.env.ARTIFACT_DIR, { recursive: true });
              await writeFile(path.join(process.env.ARTIFACT_DIR, `seek-${index}-actual.png`), captures.get(actual));
              await writeFile(path.join(process.env.ARTIFACT_DIR, `seek-${index}-expected.png`), captures.get(hashes.get(index)));
            }
            assert.equal(
              actual,
              hashes.get(index),
              `直接跳转第 ${index} 帧`,
            );
          }
          await render(page, 96);
          const start = await hash(page);
          await render(page, 240);
          await render(page, 96);
          assert.equal(await hash(page), start, "同一时间点的背景不受 seek 历史影响");
        },
      );
      await t.test("返回后不随真实时间、按键、旧预览接口改变画面", async () => {
        await render(page, 72);
        const before = await hash(page);
        await page.waitForTimeout(180);
        await page.keyboard.press("Space");
        await page.keyboard.press("r");
        await page.keyboard.press("ArrowRight");
        await page.evaluate(() => {
          window.pptAnimation.play();
          window.pptAnimation.replay();
          window.pptAnimation.seek(0);
        });
        await page.waitForTimeout(600);
        assert.equal(await hash(page), before);
        assert.equal(await page.locator("#controls").isVisible(), false);
        assert.equal(
          await page.evaluate(
            () =>
              document.getAnimations().filter((a) => a.playState === "running")
                .length,
          ),
          0,
        );
      });
      await t.test("1080p 无滚动条或文字溢出；4K 实际像素加倍", async () => {
        await render(page, 144);
        assert.equal(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth === innerWidth &&
              document.documentElement.scrollHeight === innerHeight,
          ),
          true,
        );
        assert.equal(
          await page.evaluate(
            () =>
              document.getElementById("score-row").offsetWidth <=
              document.getElementById("score-panel").clientWidth,
          ),
          true,
        );
        const high = await open({ dpr: 2 });
        try {
          await prepare(high, {
            output: { width: 3840, height: 2160 },
            deviceScaleFactor: 2,
          });
          await render(high, 144);
          const png = await high.screenshot({ animations: "allow" });
          assert.equal(png.readUInt32BE(16), 3840);
          assert.equal(png.readUInt32BE(20), 2160);
          if (process.env.ARTIFACT_DIR) {
            await mkdir(process.env.ARTIFACT_DIR, { recursive: true });
            await high.screenshot({
              path: path.join(process.env.ARTIFACT_DIR, "frame-4k.png"),
            });
          }
        } finally {
          await high.close();
        }
      });
      await t.test(
        "替换长队名、长积分与图片构图，不需要修改 HTML",
        async () => {
          const alternate = await open({
            route: async (target) => {
              await target.route("**/config/show.js", async (route) => {
                const response = await route.fetch();
                let body = await response.text();
                body = body
                  .replace(
                    /(["'])角川樱花骑士\1/,
                    JSON.stringify("这是一个用于测试的较长队伍名称"),
                  )
                  .replace(/(["'])\+197\.2\1/, JSON.stringify("-1234567.8"))
                  .replace("x: 0, y: 0, scale: 1", "x: -15, y: 9, scale: 0.92");
                await route.fulfill({ response, body });
              });
            },
          });
          try {
            await prepare(alternate);
            await render(alternate, 144);
            assert.equal(
              await alternate.locator("#team-name").textContent(),
              "这是一个用于测试的较长队伍名称",
            );
            assert.equal(
              await alternate.evaluate(() => {
                const title = document.getElementById("team-name");
                return (
                  [...title.children].every(
                    (row) =>
                      [...row.children].reduce(
                        (sum, g) => sum + g.offsetWidth,
                        0,
                      ) <=
                      title.clientWidth + 2,
                  ) &&
                  document.getElementById("score-row").offsetWidth <=
                    document.getElementById("score-panel").clientWidth + 2
                );
              }),
              true,
            );
          } finally {
            await alternate.close();
          }
        },
      );
      await t.test("图片/字体缺失必须使 prepare 失败", async () => {
        for (const resource of [
          "**/assets/images/player.png",
          "**/assets/fonts/title-black.ttf",
        ]) {
          const broken = await open({
            route: (target) => target.route(resource, (route) => route.abort()),
          });
          try {
            await assert.rejects(() => prepare(broken));
          } finally {
            await broken.close();
          }
        }
      });
      await t.test("仅更改配置即可替换全部文字、数据、颜色和素材路径", async () => {
        const custom = structuredClone(SHOW_CONFIG);
        Object.assign(custom.content, {
          label: "十月月报", teamName: "复用测试\n这是替换后的新名称", scoreLabel: "累计得分",
          score: "-1234.5", unit: "PTS", metricsNote: "配置复用测试",
          metrics: [
            { label: "统计", value: "3-1-0-2", format: "placements", columns: 2, spacing: 0.25, colors: { first: "#00ff00" } },
            { label: "通过率", value: "91.2%", colors: { suffix: "dataInk" } },
            { label: "场次", value: 6, unit: "场", characterColors: ["#ff0000"] },
            { label: "新增指标", value: "88" },
            { label: "更多数据", value: "12" },
          ],
        });
        for (const key of ["portrait", "logo", "background", "grain"])
          custom.assets[key] = `assets/images/reuse-${key}.svg`;
        custom.assets.favicon = "assets/images/reuse-logo.svg";
        custom.assets.fonts.title.src = "assets/fonts/reuse-title.ttf";
        custom.assets.fonts.score.src = "assets/fonts/reuse-score.ttf";
        custom.theme.accent = "#3399FF";
        custom.theme.dataInk = "#FFCC00";
        custom.motion.hold = 1700;
        const requested = new Set();
        const alternate = await open({ route: async (target) => {
          await target.route("**/config/show.js", (route) => route.fulfill({
            contentType: "text/javascript", body: `export const SHOW_CONFIG = ${JSON.stringify(custom)};`,
          }));
          await target.route("**/assets/images/reuse-*.svg", (route) => {
            requested.add(new URL(route.request().url()).pathname);
            return route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="600"><rect width="300" height="600" fill="#3399ff"/></svg>' });
          });
          await target.route("**/assets/fonts/reuse-*.ttf", async (route) => {
            requested.add(new URL(route.request().url()).pathname);
            const file = route.request().url().includes("reuse-title") ? "title-black.ttf" : "score-extrabold.ttf";
            const response = await route.fetch({ url: `${base}/assets/fonts/${file}` });
            await route.fulfill({ response });
          });
        }});
        try {
          await prepare(alternate);
          const manifest = await alternate.evaluate(() => window.__VIDEO_EXPORT__.getManifest());
          await alternate.evaluate((timeMs) => window.__VIDEO_EXPORT__.renderFrame({ timeMs }), manifest.durationMs - 100);
          assert.equal(await alternate.locator("#eyebrow").textContent(), custom.content.label);
          assert.equal(await alternate.locator("#team-name").textContent(), custom.content.teamName.replace(/\n/g, ""));
          assert.deepEqual(await alternate.locator(".name-line").allTextContents(), custom.content.teamName.split("\n"));
          assert.equal(await alternate.locator("#score-caption").textContent(), "累计得分");
          assert.equal(await alternate.locator("#score-number").textContent(), "-1234.5");
          assert.equal(await alternate.locator("#score-unit").textContent(), "PTS");
          assert.equal(await alternate.locator("#metrics-note").textContent(), "配置复用测试");
          assert.deepEqual(await alternate.locator(".metric-number").allTextContents(), ["3-1-0-2", "91.2%", "6", "88", "12"]);
          assert.equal(await alternate.locator(".metric-accent").first().evaluate((e) => getComputedStyle(e).color), "rgb(0, 255, 0)");
          assert.equal(await alternate.locator(".metric-suffix").evaluate((e) => getComputedStyle(e).color), "rgb(255, 204, 0)");
          assert.equal(await alternate.locator(".metric:nth-child(3) .metric-digit").evaluate((e) => getComputedStyle(e).color), "rgb(255, 0, 0)");
          for (const resource of [custom.assets.portrait, custom.assets.logo, custom.assets.background, custom.assets.grain, custom.assets.fonts.title.src, custom.assets.fonts.score.src])
            assert.ok(requested.has(`/${resource}`), `加载配置中的资源 ${resource}`);
          assert.ok(await alternate.evaluate(() => [...document.querySelectorAll(".metric")].every((cell) => cell.querySelector(".metric-value").scrollWidth <= cell.clientWidth)), "新增指标不会溢出列宽");
        } finally { await alternate.close(); }
      });
      await t.test("空资源和空指标可隐藏，空字体可使用系统字体", async () => {
        const custom = structuredClone(SHOW_CONFIG);
        for (const key of ["portrait", "logo", "background", "grain", "favicon"]) custom.assets[key] = "";
        custom.assets.fonts = {};
        custom.content.metrics = [];
        custom.content.scoreLabel = "";
        custom.content.unit = "";
        const alternate = await open({ route: (target) => target.route("**/config/show.js", (route) => route.fulfill({
          contentType: "text/javascript", body: `export const SHOW_CONFIG = ${JSON.stringify(custom)};`,
        })) });
        try {
          await prepare(alternate);
          await alternate.evaluate(() => window.__VIDEO_EXPORT__.renderFrame({ timeMs: 3000 }));
          for (const id of ["identity", "portrait-reveal", "metrics-panel", "score-unit"])
            assert.equal(await alternate.locator(`#${id}`).isVisible(), false, `${id} 隐藏`);
          assert.equal(await alternate.locator("#stage img[src]").count(), 0);
          assert.equal(await alternate.locator(".score-caption-mask").isVisible(), false);
          assert.equal(await alternate.locator(".instrument-field").first().evaluate((e) => getComputedStyle(e).backgroundImage), "none");
        } finally { await alternate.close(); }
      });
      await t.test(
        "普通预览会播放、暂停、重播、阶段定位，并循环完整镜头",
        async () => {
          const normal = await open({ exporting: false });
          try {
            await normal.waitForFunction(
              () => window.pptAnimation.currentTime > 20,
            );
            await normal.keyboard.press("Space");
            assert.equal(await normal.locator("#controls").isVisible(), true);
            await normal.getByRole("button", { name: "暂停动画" }).click();
            const paused = await normal.evaluate(
              () => window.pptAnimation.currentTime,
            );
            await normal.waitForTimeout(80);
            assert.equal(
              await normal.evaluate(() => window.pptAnimation.currentTime),
              paused,
            );
            await normal.keyboard.press("Tab");
            await normal.locator("body").click({ position: { x: 3, y: 3 } });
            await normal.keyboard.press("Space");
            await normal.evaluate((duration) => {
              window.pptAnimation.seek(duration - 50);
              window.pptAnimation.play();
            }, config.stage.duration);
            await normal.waitForFunction(
              () =>
                window.pptAnimation.currentTime >= 0 &&
                window.pptAnimation.currentTime < 600,
            );
            await normal.keyboard.press("r");
            assert.ok(
              await normal.evaluate(
                () => window.pptAnimation.currentTime < 600,
              ),
            );
            await normal.setViewportSize({ width: 390, height: 844 });
            assert.equal(
              await normal.evaluate(
                () => document.documentElement.scrollWidth === innerWidth,
              ),
              true,
            );
          } finally {
            await normal.close();
          }
        },
      );
      await t.test(
        "dispose 支持未 prepare、重复释放，以及资源加载途中释放",
        async () => {
          const metadata = await open();
          await metadata.evaluate(() => {
            window.__VIDEO_EXPORT__.getManifest();
            window.__VIDEO_EXPORT__.dispose();
            window.__VIDEO_EXPORT__.dispose();
          });
          await metadata.close();
          const early = await open({
            route: async (target) =>
              target.route("**/assets/fonts/title-black.ttf", async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 150));
                await route.continue();
              }),
          });
          await early.evaluate(() => window.__VIDEO_EXPORT__.dispose());
          await early.waitForTimeout(250);
          assert.equal(
            await early.evaluate(() => window.pptAnimation.currentTime),
            0,
          );
          await early.close();
        },
      );
      assert.deepEqual(errors, [], "无未捕获脚本错误");
    } finally {
      if (page) await page.close();
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  },
);
