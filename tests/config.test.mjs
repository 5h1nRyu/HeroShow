import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { SHOW_CONFIG } from "../config/show.js";
import { createConfig } from "../js/config.js";

test("默认配置：保持现有节奏，完整展示五秒，源配置不被修改", () => {
  const original = structuredClone(SHOW_CONFIG);
  const config = createConfig(SHOW_CONFIG);
  assert.equal(config.stage.duration, 6860.1);
  assert.equal(config.timing.board.start, config.timing.bridge.start + config.timing.bridge.duration);
  assert.equal(config.timing.hold.duration, 5000);
  assert.deepEqual(SHOW_CONFIG, original);
  assert.equal(config.content.metrics[0].columns, 2);
  assert.equal(config.content.metrics[0].spacing, 0.5);
  assert.equal(config.content.metrics[1].colors.number, "dataInk");
});

test("长名称和更多指标：展示等待最后一个字符及指标完成入场", () => {
  const source = structuredClone(SHOW_CONFIG);
  source.content.teamName = "一个很长很长的名字\n和另外一行名字";
  source.content.metrics = Array.from({ length: 12 }, (_, index) => ({ label: `数据${index}`, value: index }));
  source.motion.hold = 2300;
  const config = createConfig(source);
  const nameCount = Array.from(source.content.teamName.replace(/\n/g, "")).length;
  assert.ok(config.timing.hold.start >= config.timing.name.start + config.timing.name.duration + (nameCount - 1) * config.timing.name.stagger);
  assert.ok(config.timing.hold.start >= config.timing.metrics.start + config.timing.metrics.duration + 11 * config.timing.metrics.stagger);
  assert.ok(Math.abs(config.stage.duration - config.timing.hold.start - 2300) < 0.000001);
  assert.equal(config.content.metrics[0].value, "0");
});

test("非法列宽、间距、转场节拍及循环起点提供明确配置错误", () => {
  for (const [mutate, message] of [
    [(c) => c.content.metrics[0].columns = 0, /columns/],
    [(c) => c.content.metrics[0].spacing = 2, /spacing/],
    [(c) => c.motion.entrance.name.duration = 0, /duration/],
    [(c) => c.motion.bridge.stagger = 100, /stagger/],
    [(c) => c.playback.loopStart = 999999, /loopStart/],
    [(c) => c.content.teamName = "", /teamName/],
  ]) {
    const source = structuredClone(SHOW_CONFIG);
    mutate(source);
    assert.throws(() => createConfig(source), message);
  }
});

test("默认资源路径可访问，保留两个使用中字体的许可证", async () => {
  const { assets } = SHOW_CONFIG;
  const resources = [assets.portrait, assets.logo, assets.background, assets.grain, assets.favicon,
    assets.fonts.title.src, assets.fonts.score.src,
    "assets/fonts/notosanssc-OFL.txt", "assets/fonts/barlowcondensed-OFL.txt"];
  await Promise.all(resources.map((path) => access(new URL(`../${path}`, import.meta.url))));
});
