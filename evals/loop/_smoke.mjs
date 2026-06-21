// 离线证明:Mastra createScorer 纯客观打分(不碰 Agent / 不碰 ai / 不出网)。
// 验「AI 扮用户的轨迹 → 量化指标」这条最小回路在 Nomi 栈里真跑得通。
// 跑:node evals/loop/_smoke.mjs
import { createScorer } from "@mastra/core/evals";

// —— 三个客观打分器(纯 JS .generateScore,机器可判定,零 LLM)——
const taskCompletion = createScorer({
  id: "task-completion",
  description: "轨迹是否产出最终资产(producedAsset)",
}).generateScore(({ run }) => (run.output?.producedAsset ? 1 : 0));

const errorFree = createScorer({
  id: "error-free",
  description: "无报错为 1,有报错按条数衰减",
}).generateScore(({ run }) => 1 / (1 + (run.output?.errors ?? 0)));

const retryEfficiency = createScorer({
  id: "retry-efficiency",
  description: "重试越少越好(1 次=满分,衰减)",
}).generateScore(({ run }) => 1 / Math.max(1, run.output?.retries ?? 1));

// —— 两条模拟轨迹(占位,S2 换成真 capability-core 跑出来的)——
const mockTrajectories = [
  { persona: "novice", producedAsset: true, errors: 0, retries: 1 },
  { persona: "pro", producedAsset: false, errors: 2, retries: 3 },
];

const scorers = [taskCompletion, errorFree, retryEfficiency];
console.log("persona       | " + scorers.map((s) => s.id.padEnd(16)).join(""));
for (const t of mockTrajectories) {
  const cells = [];
  for (const s of scorers) {
    const res = await s.run({ output: t });
    cells.push(String(res.score).slice(0, 5).padEnd(16));
  }
  console.log(t.persona.padEnd(13) + " | " + cells.join(""));
}
console.log("\n✅ 客观打分器离线跑通(纯 JS 路径,无网络出口)");
