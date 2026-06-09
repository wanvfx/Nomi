// 画面比例（aspect ratio）的单一真相源解析。
// 三处复用同一份逻辑（P4 通用第一）：
//   ① 画布节点图像区（BaseGenerationNode）未生成态按比例显示形状
//   ② 计划清单卡的比例下拉预览（AspectBox 组件）
//   ③ 参数面板的比例预览
// 比例值是 vendor 档案里的字符串（"16:9" / "9:16" / "1:1" …），存在 node.meta。
// 不同档案的 key 命名不一：多数是 `aspect_ratio`，imagen4/qwen 用 `size`。
import type { GenerationCanvasNode } from "../model/generationCanvasTypes";

// 比例参数可能用到的 meta key，按常见度排序。
const ASPECT_RATIO_KEYS = ["aspect_ratio", "size", "ratio", "image_size"] as const;

/**
 * 把 "W:H" 比例字符串解析成数值宽高比（width / height）。
 * - "16:9" → 1.777…，"9:16" → 0.5625，"1:1" → 1
 * - 非比例值（"adaptive" / "auto" / "2K" / "basic" / 空）→ null
 * 支持中文冒号「：」。
 */
export function parseAspectRatioValue(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!(width > 0) || !(height > 0)) return null;
  return width / height;
}

/**
 * 从节点 meta 读出当前选定的画面比例（数值）。读不到（未选模型 / 该模型无比例参数）返回 null。
 * 按 ASPECT_RATIO_KEYS 顺序找第一个能解析成 W:H 的值——非比例的 size 值（如 "2K"）会被自动跳过。
 */
export function readNodeAspectRatio(node: GenerationCanvasNode): number | null {
  const meta = node.meta;
  if (!meta || typeof meta !== "object") return null;
  const bag = meta as Record<string, unknown>;
  for (const key of ASPECT_RATIO_KEYS) {
    const ratio = parseAspectRatioValue(bag[key]);
    if (ratio) return ratio;
  }
  return null;
}
