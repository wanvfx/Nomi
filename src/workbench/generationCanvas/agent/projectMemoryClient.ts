// 项目记忆的渲染层客户端(harness S9):取数(bridge IPC)+ prompt 注入段格式化(预算裁剪)。
// 提炼/缓存/墓碑全在主进程 projectMemory.ts——这里只消费。
import { getDesktopBridge } from '../../../desktop/bridge'
import { getCanvasEventsProjectId } from '../events/canvasEventEmitter'

export type MemoryFactView = {
  id: string
  text: string
  kind: 'character' | 'style' | 'brand' | 'preference' | 'constraint'
  origin: 'auto' | 'user'
  sourceSeqs: number[]
  pinned: boolean
  updatedAt: string
}

const isFact = (value: unknown): value is MemoryFactView => {
  const record = value as MemoryFactView
  return Boolean(record && typeof record.id === 'string' && typeof record.text === 'string')
}

export async function fetchProjectMemoryFacts(): Promise<MemoryFactView[]> {
  const projectId = getCanvasEventsProjectId()
  const api = getDesktopBridge()?.memory
  if (!projectId || !api) return []
  try {
    const result = await api.get(projectId)
    return Array.isArray(result?.facts) ? result.facts.filter(isFact) : []
  } catch {
    return []
  }
}

export async function updateProjectMemoryFact(factId: string, patch: { text?: string; pinned?: boolean }): Promise<MemoryFactView[]> {
  const projectId = getCanvasEventsProjectId()
  const api = getDesktopBridge()?.memory
  if (!projectId || !api) return []
  const result = await api.update(projectId, factId, patch)
  return Array.isArray(result?.facts) ? result.facts.filter(isFact) : []
}

export async function removeProjectMemoryFact(factId: string): Promise<MemoryFactView[]> {
  const projectId = getCanvasEventsProjectId()
  const api = getDesktopBridge()?.memory
  if (!projectId || !api) return []
  const result = await api.remove(projectId, factId)
  return Array.isArray(result?.facts) ? result.facts.filter(isFact) : []
}

/**
 * 注入 system prompt 的记忆段。预算 ≤约 1.5k token(CJK 按 1 字≈1 token 保守计,
 * 上限 1500 字符);超了按 pinned > 用户纠正 > 自动 + 新近度裁(总方案 §C 层2)。
 */
export function formatMemoryForPrompt(facts: readonly MemoryFactView[], budgetChars = 1500): string {
  if (facts.length === 0) return ''
  const ranked = [...facts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.origin !== b.origin) return a.origin === 'user' ? -1 : 1
    return (b.updatedAt || '').localeCompare(a.updatedAt || '')
  })
  const lines: string[] = []
  let used = 0
  for (const fact of ranked) {
    const line = `- ${fact.text}`
    if (used + line.length > budgetChars) break
    lines.push(line)
    used += line.length
  }
  if (lines.length === 0) return ''
  return `项目记忆（此前积累的事实，遵守其中的约束与偏好）：\n${lines.join('\n')}`
}
