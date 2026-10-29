import { SHOW_CONFIG } from "../config/show.js";
import { createConfig } from "./config.js";

// 编译入口供页面、逐帧导出、预览脚本与测试共同使用。
export const ANIMATION_CONFIG = createConfig(SHOW_CONFIG);
