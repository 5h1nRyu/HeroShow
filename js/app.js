 'use strict';

 // ===== 基础配置 =====
 const W = 1280, H = 720, INTRO_DURATION = 500, REVEAL_DURATION = 2400;
 const DURATION = INTRO_DURATION + REVEAL_DURATION;

 // 动画时间表，单位为毫秒；集中修改这里即可调整各阶段节奏。
 const MOTION = {
  field: { start: 0, duration: 600 }, reveal: { start: 70, duration: 470 },
  portrait: { start: 200, duration: 900 }, texture: { start: 340, duration: 1300 },
  logo: { start: 350, duration: 650 },
  label: { start: 950, duration: 380 }, name: { start: 1070, duration: 350, stagger: 30 },
  rule: { start: 1300, duration: 320 }, score: { start: 1450, duration: 520 },
  unit: { start: 1530, duration: 420 }, settle: { start: 2050, duration: 350 }
 };

 // 三组贝塞尔缓动曲线，分别用于移动、揭示和强调动画。
 const CURVES = { travel: [.25, .1, .25, 1], reveal: [.16, 1, .3, 1], impact: [.4, 0, .2, 1] };
 const clamp = t => Math.max(0, Math.min(1, t));

 function bezier(t, [x1, y1, x2, y2]) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const at = (u, a, b) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
  let lo = 0, hi = 1;

  for (let i = 0; i < 20; i++) {
   const m = (lo + hi) / 2;
   if (at(m, x1, x2) < t) lo = m;
   else hi = m;
  }
  return at((lo + hi) / 2, y1, y2);
 }

 const $ = id => document.getElementById(id);
 const app = $('app'), stage = $('stage'), viewport = $('viewport');
 const nameChars = [...$('player-name').children];

 // 播放状态。position 表示当前毫秒位置，rate 表示播放倍速。
 let position = 0, playing = false, rate = 1, lastFrame = null, frame = 0, ready = false;
 let controlsEnabled = false;

 // 根据时间位置更新所有动画图层的样式。
 function render(ms) {
  position = Math.max(0, Math.min(DURATION, Number(ms) || 0));
  const introActive = position < INTRO_DURATION;
  $('intro').style.display = introActive ? 'block' : 'none';
  $('reveal-scene').style.display = introActive ? 'none' : 'block';

  if (introActive) {
   const introMotion = (c, curve = CURVES.reveal) => bezier(
           clamp((position - c.start) / c.duration), curve
   );
   const portraitIn = introMotion({ start: 0, duration: 360 }, CURVES.travel);
   const portraitScale = introMotion({ start: 170, duration: 310 }, CURVES.impact);
   $('intro-portrait-wrap').style.transform =
           `translate3d(${-1080 * (1 - portraitIn)}px,0,0) scale(${.9 + .12 * portraitScale})`;

   // 三段式位移：快速入场，经过正中时放缓，结尾刚开始再次加速。
   let titleX;
   if (position < 205) {
    const p = bezier(position / 205, CURVES.travel);
    titleX = 1370 + (470 - 1370) * p;
   } else if (position < 430) {
    const p = bezier((position - 205) / 225, [.22, .7, .3, 1]);
    titleX = 470 + (255 - 470) * p;
   } else {
    const p = bezier((position - 430) / 70, [.55, 0, 1, .45]);
    titleX = 255 - 100 * p;
   }
   $('intro-title').style.transform = `translate3d(${titleX}px,-50%,0)`;
  }

  const revealPosition = Math.max(0, position - INTRO_DURATION);
  const motion = (c, curve = CURVES.reveal) => bezier(
          clamp((revealPosition - c.start) / c.duration), curve
  );

  const field = motion(MOTION.field, CURVES.travel);
  $('red-plane').style.transform = `translate3d(${(1 - field) * 900}px,0,0)`;
  $('red-edge').style.transform = `translate3d(${(1 - field) * 920}px,0,0)`;

  const reveal = motion(MOTION.reveal, CURVES.travel), cut = 1410 - reveal * 1650;
  $('portrait-reveal').style.clipPath =
          `polygon(${cut + 110}px 0,1500px 0,1500px 900px,${cut - 110}px 900px)`;

  const portrait = motion(MOTION.portrait, CURVES.travel);
  $('portrait-travel').style.transform = `translate3d(${-64 * (1 - portrait)}px,${-12 * (1 - portrait)}px,0)`;
  $('portrait-zoom').style.transform = `scale(${1 + .34 * (1 - portrait)})`;

  const texture = motion(MOTION.texture, CURVES.travel);
  $('texture-wrap').style.opacity = .55 * texture;
  $('texture-wrap').style.transform = `translate3d(${45 * (1 - texture)}px,0,0)`;

  $('team-mark').style.opacity = .09 * motion(MOTION.logo);

  const label = motion(MOTION.label);
  $('eyebrow').style.opacity = label;
  $('eyebrow').style.transform = `translate3d(0,${16 * (1 - label)}px,0)`;

  nameChars.forEach((el, i) => {
   const timing = { start: MOTION.name.start + i * MOTION.name.stagger, duration: MOTION.name.duration };
   const p = motion(timing);
   el.style.transform = `translate3d(0,${90 * (1 - p)}px,0)`;
   el.style.opacity = clamp(((revealPosition - timing.start) / timing.duration) * 3);
  });

  $('name-rule').style.transform = `scaleX(${motion(MOTION.rule)})`;

  const score = motion(MOTION.score, CURVES.impact);
  $('score-row').style.transform = `translate3d(0,${68 * (1 - score)}px,0) scale(${1 + .08 * (1 - score)})`;
  $('score-row').style.opacity = clamp(((revealPosition - MOTION.score.start) / MOTION.score.duration) * 3.5);

  const unit = motion(MOTION.unit);
  $('score-unit').style.opacity = clamp(((revealPosition - MOTION.unit.start) / MOTION.unit.duration) * 2.5);
  $('score-unit').style.transform = `translate3d(${18 * (1 - unit)}px,0,0)`;

  const settle = motion(MOTION.settle);
  $('foot-rule').style.opacity = .24 * settle;
  $('foot-rule').style.transform = `scaleX(${settle})`;

  $('seek').value = position;
  $('time').value = `${(position / 1000).toFixed(2)} / 2.90 秒`;
  $('seek').setAttribute('aria-valuetext', `${(position / 1000).toFixed(2)} 秒`);
 }

 // 按可用窗口空间等比缩放 1280 × 720 舞台。
 function resize() {
  const style = getComputedStyle(app);
  const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const controls = controlsEnabled && !document.fullscreenElement
          ? $('controls').getBoundingClientRect().height + parseFloat(style.gap || 0)
          : 0;
  const scale = Math.max(
          .01,
          Math.min((app.clientWidth - paddingX) / W, (app.clientHeight - paddingY - controls) / H)
  );

  viewport.style.width = W * scale + 'px';
  viewport.style.height = H * scale + 'px';
  stage.style.transform = `scale(${scale})`;
 }

 // 同步播放按钮的文字和无障碍标签。
 function buttonState() {
  $('play').textContent = playing ? '暂停' : '播放';
  $('play').setAttribute('aria-label', playing ? '暂停动画' : '播放动画');
 }

 // requestAnimationFrame 主循环。
 function tick(now) {
  if (!playing) return;
  if (document.hidden) {
   lastFrame = null;
   frame = requestAnimationFrame(tick);
   return;
  }

  if (lastFrame !== null) render(position + (now - lastFrame) * rate);
  lastFrame = now;

  if (position >= DURATION) {
   if (!controlsEnabled) {
    render(0);
    lastFrame = now;
    frame = requestAnimationFrame(tick);
    return;
   }
   playing = false;
   lastFrame = null;
   buttonState();
   return;
  }
  frame = requestAnimationFrame(tick);
 }

 // 暂停播放并清理当前帧状态。
 function pause() {
  playing = false;
  cancelAnimationFrame(frame);
  lastFrame = null;
  buttonState();
 }

 // 开始播放；restart 为 true 时从头播放。
 function play(restart = false) {
  if (!ready) return;
  pause();
  if (restart || position >= DURATION) render(0);
  playing = true;
  buttonState();
  frame = requestAnimationFrame(tick);
 }

 // ===== 控件事件 =====
 $('play').addEventListener('click', () => playing ? pause() : play());
 $('replay').addEventListener('click', () => play(true));
 $('seek').addEventListener('input', e => { pause(); render(Number(e.target.value)); buttonState(); });
 $('speed').addEventListener('change', e => { rate = Number(e.target.value); lastFrame = null; });

 // 切换浏览器全屏状态。
 async function fullscreen() {
  try {
   if (document.fullscreenElement) await document.exitFullscreen();
   else if (app.requestFullscreen) await app.requestFullscreen();
   else $('status').textContent = '当前浏览器不支持全屏';
  } catch {
   $('status').textContent = '当前浏览器未允许全屏';
  }
 }

 $('full').addEventListener('click', fullscreen);
 document.addEventListener('fullscreenchange', () => {
  $('full').textContent = document.fullscreenElement ? '退出全屏' : '全屏';
  resize();
 });

 // 空格键在展示模式与播放控制模式之间切换。
 function toggleControls() {
  controlsEnabled = !controlsEnabled;
  app.classList.toggle('controls-enabled', controlsEnabled);
  $('controls').setAttribute('aria-hidden', String(!controlsEnabled));
  resize();
  if (!controlsEnabled) play();
  $('status').textContent = controlsEnabled ? '已进入播放控制模式' : '已进入循环展示模式';
 }

 // 键盘快捷键：空格切换模式，R 重播，F 全屏，方向键微调进度。
 document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
   e.preventDefault();
   toggleControls();
   return;
  }

  if (/INPUT|SELECT|BUTTON/.test(e.target.tagName)) return;

  if (e.key.toLowerCase() === 'r') {
   play(true);
  } else if (e.key.toLowerCase() === 'f') {
   fullscreen();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
   e.preventDefault();
   pause();
   render(position + (e.key === 'ArrowRight' ? 100 : -100));
   buttonState();
  }
 });

 // 页面切到后台时重置帧时间，避免切回页面后动画瞬间跳帧。
 document.addEventListener('visibilitychange', () => { lastFrame = null; });
 window.addEventListener('resize', resize);
 new ResizeObserver(resize).observe($('controls'));

 // 对外控制接口，时间单位为毫秒：播放、暂停、重播和跳转进度。
 window.pptAnimation = {
  play: () => play(),
  pause,
  replay: () => play(true),
  seek: ms => { pause(); render(Number(ms) || 0); buttonState(); },
  get currentTime() { return position; },
  get duration() { return DURATION; }
 };

 // ===== 初始化 =====
 render(0);
 resize();
 $('controls').setAttribute('aria-hidden', 'true');
 $('play').disabled = true;
 $('replay').disabled = true;
 $('seek').disabled = true;

 // 等待自定义字体和图片资源完成解码后再开始动画。
 const fontReady = Promise.all([
  document.fonts.load('900 76px MatchTitle', '月度最佳选手二阶堂亚树'),
  document.fonts.load('800 228px MatchScore', '+105.9 PT')
 ]);

 Promise.allSettled([
  ...[...document.images].map(im => im.decode()),
  fontReady
 ]).then(results => {
  ready = true;
  stage.classList.add('ready');
  resize();
  $('play').disabled = false;
  $('replay').disabled = false;
  $('seek').disabled = false;

  if (results.some(result => result.status === 'rejected')) {
   $('status').textContent = '部分素材加载失败，请完整解压并保留 assets 文件夹。';
  }
  play(true);
 });
