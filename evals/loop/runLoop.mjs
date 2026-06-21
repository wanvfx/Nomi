// 自我改进 loop · S1 离线 runner —— 合成人格 → (mock target) 轨迹 → 客观指标表。
// 全离线、零额度:证明「AI 扮用户 × 场景 → 量化指标」这条脊梁回路在 Nomi 栈里跑得通。
// S2 把 mockTarget 换成真 capability-core 驱动 + 独立「查/修」agent。
// 跑:node evals/loop/runLoop.mjs
import { SCENARIO_ITEMS, NOMI_CAPABILITIES } from "./personas.mjs";
import { OBJECTIVE_SCORERS } from "./scorers.mjs";

/** 占位 target:按 Nomi 真实能力集推一条合理轨迹(缺的能力 = 缺口/报错)。
 *  S2 替换为:合成用户 agent 经 capability-core 真驱动 Nomi 跑出的真实轨迹。 */
function mockTarget(scenario) {
  const used = scenario.expects.filter((c) => NOMI_CAPABILITIES.has(c));
  const missing = scenario.expects.filter((c) => !NOMI_CAPABILITIES.has(c));
  return {
    expects: scenario.expects,
    usedCapabilities: used,
    producedAsset: missing.length === 0,
    errors: missing.length,
    retries: 1 + missing.length,
    invalidEdges: 0,
    cost: 0, // mock 零额度
    missing,
  };
}

const rows = [];
for (const item of SCENARIO_ITEMS) {
  const traj = mockTarget(item);
  const scores = {};
  for (const s of OBJECTIVE_SCORERS) {
    const res = await s.run({ output: traj, input: { expects: item.expects } });
    scores[s.id] = res.score;
  }
  rows.push({ persona: item.personaLabel, scores, missing: traj.missing });
}

const cols = OBJECTIVE_SCORERS.map((s) => s.id);
const fmt = (n) => Number(n).toFixed(2);
const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].length));

console.log("\n=== 自我改进 loop · 客观指标表(S1 离线 mock,零额度) ===\n");
console.log(pad("人格", 26) + cols.map((c) => pad(c, 22)).join(""));
for (const r of rows) {
  console.log(pad(r.persona, 26) + cols.map((c) => pad(fmt(r.scores[c]), 22)).join(""));
}
const avg = (c) => fmt(rows.reduce((a, r) => a + r.scores[c], 0) / rows.length);
console.log("\n" + pad("总览均分", 26) + cols.map((c) => pad(avg(c), 22)).join(""));

const gaps = rows.filter((r) => r.missing.length);
console.log("\n⚠️ 能力缺口(诚实标 · D4):");
if (!gaps.length) console.log("  (无)");
for (const g of gaps) console.log(`  · ${g.persona}:缺 ${g.missing.join(", ")}`);
console.log(`\n✅ S1 跑通:${rows.length} 人格场景 → ${cols.length} 维客观指标,全离线零额度。`);
