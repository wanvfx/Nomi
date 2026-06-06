// Tier1「定妆」节点规格构建（纯函数，从 BaseGenerationNode 抽出——规则 9/12：别喂巨壳）。
// 基于一个有图的源节点，算出「{名}·定妆」新节点要填什么：标题 / 提示词 / i2i 参考 / 模型 meta / 位置。
// 不碰 store；调用方拿到 spec 后 addNode + updateNode。

import type { GenerationCanvasNode } from '../model/generationCanvasTypes'
import { readCharacterMeta } from '../model/nodeMetaFields'
import { buildBasicCharacterFixation, buildBasicSceneFixation } from './fixationPromptTemplates'
import { useGenerationCanvasStore } from '../store/generationCanvasStore'
import { toast } from '../../../ui/toast'

export type FixationNodeSpec = {
  title: string
  prompt: string
  references: string[]
  meta: Record<string, unknown>
  position: { x: number; y: number }
}

const GPT_IMAGE_2_MODEL_META: Record<string, unknown> = {
  modelKey: 'gpt-image-2-image-to-image',
  modelAlias: 'gpt-image-2-image-to-image',
  modelVendor: 'kie',
  vendor: 'kie',
  modelLabel: 'GPT Image 2 · 图生图',
  imageModel: 'gpt-image-2-image-to-image',
  imageModelVendor: 'kie',
}

/** 算出定妆新节点的规格；源节点无图则返回 null。 */
export function buildFixationNodeSpec(node: GenerationCanvasNode): FixationNodeSpec | null {
  const srcUrl = node.result?.url
  if (!srcUrl) return null
  const isScene = node.categoryId === 'scene' || node.kind === 'scene'
  const name = (node.title || '').trim() || (isScene ? '场景' : '角色')
  const tagline = readCharacterMeta(node).tagline
  const prompt = isScene
    ? buildBasicSceneFixation(name, { tagline })
    : buildBasicCharacterFixation(name, { tagline })
  // 复用源节点图像模型；源无模型（如上传图）才回退到已内置验证过的 GPT Image 2 图生图。
  const srcMeta = (node.meta || {}) as Record<string, unknown>
  const modelMeta = typeof srcMeta.modelKey === 'string' && srcMeta.modelKey
    ? {
        modelKey: srcMeta.modelKey,
        modelAlias: srcMeta.modelAlias,
        modelVendor: srcMeta.modelVendor,
        vendor: srcMeta.vendor,
        modelLabel: srcMeta.modelLabel,
        imageModel: srcMeta.imageModel,
        imageModelVendor: srcMeta.imageModelVendor,
      }
    : GPT_IMAGE_2_MODEL_META
  return {
    title: `${name}·定妆`,
    prompt,
    references: [srcUrl],
    meta: { ...modelMeta, referenceImages: [srcUrl], referenceImageUrls: [srcUrl] },
    position: { x: node.position.x + (node.size?.width || 300) + 64, y: node.position.y },
  }
}

/** Tier1「定妆」整动作：建预填好的定妆节点 + 选中 + 提示，不自动生成（不偷花额度）。源无图则 no-op。 */
export function applyFixationMakeup(node: GenerationCanvasNode): void {
  const spec = buildFixationNodeSpec(node)
  if (!spec) return
  const store = useGenerationCanvasStore.getState()
  const created = store.addNode({ kind: 'image', title: spec.title, position: spec.position, categoryId: node.categoryId })
  store.updateNode(created.id, { prompt: spec.prompt, references: spec.references, meta: spec.meta })
  store.selectNode(created.id)
  toast('已生成定妆节点：检查提示词后点生成', 'success')
}
