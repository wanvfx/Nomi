// 内置「模型档案」与生成节点 UI 之间的桥（C2b）。
//
// 职责：把档案的 modes/slots/params（src/config/modelArchetypes，供应商无关）映射成节点 UI
// 需要的三样东西 —— ① 模式分段切换的选项、② 当前模式的参考槽（复用现有 ImageUrlSlot 形状）、
// ③ 当前模式的标量参数。
//
// **参考图存储模型（对齐样张 v3）**：参考值按 slot 键**全局**存在 flat meta 里（firstFrameUrl /
// lastFrameUrl…），跨模式持久——切模式只改变「显示哪些槽」，不搬动/清空数据，所以切回照片还在
// （真实用户 F4「怕丢上传」）。**模式互斥（M2）发生在传输投影**：`projectArchetypeFrameExtras`
// 只把**当前模式声明的槽键**放进请求，残留的别的模式的键不进 body（§2 坑2，避免 Seedance 422）。
// node.meta.archetype 只记 { id, modeId }（当前模式），不囤参考数据。
//
// C2b 只处理首帧 / 尾帧两类 frame 槽，映射到现有 flat 传输键（firstFrameUrl/lastFrameUrl），
// 传输层零改动。image_ref / video_ref / audio_ref（数组槽）在 C3 接入档案驱动的 input-builder。
import type { ModelParameterControl } from '../../../../config/modelCatalogMeta'
import {
  type ArchetypeMode,
  type ArchetypeReferenceSlotKind,
  type ModelArchetype,
  resolveArchetypeForModel,
} from '../../../../config/modelArchetypes'
import type { ImageUrlSlot } from './parameterControlModel'

export { resolveArchetypeForModel }
export type { ModelArchetype, ArchetypeMode }

/** 跨模型统一的「意图词」——模式分段按钮的主标签（vendorTerm 作副标签）。来自样张 v3 INTENT_LABEL。 */
const INTENT_LABEL: Record<ArchetypeMode['intent'], string> = {
  text: '文生视频',
  single: '单图首帧',
  firstlast: '首尾帧',
  character: '角色参考',
  edit: '视频编辑',
}

export function intentLabel(intent: ArchetypeMode['intent']): string {
  return INTENT_LABEL[intent]
}

/**
 * C2b 支持的 frame 槽 → 现有 flat 传输键映射。url 键即传输读取的键（runtime taskTemplateParams
 * 读 extras.firstFrameUrl/lastFrameUrl）；ref 键记住来源节点 id 供缩略图回显。
 * 返回 null 表示该 slot kind 尚未接入（image_ref/video_ref/audio_ref/source_video → C3）。
 */
const FRAME_SLOT_FLAT: Partial<Record<ArchetypeReferenceSlotKind, { urlKey: string; refKey: string; group: ImageUrlSlot['group'] }>> = {
  first_frame: { urlKey: 'firstFrameUrl', refKey: 'firstFrameRef', group: 'first_frame' },
  last_frame: { urlKey: 'lastFrameUrl', refKey: 'lastFrameRef', group: 'last_frame' },
}

type ArchetypeNodeMeta = {
  id: string
  modeId: string
}

function readArchetypeNodeMeta(meta: Record<string, unknown> | undefined): ArchetypeNodeMeta | null {
  const value = meta?.archetype
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id : ''
  const modeId = typeof record.modeId === 'string' ? record.modeId : ''
  if (!id || !modeId) return null
  return { id, modeId }
}

/** 当前激活的模式（无命名空间 meta 或 modeId 失效时落到 defaultModeId）。 */
export function currentArchetypeMode(archetype: ModelArchetype, meta: Record<string, unknown> | undefined): ArchetypeMode {
  const stored = readArchetypeNodeMeta(meta)
  const modeId = stored?.id === archetype.id ? stored.modeId : ''
  return archetype.modes.find((m) => m.id === modeId)
    ?? archetype.modes.find((m) => m.id === archetype.defaultModeId)
    ?? archetype.modes[0]
}

export type ArchetypeModeChoice = { id: string; label: string; vendorTerm: string; hint: string }

