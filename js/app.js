import { ANIMATION_CONFIG as config } from "./animation-config.js";
import { createAnimation } from "./animation.js";
import { createPlayer } from "./player.js";
import { createControls } from "./controls.js";
import { applyContent } from "./content.js";
import { fitText } from "./layout.js";
import { loadResources } from "./resources.js";

// 从启动阶段识别导出标记，资源加载完成后也不可启动实时预览。
let exporting = !!window.__VIDEO_EXPORT_REQUEST__,
  disposed = false,
  prepared = false;
const element = (id) => document.getElementById(id);
const app = element("app"),
  stage = element("stage"),
  viewport = element("viewport");
if (exporting) document.documentElement.classList.add("exporting");

applyContent(config);

const animation = createAnimation(config);
let controls;
function resize() {
  if (disposed) return;
  const style = getComputedStyle(app);
  const x = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const y = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const controlHeight =
    !exporting && controls?.enabled && !document.fullscreenElement
      ? element("controls").getBoundingClientRect().height +
        parseFloat(style.gap || 0)
      : 0;
  const scale = Math.max(
    0.01,
    Math.min(
      (app.clientWidth - x) / config.stage.width,
      (app.clientHeight - y - controlHeight) / config.stage.height,
    ),
  );
  viewport.style.width = `${config.stage.width * scale}px`;
  viewport.style.height = `${config.stage.height * scale}px`;
  stage.style.transform = `scale(${scale})`;
}
const player = createPlayer({
  duration: animation.duration,
  loopStart: config.playback.loopStart,
  render: animation.render,
  onUpdate: (position) => controls?.syncPosition(position),
  onPlayingChange: (playing) => controls?.syncPlaying(playing),
});
controls = createControls({
  player,
  config,
  resize,
  isExporting: () => exporting || disposed,
});
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(app);
window.addEventListener("resize", resize);
player.initialize();
controls.syncPosition(0);
resize();

const resourcesReady = loadResources(config, stage).then(() => {
  if (!disposed) fitText(config);
});

const ensureActive = () => {
  if (disposed) throw new Error("渲染资源已释放，请重新打开页面");
};
window.__VIDEO_EXPORT__ = {
  version: 1,
  getManifest() {
    return {
      name: `${config.content.teamName} · ${config.content.label}`,
      durationMs: config.stage.duration,
      recommendedViewport: {
        width: config.stage.width,
        height: config.stage.height,
      },
      supportsSeeking: true,
    };
  },
  async prepare(options) {
    ensureActive();
    exporting = true;
    prepared = false;
    player.pause();
    controls.hide();
    document.documentElement.classList.add("exporting");
    if (
      ![
        options.viewport.width,
        options.viewport.height,
        options.output.width,
        options.output.height,
        options.deviceScaleFactor,
      ].every((n) => Number.isFinite(n) && n > 0)
    )
      throw new Error("导出尺寸无效");
    await resourcesReady;
    ensureActive();
    resize();
    stage.classList.add("ready");
    player.seek(0);
    prepared = true;
  },
  reset() {
    ensureActive();
    if (!prepared) throw new Error("请先调用 prepare");
    player.seek(0);
  },
  async renderFrame(frame) {
    ensureActive();
    if (!prepared) throw new Error("请先调用 prepare");
    if (!Number.isFinite(frame.timeMs) || frame.timeMs < 0)
      throw new Error("帧时间无效");
    // 清除上一帧的合成层栅格缓存，保证直接 seek 与顺序渲染使用同一绘制路径。
    // 两次显示切换都在本次调用内完成，不产生可见的中间空白帧。
    stage.style.display = "none";
    void stage.offsetHeight;
    player.seek(frame.timeMs);
    stage.style.display = "";
    void stage.offsetHeight;
    // 跨场景 seek 需要提交新的图层与栅格缓存；等待两次绘制机会，时间保持不变。
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  },
  dispose() {
    if (disposed) return;
    disposed = true;
    prepared = false;
    player.dispose();
    controls.dispose();
    resizeObserver.disconnect();
    window.removeEventListener("resize", resize);
  },
};

// 保留旧预览接口；导出期间拒绝预览接口改变画面。
window.pptAnimation = {
  play() {
    if (!exporting && !disposed) player.play();
  },
  pause: player.pause,
  replay() {
    if (!exporting && !disposed) player.replay();
  },
  seek(ms) {
    if (!exporting && !disposed) player.seek(ms);
  },
  get currentTime() {
    return player.currentTime;
  },
  get duration() {
    return player.duration;
  },
};
resourcesReady
  .then(() => {
    if (disposed) return;
    player.setReady(true);
    stage.classList.add("ready");
    resize();
    controls.enable();
    if (!exporting) {
      const params = new URLSearchParams(location.search);
      const position = Number(params.get("t"));
      if (params.has("t") && Number.isFinite(position)) player.seek(position);
      else player.replay();
      if (params.get("controls") === "1") controls.show();
    }
  })
  .catch((error) => {
    if (disposed) return;
    player.pause();
    element("status").textContent = `素材准备失败：${error.message}`;
    element("status").classList.add("error");
  });
