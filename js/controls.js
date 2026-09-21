'use strict';

// 连接播放器与页面控件，并集中处理快捷键和全屏交互。
export function createControls({ player, config, resize }) {
 const element = id => document.getElementById(id);
 const app = element('app');
 const controls = element('controls');
 const playButton = element('play');
 const replayButton = element('replay');
 const seek = element('seek');
 const speed = element('speed');
 const fullButton = element('full');
 const time = element('time');
 const status = element('status');
 let enabled = false;

 seek.max = String(config.stage.duration);

 function syncPosition(position) {
  const decimals = config.playback.timeDecimals;
  const currentSeconds = (position / 1000).toFixed(decimals);
  const durationSeconds = (config.stage.duration / 1000).toFixed(decimals);
  seek.value = position;
  time.value = `${currentSeconds} / ${durationSeconds} 秒`;
  seek.setAttribute('aria-valuetext', `${currentSeconds} 秒`);
 }

 function syncPlaying(playing) {
  playButton.textContent = playing ? '暂停' : '播放';
  playButton.setAttribute('aria-label', playing ? '暂停动画' : '播放动画');
 }

 async function fullscreen() {
  try {
   if (document.fullscreenElement) await document.exitFullscreen();
   else if (app.requestFullscreen) await app.requestFullscreen();
   else status.textContent = '当前浏览器不支持全屏';
  } catch {
   status.textContent = '当前浏览器未允许全屏';
  }
 }

 function toggle() {
  enabled = !enabled;
  app.classList.toggle('controls-enabled', enabled);
  controls.setAttribute('aria-hidden', String(!enabled));
  player.setLoop(!enabled);
  resize();
  if (!enabled) player.play();
  status.textContent = enabled ? '已进入播放控制模式' : '已进入循环展示模式';
 }

 playButton.addEventListener('click', () => player.playing ? player.pause() : player.play());
 replayButton.addEventListener('click', player.replay);
 seek.addEventListener('input', event => player.seek(Number(event.target.value)));
 speed.addEventListener('change', event => player.setRate(event.target.value));
 fullButton.addEventListener('click', fullscreen);

 document.addEventListener('fullscreenchange', () => {
  fullButton.textContent = document.fullscreenElement ? '退出全屏' : '全屏';
  resize();
 });

 document.addEventListener('keydown', event => {
  if (event.code === 'Space') {
   event.preventDefault();
   toggle();
   return;
  }
  if (/INPUT|SELECT|BUTTON/.test(event.target.tagName)) return;

  if (event.key.toLowerCase() === 'r') {
   player.replay();
  } else if (event.key.toLowerCase() === 'f') {
   fullscreen();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
   event.preventDefault();
   const direction = event.key === 'ArrowRight' ? 1 : -1;
   player.seek(player.currentTime + direction * config.playback.keyboardSeekStep);
  }
 });

 controls.setAttribute('aria-hidden', 'true');
 [playButton, replayButton, seek].forEach(control => { control.disabled = true; });

 return {
  syncPosition,
  syncPlaying,
  enable() { [playButton, replayButton, seek].forEach(control => { control.disabled = false; }); },
  get enabled() { return enabled; }
 };
}