/** 模式分段切换的选项（仅当 >1 模式时 UI 才显示该段）。 */
export function archetypeModeChoices(archetype: ModelArchetype): ArchetypeModeChoice[] {
  return archetype.modes.map((mode) => ({
    id: mode.id,
    label: intentLabel(mode.intent),
    vendorTerm: mode.vendorTerm,
    hint: mode.hint,
  }))
}

/** 当前模式的参考槽 → 现有 ImageUrlSlot（C2b 仅 frame 槽；未接入的 kind 跳过）。 */
export function archetypeModeSlots(mode: ArchetypeMode): ImageUrlSlot[] {
  return mode.slots.flatMap((slot): ImageUrlSlot[] => {
    const flat = FRAME_SLOT_FLAT[slot.kind]
    if (!flat) return []
    return [{ key: flat.urlKey, label: slot.label, group: flat.group }]
  })
}

/** 当前模式的标量参数（复用现有 ModelParameterControl 渲染路径）。 */
export function archetypeModeParams(mode: ArchetypeMode): ModelParameterControl[] {
  return mode.params
}

/**
 * 切到 nextModeId：只改 node.meta.archetype.modeId（参考值全局保留，不搬不清）。返回**整份新 meta**。
 * 互斥不在这里发生——发生在传输投影（projectArchetypeFrameExtras）。这样切回时照片还在。
 */
export function applyArchetypeModeSwitch(
  meta: Record<string, unknown>,
  archetype: ModelArchetype,
  nextModeId: string,
): Record<string, unknown> {
  const nextMode = archetype.modes.find((m) => m.id === nextModeId) ?? archetype.modes[0]
  return { ...meta, archetype: { id: archetype.id, modeId: nextMode.id } }
}

/**
 * 初次落地（节点刚选到一个有档案的模型、还没有命名空间 meta 时）：写入默认模式的 archetype 命名空间。
 * 幂等：已是该档案则返回 null（不循环）。
 */
export function ensureArchetypeNodeMeta(
  meta: Record<string, unknown>,
  archetype: ModelArchetype,
): Record<string, unknown> | null {
  const stored = readArchetypeNodeMeta(meta)
  if (stored?.id === archetype.id) return null
  return applyArchetypeModeSwitch(meta, archetype, archetype.defaultModeId)
}

/** 该档案所有模式可能用到的 frame url 键（请求构建时把非当前模式的键显式置 undefined，挡住 ...meta 泄露）。 */
export function archetypeManagedFrameUrlKeys(archetype: ModelArchetype): string[] {
  const keys = new Set<string>()
  for (const mode of archetype.modes) {
    for (const slot of mode.slots) {
      const flat = FRAME_SLOT_FLAT[slot.kind]
      if (flat) keys.add(flat.urlKey)
    }
  }
  return Array.from(keys)
}

/**
 * **传输投影（M2 互斥）**：只把当前模式声明的 frame 槽键放进请求 extras，残留的别的模式的键
 * 不进 body（§2 坑2，避免 Seedance 三模式混用导致 422）。参考 references（来自画布连线）优先，
 * 否则取 meta 里全局存的值。C2b 只投影 frame 槽；数组槽（image_ref…）在 C3 扩展。
 */
export function projectArchetypeFrameExtras(
  meta: Record<string, unknown>,
  archetype: ModelArchetype,
  references?: { firstFrameUrl?: string | null; lastFrameUrl?: string | null },
): Record<string, string> {
  const mode = currentArchetypeMode(archetype, meta)
  const out: Record<string, string> = {}
  for (const slot of mode.slots) {
    const flat = FRAME_SLOT_FLAT[slot.kind]
    if (!flat) continue
    const fromRef = flat.urlKey === 'firstFrameUrl' ? references?.firstFrameUrl
      : flat.urlKey === 'lastFrameUrl' ? references?.lastFrameUrl
      : undefined
    const raw = (typeof fromRef === 'string' && fromRef.trim()) ? fromRef
      : (typeof meta[flat.urlKey] === 'string' ? (meta[flat.urlKey] as string) : '')
    if (raw.trim()) out[flat.urlKey] = raw.trim()
  }
  return out
}
