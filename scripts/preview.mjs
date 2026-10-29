import {createRequire} from 'node:module';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from './serve.mjs';
import {ANIMATION_CONFIG as config} from '../js/animation-config.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
const output=process.env.ARTIFACT_DIR || '.artifacts/v23-wide-rank-stats';
const video=process.argv.includes('--video');
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
let encoder;
try {
 await page.addInitScript(()=>window.__VIDEO_EXPORT_REQUEST__={});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>!!window.__VIDEO_EXPORT__);
 await page.evaluate(()=>window.__VIDEO_EXPORT__.prepare({viewport:{width:1920,height:1080},output:{width:1920,height:1080},deviceScaleFactor:1,fps:30}));
 await mkdir(output,{recursive:true});
 const bridge=config.timing.bridge;
 const assembledAt=bridge.start+bridge.enter;
 const splitAt=assembledAt+bridge.pause;
 for(const timeMs of [0,100,200,300,400,bridge.start,600,assembledAt-1,assembledAt,assembledAt+60,splitAt-1,splitAt,splitAt+60,1100,bridge.start+bridge.duration,1400,config.timing.hold.start,3600,config.stage.duration]){
  await page.evaluate(timeMs=>window.__VIDEO_EXPORT__.renderFrame({timeMs}),timeMs);
  await page.screenshot({path:path.join(output,`frame-${Number(timeMs.toFixed(3))}.png`)});
 }
 if(video){
  encoder=spawn(process.env.FFMPEG_PATH || 'ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-r','30','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,'HeroShow-flow-preview.mp4')],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  let encoderErrors='';encoder.stderr.on('data',b=>encoderErrors+=b);
  const completion=once(encoder,'close');
  const frameCount=Math.ceil(config.stage.duration*30/1000);
  for(let index=0;index<frameCount;index++){
   await page.evaluate(timeMs=>window.__VIDEO_EXPORT__.renderFrame({timeMs}),index*1000/30);
   const jpeg=await page.screenshot({type:'jpeg',quality:90});
   if(!encoder.stdin.write(jpeg))await once(encoder.stdin,'drain');
   if(index%60===0)console.log(`预览渲染 ${index}/${frameCount}`);
  }
  encoder.stdin.end();
  const [code]=await completion;if(code!==0)throw new Error(encoderErrors);
 }
 await writeFile(path.join(output,'preview-check.json'),JSON.stringify({errors,video,fps:30,duration:config.stage.duration},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(`预览完成：${output}`);
}finally{if(encoder && encoder.exitCode===null)encoder.kill();await browser.close();await new Promise(r=>server.close(r));}
