'use strict';

// 管理播放时间轴；画面细节由传入的 render 函数负责。
export function createPlayer({ duration, render, onUpdate, onPlayingChange }) {
 let position = 0;
 let playing = false;
 let rate = 1;
 let lastFrame = null;
 let frame = 0;
 let ready = false;
 let loop = true;

 function draw(ms) {
  position = render(ms);
  onUpdate(position);
 }

 function notifyPlaying() {
  onPlayingChange(playing);
 }

 function tick(now) {
  if (!playing) return;
  if (document.hidden) {
   lastFrame = null;
   frame = requestAnimationFrame(tick);
   return;
  }

  if (lastFrame !== null) draw(position + (now - lastFrame) * rate);
  lastFrame = now;

  if (position >= duration) {
   if (loop) {
    draw(0);
    lastFrame = now;
    frame = requestAnimationFrame(tick);
    return;
   }
   playing = false;
   lastFrame = null;
   notifyPlaying();
   return;
  }
  frame = requestAnimationFrame(tick);
 }

 function pause() {
  playing = false;
  cancelAnimationFrame(frame);
  lastFrame = null;
  notifyPlaying();
 }

 function play(restart = false) {
  if (!ready) return;
  pause();
  if (restart || position >= duration) draw(0);
  playing = true;
  notifyPlaying();
  frame = requestAnimationFrame(tick);
 }

 function seek(ms) {
  pause();
  draw(ms);
 }

 document.addEventListener('visibilitychange', () => { lastFrame = null; });

 return {
  initialize() { draw(0); },
  setReady(value) { ready = value; },
  setLoop(value) { loop = value; },
  setRate(value) { rate = Number(value); lastFrame = null; },
  play,
  pause,
  replay: () => play(true),
  seek,
  get currentTime() { return position; },
  get duration() { return duration; },
  get playing() { return playing; }
 };
}
