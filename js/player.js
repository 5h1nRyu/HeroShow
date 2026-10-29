// 浏览器预览播放器。导出只调用 render，不启动此播放器。
export function createPlayer({
  duration,
  loopStart,
  render,
  onUpdate,
  onPlayingChange,
}) {
  let position = 0,
    playing = false,
    ready = false,
    rate = 1,
    lastFrame = null,
    frame = 0,
    loop = true;
  const draw = (ms) => {
    position = render(ms);
    onUpdate(position);
  };
  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    lastFrame = null;
    onPlayingChange(false);
  }
  function tick(now) {
    if (!playing) return;
    if (document.hidden) {
      lastFrame = null;
      frame = requestAnimationFrame(tick);
      return;
    }
    if (lastFrame !== null) {
      let next = position + (now - lastFrame) * rate;
      if (next >= duration && loop)
        next = loopStart + ((next - duration) % (duration - loopStart));
      draw(next);
    }
    lastFrame = now;
    if (position >= duration && !loop) {
      pause();
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  function play(restart = false) {
    if (!ready) return;
    pause();
    if (restart || position >= duration) draw(0);
    playing = true;
    onPlayingChange(true);
    frame = requestAnimationFrame(tick);
  }
  function seek(ms) {
    pause();
    draw(ms);
  }
  const visibility = () => {
    lastFrame = null;
  };
  document.addEventListener("visibilitychange", visibility);
  return {
    initialize: () => draw(0),
    setReady(value) {
      ready = value;
    },
    setLoop(value) {
      loop = value;
    },
    setRate(value) {
      rate = Number(value);
      lastFrame = null;
    },
    play,
    pause,
    seek,
    replay: () => play(true),
    dispose() {
      pause();
      ready = false;
      document.removeEventListener("visibilitychange", visibility);
    },
    get currentTime() {
      return position;
    },
    get duration() {
      return duration;
    },
    get playing() {
      return playing;
    },
  };
}
