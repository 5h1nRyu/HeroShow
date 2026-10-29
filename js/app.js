import { ANIMATION_CONFIG as config } from "./animation-config.js";
import { createAnimation } from "./animation.js";
import { createPlayer } from "./player.js";
import { createControls } from "./controls.js";

// 从启动阶段识别导出标记，资源加载完成后也不可启动实时预览。
let exporting = !!window.__VIDEO_EXPORT_REQUEST__,
  disposed = false,
  prepared = false;
const element = (id) => document.getElementById(id);
const app = element("app"),
  stage = element("stage"),
  viewport = element("viewport");
if (exporting) document.documentElement.classList.add("exporting");

function applyContent() {
  const { content, layout, theme } = config;
  for (const key of ["paper", "ink", "muted", "panel", "accent", "pink", "data", "dataInk", "dataMuted"])
    stage.style.setProperty(`--${key}`, theme[key]);
  stage.style.width = `${config.stage.width}px`;
  stage.style.height = `${config.stage.height}px`;
  element("eyebrow").textContent = content.label;
  element("score-caption").textContent = content.scoreLabel || "";
  element("score-number").textContent = content.score;
  element("score-unit").textContent = content.unit;
  element("portrait").src = content.portrait;
  element("team-logo").src = content.logo;
  element("team-logo").style.transform = `scale(${layout.logoScale})`;
  element("portrait-motion").style.transformOrigin = layout.portrait.origin;
  const characters = Array.from(content.teamName),
    split = layout.nameBreakAfter;
  const lines =
    split > 0 && split < characters.length
      ? [characters.slice(0, split), characters.slice(split)]
      : [characters];
  element("reveal-name").textContent = content.teamName;
  element("team-name").replaceChildren(
    ...lines.map((line) => {
      const row = document.createElement("span");
      row.className = "name-line";
      row.append(
        ...line.map((character) => {
          const glyph = document.createElement("span");
          glyph.className = "name-glyph";
          glyph.textContent = character;
          return glyph;
        }),
      );
      return row;
    }),
  );
  const metrics = content.metrics || [];
  const metricsRow = element("metrics");
  const columnSpan = (data) => Math.max(1, Math.floor(Number(data.columns) || 1));
  const columnCount = metrics.reduce((sum, data) => sum + columnSpan(data), 0);
  metricsRow.style.gridTemplateColumns = `repeat(${Math.max(1, columnCount)}, minmax(0, 1fr))`;
  metricsRow.replaceChildren(...metrics.map((data) => {
    const cell = document.createElement("div");
    cell.className = "metric";
    cell.style.gridColumn = `span ${columnSpan(data)}`;
    if (data.format === "placements") cell.classList.add("metric--placements");
    const body = document.createElement("div");
    body.className = "metric-body";
    const label = document.createElement("div");
    label.className = "metric-label";
    label.textContent = data.label;
    const number = document.createElement("div");
    number.className = "metric-value";
    const value = document.createElement("span");
    value.className = "metric-number";
    const valueText = String(data.value);
    const firstSeparator = valueText.search(/[-−–]/);
    value.replaceChildren(...Array.from(valueText).map((character, index) => {
      const glyph = document.createElement("span");
      glyph.className = /[%％]/.test(character) ? "metric-suffix"
        : character === "." ? "metric-decimal"
        : /[-−–]/.test(character) ? "metric-separator" : "metric-digit";
      if (/\d/.test(character) && (data.highlight || (data.format === "placements" && (firstSeparator < 0 || index < firstSeparator))))
        glyph.classList.add("metric-accent");
      glyph.textContent = character;
      return glyph;
    }));
    const unit = document.createElement("span");
    unit.className = "metric-unit";
    unit.textContent = data.unit || "";
    number.append(value, unit);
    body.append(label, number);
    cell.append(body);
    return cell;
  }));
  element("metrics-panel").hidden = config.text.enabled === false || metrics.length === 0;
  element("metrics-note").hidden = !content.metricsArePlaceholders;
  const description = `${content.label}，${content.teamName}，${content.scoreLabel || ""} ${content.score} ${content.unit}。`;
  const metricDescription = metrics.length ? ` ${content.metricsArePlaceholders ? "以下为示例占位数据：" : ""}${metrics.map((item) => `${item.label} ${item.value}${item.unit || ""}`).join("，")}。` : "";
  viewport.setAttribute("aria-label", description + metricDescription);
  document.title = `${content.teamName} · ${content.label}`;
  document.querySelector('meta[name="description"]').content = description;
  for (const id of ["label-mask", "team-name", "score-panel", "reveal-name"])
    element(id).hidden = config.text.enabled === false;
}
applyContent();

