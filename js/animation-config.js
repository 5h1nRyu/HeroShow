// 内容、构图、镜头节拍均在这里配置；时间单位为毫秒。
const introDuration = Number((633 * 0.7).toFixed(1));
const bridgeEnter = 330, bridgePause = 120, bridgeExit = 330;
const boardStart = introDuration + bridgeEnter + bridgePause + bridgeExit;
const displayStart = boardStart + 637;
const displayDuration = 5000;

export const ANIMATION_CONFIG = {
  content: {
    label: "九月队伍积分冠军",
    teamName: "角川樱花骑士",
    scoreLabel: "月间队伍得分",
    score: "+197.2", // 整组揭示，保持原始字符串，不做数字滚动。
    unit: "PT",
    portrait: "assets/images/player.png",
    logo: "assets/images/team-logo.png",
    // 用户提供截图：12 场，1–4 位次数为 6、2、2、2。
    metricsArePlaceholders: false,
    metrics: [
      { label: "月间顺位统计", value: "6-2-2-2", unit: "", format: "placements", columns: 2 },
      { label: "平均顺位", value: "2.00", unit: "" },
      { label: "一位率", value: "50.00%", unit: "" },
      { label: "避四率", value: "83.33%", unit: "" },
    ],
  },
  layout: {
    nameBreakAfter: 2,
    nameFontSize: 100,
    scoreFontSize: 250,
    portrait: { x: 0, y: 0, scale: 1, origin: "50% 50%" },
    logoScale: 0.84,
  },
  theme: {
    paper: "#ECE5D6",
    ink: "#191919",
    muted: "#78716C",
    panel: "#F0B6CC",
    accent: "#EF92AE", // 从原始队徽中提取的樱花粉。
    pink: "#EF92AE",
    data: "#201E1C",
    dataInk: "#F5EEE4",
    dataMuted: "#BDB2AA",
  },
  stage: { width: 1920, height: 1080, duration: displayStart + displayDuration },
  text: { enabled: true },
  timing: {
    introText: { start: 0, duration: introDuration },
    // 各片在同一时刻归零拼合，短暂停顿后从相反侧穿出。
    bridge: { start: introDuration, duration: bridgeEnter + bridgePause + bridgeExit, enter: bridgeEnter, pause: bridgePause, exit: bridgeExit, stagger: 15 },
    board: { start: boardStart, duration: 637 },
    panel: { start: boardStart, duration: 360 },
    identity: { start: boardStart, duration: 480 },
    label: { start: boardStart, duration: 300 },
    portrait: { start: boardStart + 70, duration: 500 },
    name: { start: boardStart + 97, duration: 340, stagger: 25 },
    score: { start: boardStart + 227, duration: 350 },
    unit: { start: boardStart + 307, duration: 300 },
    metrics: { start: boardStart + 197, duration: 260, stagger: 40 },
    hold: { start: displayStart, duration: displayDuration },
  },
  ambient: { enabled: true, start: displayStart, period: 12000, travel: 16 },
  playback: { loopStart: 0, keyboardSeekStep: 1000 / 30, timeDecimals: 2 },
};
