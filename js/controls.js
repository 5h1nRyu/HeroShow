export function createControls({ player, config, resize, isExporting }) {
  const element = (id) => document.getElementById(id);
  const app = element("app"),
    controls = element("controls");
  const abort = new AbortController();
  const on = (target, type, callback) =>
    target.addEventListener(type, callback, { signal: abort.signal });
  let enabled = false;
  element("seek").max = String(config.stage.duration);
  const chapterTimes = [0, config.timing.bridge.start, config.timing.board.start + config.timing.board.duration];
  controls.querySelectorAll("[data-chapter]").forEach((button, index) => {
    button.dataset.chapter = chapterTimes[index];
    button.querySelector("span").textContent = config.ui.chapters[index];
    button.querySelector("small").textContent = (chapterTimes[index] / 1000).toFixed(2).padStart(5, "0");
  });
  function syncPosition(position) {
    const decimals = config.playback.timeDecimals;
    element("seek").value = position;
    element("time").value =
      `${(position / 1000).toFixed(decimals)} / ${(config.stage.duration / 1000).toFixed(decimals)} 秒`;
    element("seek").setAttribute("aria-valuetext", element("time").value);
    const chapters = [...controls.querySelectorAll("[data-chapter]")];
    const active = chapters.findLast((button) => position >= Number(button.dataset.chapter));
    chapters.forEach((button) => {
      if (button === active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }
  function syncPlaying(playing) {
    element("play").textContent = playing ? "暂停" : "播放";
    element("play").setAttribute(
      "aria-label",
      playing ? "暂停动画" : "播放动画",
    );
  }
  async function fullscreen() {
    if (isExporting()) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await app.requestFullscreen();
    } catch {
      element("status").textContent = "当前浏览器未允许全屏";
    }
  }
  function toggle() {
    if (isExporting()) return;
    enabled = !enabled;
    app.classList.toggle("controls-enabled", enabled);
    controls.setAttribute("aria-hidden", String(!enabled));
    player.setLoop(!enabled);
    resize();
    if (!enabled) player.play();
  }
  on(element("play"), "click", () => {
    if (!isExporting()) player.playing ? player.pause() : player.play();
  });
  on(element("replay"), "click", () => {
    if (!isExporting()) player.replay();
  });
  on(element("seek"), "input", (event) => {
    if (!isExporting()) player.seek(Number(event.target.value));
  });
  on(element("speed"), "change", (event) => {
    if (!isExporting()) player.setRate(event.target.value);
  });
  on(element("full"), "click", fullscreen);
  controls.querySelectorAll("[data-chapter]").forEach((button) => {
    on(button, "click", () => {
      if (!isExporting()) player.seek(Number(button.dataset.chapter));
    });
  });
  on(document, "fullscreenchange", () => {
    element("full").textContent = document.fullscreenElement
      ? "退出全屏"
      : "全屏";
    resize();
  });
  on(document, "keydown", (event) => {
    if (
      isExporting() ||
      /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName) ||
      event.target.isContentEditable
    )
      return;
    if (event.code === "Space") {
      event.preventDefault();
      toggle();
    } else if (event.key.toLowerCase() === "r") player.replay();
    else if (event.key.toLowerCase() === "f") fullscreen();
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      player.seek(
        player.currentTime +
          (event.key === "ArrowRight" ? 1 : -1) *
            config.playback.keyboardSeekStep,
      );
    }
  });
  return {
    syncPosition,
    syncPlaying,
    enable() {
      ["play", "replay", "seek"].forEach((id) => {
        element(id).disabled = false;
      });
    },
    show() {
      if (!enabled && !isExporting()) toggle();
    },
    hide() {
      enabled = false;
      app.classList.remove("controls-enabled");
      controls.setAttribute("aria-hidden", "true");
    },
    dispose() {
      abort.abort();
    },
    get enabled() {
      return enabled;
    },
  };
}
