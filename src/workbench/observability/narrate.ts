// 人话翻译层(harness 总方案 §7.2:narrate 穷举注册表)。
// 纪律:进度/错误展示组件**只准经 narrate 取文案**,字面量文案 = review 必拒;
// Record 穷举 → 新增 phase 不补人话直接 typecheck 红(结构性防"底层在动、界面失语")。
// S2 先覆盖生成进度域;错误 hint(classifyGenerationError 七段)按总方案在 S4 迁入。
// 设计系统铁律呼应:No fake progress——没有真实百分比就不给 percent,用"已等 N 秒"说真话。

export type GenerationProgressPhase =
  | 'queued' //      已入队,还没开始
  | 'resolving' //   正在确认模型与参数(catalog 解析)
  | 'requesting' //  正在把任务发给模型(vendor HTTP 出门)
  | 'waiting' //     模型已接单,排队中(拿到 taskId,首个非终态)
  | 'generating' //  模型生成中(轮询进行时)
  | 'retrying' //    网络波动重试中
  | 'finalizing' //  正在保存结果(本地化/归一)

export type ProgressNarrationContext = {
  elapsedMs?: number
  attempt?: number
  maxAttempts?: number
}

const NARRATE_PROGRESS: Record<GenerationProgressPhase, (ctx: ProgressNarrationContext) => string> = {
  queued: () => '准备生成',
  resolving: () => '正在确认模型与参数',
  requesting: () => '正在把任务发给模型',
  waiting: () => '模型已接单,排队中',
  generating: (ctx) =>
    typeof ctx.elapsedMs === 'number' && ctx.elapsedMs >= 5000
      ? `正在生成,已等 ${Math.round(ctx.elapsedMs / 1000)} 秒`
      : '正在生成',
  retrying: (ctx) =>
    ctx.attempt && ctx.maxAttempts ? `网络波动,正在重试(${ctx.attempt}/${ctx.maxAttempts})` : '网络波动,正在重试',
  finalizing: () => '正在保存结果',
}

export function narrateProgress(phase: GenerationProgressPhase, ctx: ProgressNarrationContext = {}): string {
  return NARRATE_PROGRESS[phase](ctx)
}
