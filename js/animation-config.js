'use strict';

// 动画制作相关参数统一放在这里；时间单位为毫秒，距离单位为像素。
export const ANIMATION_CONFIG = {
 stage: {
  width: 1280, // 动画舞台的设计宽度。
  height: 720, // 动画舞台的设计高度。
  duration: 2400 // 完整动画的总时长。
 },

 timing: {
  field: { start: 0, duration: 600 }, // 红色背景和黑色边缘的入场时机与时长。
  reveal: { start: 70, duration: 470 }, // 人物斜切遮罩的揭示时机与时长。
  portrait: { start: 200, duration: 900 }, // 人物位移和缩放的开始时机与时长。
  texture: { start: 340, duration: 1300 }, // 半调纹理淡入和移动的开始时机与时长。
  logo: { start: 350, duration: 650 }, // 队徽淡入的开始时机与时长。
  label: { start: 950, duration: 380 }, // “月度最佳选手”标签的入场时机与时长。
  name: { start: 1070, duration: 350, stagger: 30 }, // 姓名首字入场时间、单字时长及逐字间隔。
  rule: { start: 1300, duration: 320 }, // 姓名下方短线的展开时机与时长。
  score: { start: 1450, duration: 520 }, // 积分数字的入场时机与时长。
  unit: { start: 1530, duration: 420 }, // 积分单位“PT”的入场时机与时长。
  settle: { start: 2050, duration: 350 } // 底部装饰线的出现时机与时长。
 },

 curves: {
  travel: [.25, .1, .25, 1], // 位移动画的三次贝塞尔缓动控制点。
  reveal: [.16, 1, .3, 1], // 淡入和揭示动画的三次贝塞尔缓动控制点。
  impact: [.4, 0, .2, 1] // 积分强调动画的三次贝塞尔缓动控制点。
 },

 effects: {
  field: {
   planeOffsetX: 900, // 红色背景入场前向右偏移的距离。
   edgeOffsetX: 920 // 黑色边缘入场前向右偏移的距离。
  },
  reveal: {
   startX: 1410, // 人物揭示斜线在动画开始时的水平位置。
   travelX: 1650, // 人物揭示斜线从右向左移动的总距离。
   bevel: 110, // 人物揭示斜线顶部与底部的水平错位量。
   boundaryX: 1500, // 人物遮罩右边界，需覆盖整个舞台。
   boundaryY: 900 // 人物遮罩下边界，需覆盖整个舞台。
  },
  portrait: {
   offsetX: -64, // 人物入场前的水平偏移；负值表示向左。
   offsetY: -12, // 人物入场前的垂直偏移；负值表示向上。
   scaleAmount: .34 // 人物入场前相对于最终尺寸额外放大的比例。
  },
  texture: {
   maxOpacity: .55, // 半调纹理完全入场后的最大透明度。
   offsetX: 45 // 半调纹理入场前向右偏移的距离。
  },
  logo: {
   maxOpacity: .09 // 队徽完全出现后的最大透明度。
  },
  label: {
   offsetY: 16 // 月度标签入场前向下偏移的距离。
  },
  name: {
   offsetY: 90, // 姓名单字入场前向下偏移的距离。
   fadeMultiplier: 3 // 姓名淡入速度倍率；越大越早达到完全不透明。
  },
  score: {
   offsetY: 68, // 积分行入场前向下偏移的距离。
   scaleAmount: .08, // 积分行入场前相对于最终尺寸额外放大的比例。
   fadeMultiplier: 3.5 // 积分数字淡入速度倍率。
  },
  unit: {
   offsetX: 18, // “PT”入场前向右偏移的距离。
   fadeMultiplier: 2.5 // “PT”淡入速度倍率。
  },
  footRule: {
   maxOpacity: .24 // 底部装饰线完全出现后的最大透明度。
  }
 },

 playback: {
  keyboardSeekStep: 100, // 左右方向键每次前进或后退的时间。
  timeDecimals: 2 // 控制栏时间显示保留的小数位数。
 }
};
