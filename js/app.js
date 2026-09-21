'use strict';

import { ANIMATION_CONFIG } from './animation-config.js';
import { createAnimation } from './animation.js';
import { createPlayer } from './player.js';
import { createControls } from './controls.js';

const element = id => document.getElementById(id);
const app = element('app');
const stage = element('stage');
const viewport = element('viewport');
const animation = createAnimation(ANIMATION_CONFIG);
let controls;

// 按可用窗口空间等比缩放动画舞台，并为控制栏预留空间。
function resize() {
 const style = getComputedStyle(app);
 const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
 const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
 const controlsHeight = controls?.enabled && !document.fullscreenElement
  ? element('controls').getBoundingClientRect().height + parseFloat(style.gap || 0)
  : 0;
 const scale = Math.max(
  .01,
  Math.min(
   (app.clientWidth - paddingX) / ANIMATION_CONFIG.stage.width,
   (app.clientHeight - paddingY - controlsHeight) / ANIMATION_CONFIG.stage.height
  )
 );

 viewport.style.width = ANIMATION_CONFIG.stage.width * scale + 'px';
 viewport.style.height = ANIMATION_CONFIG.stage.height * scale + 'px';
 stage.style.transform = `scale(${scale})`;
}

const player = createPlayer({
 duration: animation.duration,
 render: animation.render,
 onUpdate: position => controls?.syncPosition(position),
 onPlayingChange: playing => controls?.syncPlaying(playing)
});

controls = createControls({ player, config: ANIMATION_CONFIG, resize });
player.initialize();
controls.syncPosition(0);
controls.syncPlaying(false);

window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(element('controls'));
resize();

// 保留原有对外控制接口，供演示环境或自动化工具调用。
window.pptAnimation = {
 play: player.play,
 pause: player.pause,
 replay: player.replay,
 seek: player.seek,
 get currentTime() { return player.currentTime; },
 get duration() { return player.duration; }
};

// 等待自定义字体和图片资源完成解码后再显示并播放动画。
const fontReady = Promise.all([
 document.fonts.load('900 76px MatchTitle', '月度最佳选手二阶堂亚树'),
 document.fonts.load('800 228px MatchScore', '+105.9 PT')
]);

Promise.allSettled([
 ...[...document.images].map(image => image.decode()),
 fontReady
]).then(results => {
 player.setReady(true);
 stage.classList.add('ready');
 resize();
 controls.enable();

 if (results.some(result => result.status === 'rejected')) {
  element('status').textContent = '部分素材加载失败，请完整解压并保留 assets 文件夹。';
 }
 player.replay();
});
