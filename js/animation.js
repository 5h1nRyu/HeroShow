'use strict';

const clamp = value => Math.max(0, Math.min(1, value));

function bezier(t, [x1, y1, x2, y2]) {
 if (t <= 0) return 0;
 if (t >= 1) return 1;

 const at = (u, a, b) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
 let lo = 0, hi = 1;

 for (let i = 0; i < 20; i++) {
  const middle = (lo + hi) / 2;
  if (at(middle, x1, x2) < t) lo = middle;
  else hi = middle;
 }
 return at((lo + hi) / 2, y1, y2);
}

// 创建只关心“指定时间画面状态”的动画渲染器，不包含任何播放控制。
export function createAnimation(config) {
 const { duration } = config.stage;
 const { timing, curves, effects } = config;
 const element = id => document.getElementById(id);
 const layers = {
  redPlane: element('red-plane'),
  redEdge: element('red-edge'),
  portraitReveal: element('portrait-reveal'),
  portraitTravel: element('portrait-travel'),
  portraitZoom: element('portrait-zoom'),
  textureWrap: element('texture-wrap'),
  teamMark: element('team-mark'),
  eyebrow: element('eyebrow'),
  nameRule: element('name-rule'),
  scoreRow: element('score-row'),
  scoreUnit: element('score-unit'),
  footRule: element('foot-rule')
 };
 const nameChars = [...element('player-name').children];

 const phase = (ms, section) => clamp((ms - section.start) / section.duration);
 const eased = (ms, section, curve = curves.reveal) => bezier(phase(ms, section), curve);

 function render(ms) {
  const position = Math.max(0, Math.min(duration, Number(ms) || 0));
  const motion = (section, curve = curves.reveal) => eased(position, section, curve);

  const field = motion(timing.field, curves.travel);
  layers.redPlane.style.transform = `translate3d(${(1 - field) * effects.field.planeOffsetX}px,0,0)`;
  layers.redEdge.style.transform = `translate3d(${(1 - field) * effects.field.edgeOffsetX}px,0,0)`;

  const reveal = motion(timing.reveal, curves.travel);
  const cut = effects.reveal.startX - reveal * effects.reveal.travelX;
  layers.portraitReveal.style.clipPath = `polygon(${cut + effects.reveal.bevel}px 0,${effects.reveal.boundaryX}px 0,${effects.reveal.boundaryX}px ${effects.reveal.boundaryY}px,${cut - effects.reveal.bevel}px ${effects.reveal.boundaryY}px)`;

  const portrait = motion(timing.portrait, curves.travel);
  layers.portraitTravel.style.transform = `translate3d(${effects.portrait.offsetX * (1 - portrait)}px,${effects.portrait.offsetY * (1 - portrait)}px,0)`;
  layers.portraitZoom.style.transform = `scale(${1 + effects.portrait.scaleAmount * (1 - portrait)})`;

  const texture = motion(timing.texture, curves.travel);
  layers.textureWrap.style.opacity = effects.texture.maxOpacity * texture;
  layers.textureWrap.style.transform = `translate3d(${effects.texture.offsetX * (1 - texture)}px,0,0)`;
  layers.teamMark.style.opacity = effects.logo.maxOpacity * motion(timing.logo);

  const label = motion(timing.label);
  layers.eyebrow.style.opacity = label;
  layers.eyebrow.style.transform = `translate3d(0,${effects.label.offsetY * (1 - label)}px,0)`;

  nameChars.forEach((character, index) => {
   const characterTiming = {
    start: timing.name.start + index * timing.name.stagger,
    duration: timing.name.duration
   };
   const progress = motion(characterTiming);
   character.style.transform = `translate3d(0,${effects.name.offsetY * (1 - progress)}px,0)`;
   character.style.opacity = clamp(phase(position, characterTiming) * effects.name.fadeMultiplier);
  });

  layers.nameRule.style.transform = `scaleX(${motion(timing.rule)})`;

  const score = motion(timing.score, curves.impact);
  layers.scoreRow.style.transform = `translate3d(0,${effects.score.offsetY * (1 - score)}px,0) scale(${1 + effects.score.scaleAmount * (1 - score)})`;
  layers.scoreRow.style.opacity = clamp(phase(position, timing.score) * effects.score.fadeMultiplier);

  const unit = motion(timing.unit);
  layers.scoreUnit.style.opacity = clamp(phase(position, timing.unit) * effects.unit.fadeMultiplier);
  layers.scoreUnit.style.transform = `translate3d(${effects.unit.offsetX * (1 - unit)}px,0,0)`;

  const settle = motion(timing.settle);
  layers.footRule.style.opacity = effects.footRule.maxOpacity * settle;
  layers.footRule.style.transform = `scaleX(${settle})`;

  return position;
 }

 return { render, duration };
}
