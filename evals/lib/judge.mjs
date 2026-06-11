// L2 LLM-judge(llm-rubric)机制层。铁律(Hamel critique-shadowing):
//   judge 未对人工标注校准(P/R≥80%)之前,它的判决只展示参考,绝不计入 pass。
// grading prompt 形态抄 promptfoo DEFAULT_GRADING_PROMPT(Output/Rubric 双标签+强制 JSON)。
//
// 配置(用户一次性提供便宜档模型,不进仓库): evals/judge.config.json
//   { "baseUrl": "https://api.xxx.com/v1", "apiKey": "sk-…", "model": "gpt-…-mini" }
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_PATH = path.join(repoRoot, "evals", "judge.config.json");

export function loadJudgeConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (cfg.baseUrl && cfg.apiKey && cfg.model) return cfg;
  } catch {
    /* fallthrough */
  }
  return null;
}

/** few-shot 来自人工 critique(evals/annotations/*.jsonl);没有就零样例起步。 */
export function loadFewshots(limit = 6) {
  const dir = path.join(repoRoot, "evals", "annotations");
  if (!fs.existsSync(dir)) return [];
  const rows = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".jsonl"))) {
    for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const a = JSON.parse(line);
        if (a.verdict && a.critique) rows.push(a);
      } catch {
        /* skip */
      }
    }
  }
  // pass/fail 各取一半,防 judge 学成单边
  const pass = rows.filter((r) => r.verdict === "pass").slice(0, Math.ceil(limit / 2));
  const fail = rows.filter((r) => r.verdict === "fail").slice(0, Math.floor(limit / 2));
  return [...pass, ...fail];
}

export const STORYBOARD_RUBRIC = `逐条判断下面的拆镜头结果是否同时满足(全部满足才 pass):
1. 镜头划分忠实原始文案——没有遗漏文案里的关键叙事节点,也没有凭空编造文案外的情节;
2. 每个镜头的提示词是「可生成的画面描述」——具体到画面主体/环境/光线/构图,而不是抽象概括;
3. 相邻镜头在叙事上连续——按文案顺序推进,无跳跃断裂;
4. 同一主体(角色/产品)在多个镜头中的描述一致——不会镜头 1 是橘猫、镜头 3 变成黑猫。`;

/** 调 OpenAI-compatible chat completions 评一条;返回 {pass, reason} 或 throw。 */
export async function judgeOne(cfg, { userMessage, createdNodes, rubric = STORYBOARD_RUBRIC, fewshots = [] }) {
  const shots = createdNodes.map((n, i) => `镜头${i + 1}《${n.title || ""}》: ${n.prompt || "(无提示词)"}`).join("\n");
  const fewshotText = fewshots
    .map((f) => `<Example verdict="${f.verdict}">${String(f.critique).slice(0, 300)}</Example>`)
    .join("\n");
  const body = {
    model: cfg.model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "你是视频创作领域的评审。按 Rubric 评判 Output,Rubric 全部条目为真才 pass。" +
          "不确定时输出 pass=false 并说明哪条存疑(宁可错杀)。只输出 JSON: {\"reason\": string, \"pass\": boolean}。" +
          (fewshotText ? `\n以下是领域专家过往判例的口径,对齐它:\n${fewshotText}` : ""),
      },
      {
        role: "user",
        content: `<UserRequest>${userMessage}</UserRequest>\n<Output>\n${shots}\n</Output>\n<Rubric>\n${rubric}\n</Rubric>`,
      },
    ],
  };
  const res = await fetch(`${String(cfg.baseUrl).replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`judge HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || "";
  // grader 输出解析失败必须冒泡为 error,不静默当 fail(抄 promptfoo 纪律)
  const parsed = JSON.parse(text);
  if (typeof parsed.pass !== "boolean") throw new Error(`judge 输出缺 pass 字段: ${text.slice(0, 120)}`);
  return { pass: parsed.pass, reason: String(parsed.reason || "") };
}