// 使用排版尺寸测量，避开动画 transform 对测量的影响。
function fitText() {
  function fitFont(target, maximum, fits) {
    target.style.fontSize = `${maximum}px`;
    if (fits()) return;
    let low = 1,
      high = maximum;
    for (let step = 0; step < 18; step++) {
      const middle = (low + high) / 2;
      target.style.fontSize = `${middle}px`;
      if (fits()) low = middle;
      else high = middle;
    }
    target.style.fontSize = `${low * 0.998}px`;
  }
  const heading = element("team-name");
  fitFont(heading, config.layout.nameFontSize, () =>
    [...heading.children].every(
      (row) => row.scrollWidth <= heading.clientWidth && [...row.children].reduce((sum, glyph) => sum + glyph.offsetWidth, 0) <= heading.clientWidth,
    ),
  );
  fitFont(
    element("score-number"),
    config.layout.scoreFontSize,
    () =>
      element("score-row").offsetWidth <=
      element("score-panel").clientWidth - 1,
  );
  const label = element("eyebrow");
  fitFont(label, 68, () => label.scrollWidth <= label.clientWidth);
  document.querySelectorAll(".metric").forEach((cell) => {
    const value = cell.querySelector(".metric-number");
    const row = cell.querySelector(".metric-value");
    fitFont(value, 92, () => row.scrollWidth <= cell.clientWidth - 12);
    if (cell.classList.contains("metric--placements")) {
      const glyphs = [...value.children];
      const glyphWidth = glyphs.reduce((sum, glyph) => sum + parseFloat(getComputedStyle(glyph).width), 0);
      // 将原先两列宽度内均分的字间空隙减半，保持网格及后续指标位置。
      const gap = Math.max(0, value.clientWidth - glyphWidth) / Math.max(1, glyphs.length - 1) / 2;
      value.style.setProperty("--placement-gap", `${gap}px`);
    }
    const label = cell.querySelector(".metric-label");
    fitFont(label, 24, () => label.scrollWidth <= cell.clientWidth);
  });
  const introName = element("reveal-name");
  fitFont(introName, 380, () => introName.scrollWidth <= 2850);
  // 导出时会暂时移除舞台布局，提前保存文字宽度供绝对时间渲染使用。
  introName.dataset.textWidth = String(introName.scrollWidth);
}
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

const resourcesReady = (async () => {
  const fonts = await Promise.all([
    document.fonts.load(
      "900 112px MatchTitle",
      config.content.label + config.content.teamName,
    ),
    document.fonts.load(
      "800 218px MatchScore",
      config.content.score + config.content.unit + (config.content.metrics || []).map((item) => item.value + (item.unit || "")).join(""),
    ),
  ]);
  if (fonts.some((font) => font.length === 0)) throw new Error("字体加载失败");
  await Promise.all(
    [...stage.querySelectorAll("img")].map(async (image) => {
      await image.decode();
      if (!image.naturalWidth)
        throw new Error(`图片加载失败：${image.getAttribute("src")}`);
    }),
  );
  await Promise.all(["assets/images/instrument-grid.svg", "assets/images/grain.svg"].map(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
  }));
  await document.fonts.ready;
  fitText();
})();

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
