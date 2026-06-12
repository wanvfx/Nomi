// 统一求值流(harness §6.1)——AI 想动你的作品前必经的那道门。
// 把散落的"只读自动放行"硬编码约定声明化成一张工具 meta 表 + 一个纯函数。
// 三步:① policy(只读→allow)② invariant(校验/锁→deny)③ ask(其余→等用户点头)。
// SDK 的 hook registry / permission mode / 规则 DSL 一律不抄(单用户桌面无配置面)。

/** 三种 intent = 同一管道的三种入口(每工具 / 批量计划 / 预算)。 */
export type GateIntent =
  | { kind: 'tool-call'; toolName: string; args: unknown }
  | { kind: 'batch-run'; nodeIds: string[] } // S2b/S6b 受理
  | { kind: 'spend'; estimatedCost: number } // S7 预算门

/** ask 的 proposal 由调用方持有(渲染层的 pending 卡),决策本身只需三态。 */
export type GateDecision =
  | { outcome: 'allow' }
  | { outcome: 'deny'; reason: string } // reason = 人话(回喂 LLM 可自我修正,N14 素材)
  | { outcome: 'ask' }

/** 求值上下文:S6-4 锁把 lockedNodeIds 填进来,本片留空但签名前向兼容。 */
export type GateContext = {
  /** 被用户锁住的节点 id(source 恒 user);改其 prompt/params/入边/删除 = deny。 */
  lockedNodeIds?: ReadonlySet<string>
}

/** 工具写/破坏性/花钱分级(T2 meta 的声明式落地;唯一真相源,取代硬编码字符串门)。 */
type ToolMeta = { writes: boolean; destructive?: boolean; costy?: boolean }

const TOOL_META: Record<string, ToolMeta> = {
  read_canvas_state: { writes: false },
  create_canvas_nodes: { writes: true },
  connect_canvas_edges: { writes: true },
  set_node_prompt: { writes: true },
  delete_canvas_nodes: { writes: true, destructive: true },
}

/**
 * 单一求值入口。纯函数:同 (intent, ctx) 必得同 decision,便于单测/重放。
 * 决策落日志的裁剪在调用方(deny 必入、ask 结果入、只读 allow 不入——纯噪声)。
 */
export function evaluateGate(intent: GateIntent, ctx: GateContext = {}): GateDecision {
  if (intent.kind === 'tool-call') {
    const meta = TOOL_META[intent.toolName]
    // ② invariant(校验):不认识的工具 = 注定失败的计划,不让用户批准(§6.5)。
    if (!meta) return { outcome: 'deny', reason: `不支持的操作「${intent.toolName}」` }
    // ① policy:只读直通,零摩擦(M1)。
    if (!meta.writes) return { outcome: 'allow' }
    // ② invariant(锁):写操作命中锁住的节点 → deny。S6-4 填规则,本片 ctx 为空恒不触发。
    const denied = evaluateLock(intent, ctx)
    if (denied) return denied
    // ③ ask:写操作排队等用户点头。
    return { outcome: 'ask' }
  }
  // batch-run / spend:S6b / S7 落地受理与预算语义,本片先一律 ask。
  return { outcome: 'ask' }
}

/** 锁不变量求值(S6-4 实现):入边/改 prompt/params/删除命中锁节点 → deny;出边/移动放行。 */
function evaluateLock(_intent: GateIntent, _ctx: GateContext): GateDecision | null {
  return null
}
