# HeroShow

配置驱动的展示动画模板，使用原生 HTML、CSS 和 JavaScript，无前端运行时依赖和构建步骤。固定设计画布为 1920 × 1080，预览按窗口缩放，支持 1080p / 4K 逐帧导出。

## 项目架构

```text
config/show.js          唯一复用配置入口：文字、指标、素材、配色、字号和节拍
index.html              场景与播放器的 DOM 骨架，不包含示例业务文案
css/styles.css          固定版式、材质和组件样式，使用配置传入的 CSS 变量
js/config.js            配置校验、指标默认值合并、绝对时间轴计算
js/animation-config.js  将复用配置编译为运行时配置
js/content.js           生成标题、积分、指标和无障碍描述，应用素材与配色
js/layout.js            字体加载后的自适应字号、换行和顺位字符间距
js/resources.js         按配置加载字体与图片，检查必要资源是否可用
js/animation.js         由绝对时间计算动画，支持任意跳转和重复渲染
js/player.js            预览播放、暂停、循环与倍速
js/controls.js          播放控制栏、键盘和章节定位
js/app.js               组装模块、缩放视口、管理资源与导出生命周期
assets/                 默认配置实际使用的图片、字体及字体许可证
scripts/                本地 HTTP 服务、关键帧及 MP4 预览工具
tests/                  配置校验、复用场景和 Chromium 导出回归测试
```

数据流：`config/show.js → 配置校验与时间轴 → 内容生成 → 资源加载 → 排版适配 → 播放 / 导出`。

## 启动预览

需要 Node.js 22 或更新版本。在项目根目录运行：

```powershell
npm start
```

打开 <http://127.0.0.1:8033>。使用 HTTP 服务打开页面，不能直接双击 HTML。默认循环播放；空格显示控制栏，R 重播，F 全屏，左右方向键逐帧移动。显示控制栏后可暂停、拖动和切换倍速。`?t=2400&controls=1` 可停在指定毫秒并显示控制栏。

## 复用设置

只需编辑 `config/show.js`，刷新页面即可生效。保留配置文件中的其他设置，按需修改以下部分。

### 文字与数据

`content` 控制标题 `label`、队名或主体名 `teamName`、得分说明 `scoreLabel`、分数 `score` 和单位 `unit`。分数与指标按字符串原样展示，不自动计算、添加正号或补小数位。名称支持 `\n` 手动换行；没有换行符时由 `layout.nameBreakAfter` 控制断行，设为 `0` 不主动断行。长名称、长分数及指标会自动缩小字号以适应区域。

`content.metrics` 可增减或调整顺序，设为 `[]` 隐藏数据区；`metricsNote` 留空隐藏数据区说明。例如：

```js
metrics: [
  {
    label: '月间顺位统计', value: '6-2-2-2',
    format: 'placements', columns: 2, spacing: 0.5,
    colors: { first: 'accent' },
  },
  { label: '平均顺位', value: '2.00' },
  { label: '一位率', value: '50.00%' },
  { label: '避四率', value: '83.33%' },
]
```

| 字段 | 用途 |
| --- | --- |
| `label`、`value`、`unit` | 标签、值、附加单位；单位可省略 |
| `columns` | 占几份等宽列，默认 1；第一项设为 2 即占两列 |
| `format` | 默认 `number`；`placements` 用于连字符统计，按配置拉开字符 |
| `spacing` | `placements` 中可用字符间隙的比例，0 紧排、0.5 半间隙、1 铺满当前列；调整不移动后面的指标 |
| `colors` | 覆盖 `label`、`number`、`decimal`、`separator`、`suffix`、`unit`、`first` 的颜色；`first` 为顺位统计第一组数字 |
| `characterColors` | 可选颜色数组，按字符覆盖颜色，优先于 `colors`，例如 `['accent', '#fff']` |

颜色可写 CSS 颜色或 `theme` 中的键名，例如 `accent`、`dataInk`。全局指标颜色默认值在 `metricStyle.colors` 中设置。指标过多时会缩小字号，建议保持在单行能清楚阅读的数量。

### 素材与字体

在 `assets` 中修改 `portrait`（合影或主体图）、`logo`、`background`、`grain`、`favicon` 路径。将新素材放进项目的 `assets/` 下，路径相对于项目根目录，例如 `assets/images/new-team.webp`。合影建议使用透明 PNG / WebP；队徽按原比例完整显示，不裁切。图片和纹理路径留空会隐藏相应素材。

字体路径在 `assets.fonts.title.src` 和 `assets.fonts.score.src`，对应字重由 `weight` 指定；支持 TTF、OTF、WOFF 和 WOFF2。`src` 留空或省略该字体配置时使用系统字体。替换字体应同时保存其许可证。已配置但缺失的图片或字体会显示资源错误，并阻止导出。

### 配色、构图与节奏

- `theme`：主背景、文字、强调色、数据区、人物底板与转场渐变颜色。
- `layout`：标题和数字字号、得分说明位置、指标列间距、名称断行、合影偏移与缩放、队徽缩放。
- `motion`：开场时长、转场进入 / 停顿 / 退出、各元素入场偏移和时长，以及 `hold` 展示时长，单位为毫秒。
- `ambient`：展示背景的微动开关、周期和幅度。
- `text.enabled`：设为 `false` 隐藏展示文字及数据区。
- `ui.chapters`：三个章节按钮的显示文字。

入场始终从转场完全退出后开始；程序根据名称字符数和指标数量等待所有元素入场完成，再保持 `motion.hold` 指定的展示时长，自动计算章节时间与总时长。

## 测试和导出

浏览器工具使用 Playwright。运行开发测试前执行 `npm ci`，并准备可用的 Chromium；可用 `CHROMIUM_PATH` 指定已有 Chrome 的完整路径，使用现有 Playwright 时可设置 `PLAYWRIGHT_MODULE`。

```powershell
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm test
npm run preview
```

关键帧默认输出到 `.artifacts/preview/`。`npm run preview -- --video` 可生成 30 fps MP4，需要 FFmpeg；`FFMPEG_PATH` 可指定可执行文件，`ARTIFACT_DIR` 可指定输出目录。生成物不进入版本控制。测试及预览工具固定使用 Chromium 软件绘制，以保证逐像素比较稳定；外部工具需要逐像素复现时使用同样的 `--disable-gpu --disable-lcd-text` 启动参数。

页面提供 `window.__VIDEO_EXPORT__` 协议 v1：`getManifest()`、`prepare(options)`、`reset()`、`renderFrame({ timeMs })`、`dispose()`。导出前设置 `window.__VIDEO_EXPORT_REQUEST__` 可关闭自动播放；`prepare` 等待字体和图片完成加载。使用固定 1920 × 1080 视口，4K 输出采用 3840 × 2160 和设备像素比 2。导出无音频。
