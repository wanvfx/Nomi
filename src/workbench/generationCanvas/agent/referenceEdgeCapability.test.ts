import { describe, expect, it } from 'vitest'
import { referenceAssetKindForNode, validateReferenceEdge } from './referenceEdgeCapability'
import type { GenerationCanvasNode } from '../model/generationCanvasTypes'

// archetypeId 显式命中内置档案(resolveArchetypeForModel/getArchetypeById 优先看它):
//   imagen-4   = 纯文生(所有模式 slots:[])——不吃任何参考
//   seedream   = t2i(slots:[]) + edit(image_ref)——union 有图片参考槽
//   seedance-2 = 视频,omni 有 image_ref/video_ref/audio_ref + first/firstlast 帧槽
function node(id: string, kind: string, archetypeId?: string): GenerationCanvasNode {
  return {
    id,
    kind: kind as GenerationCanvasNode['kind'],
    title: id,
    prompt: '',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...(archetypeId ? { meta: { archetype: { id: archetypeId, modeId: '' } } } : {}),
  } as GenerationCanvasNode
}

describe('referenceAssetKindForNode — 源能给哪种可参考资产', () => {
  it('图片类节点(character/scene/image/keyframe/asset)→ image', () => {
    for (const kind of ['character', 'scene', 'image', 'keyframe', 'asset', 'panorama']) {
      expect(referenceAssetKindForNode(node('n', kind))).toBe('image')
    }
  })
  it('视频节点 → video', () => {
    expect(referenceAssetKindForNode(node('n', 'video'))).toBe('video')
  })
  it('文本/镜头/输出节点 → null(无可参考产物)', () => {
    for (const kind of ['text', 'shot', 'output']) {
      expect(referenceAssetKindForNode(node('n', kind))).toBeNull()
    }
  })
})

describe('validateReferenceEdge — 参考边能力校验', () => {
  it('① 文本节点作参考源 → 拒(source_not_referenceable)', () => {
    const verdict = validateReferenceEdge(node('t', 'text'), node('i', 'image', 'seedream'), 'reference')
    expect(verdict).toEqual({ ok: false, reason: 'source_not_referenceable' })
  })

  it('② character_ref → 纯文生模型(imagen-4,无图片参考槽) → 拒(unsupported_reference)', () => {
    const verdict = validateReferenceEdge(node('c', 'character'), node('i', 'image', 'imagen-4'), 'character_ref')
    expect(verdict).toEqual({ ok: false, reason: 'unsupported_reference' })
  })

  it('character_ref → 有图片参考槽的模型(seedream edit) → 放行', () => {
    expect(validateReferenceEdge(node('c', 'character'), node('i', 'image', 'seedream'), 'character_ref')).toEqual({ ok: true })
  })

  it('first_frame(图片源)→ 视频模型(seedance 有首帧槽) → 放行', () => {
    expect(validateReferenceEdge(node('k', 'keyframe'), node('v', 'video', 'seedance-2'), 'first_frame')).toEqual({ ok: true })
  })

  it('first_frame(视频源,尾帧接力)→ 视频模型(seedance 首帧槽收 video) → 放行', () => {
    expect(validateReferenceEdge(node('v0', 'video'), node('v1', 'video', 'seedance-2'), 'first_frame')).toEqual({ ok: true })
  })

  it('character_ref → 视频 omni(seedance 有 image_ref 角色参考槽) → 放行', () => {
    expect(validateReferenceEdge(node('c', 'character'), node('v', 'video', 'seedance-2'), 'character_ref')).toEqual({ ok: true })
  })

  it('first_frame → 纯文生图模型(imagen-4 无首帧槽) → 拒', () => {
    const verdict = validateReferenceEdge(node('k', 'keyframe'), node('i', 'image', 'imagen-4'), 'first_frame')
    expect(verdict).toEqual({ ok: false, reason: 'unsupported_reference' })
  })

  it('目标未声明档案(未知/未设模型)→ 放行(P4 通用回退,不误伤)', () => {
    expect(validateReferenceEdge(node('c', 'character'), node('i', 'image'), 'character_ref')).toEqual({ ok: true })
  })

  it('通用 reference(图片源)→ 有图片参考槽 → 放行；→ 纯文生 → 拒', () => {
    expect(validateReferenceEdge(node('a', 'image'), node('b', 'image', 'seedream'), undefined)).toEqual({ ok: true })
    expect(validateReferenceEdge(node('a', 'image'), node('b', 'image', 'imagen-4'), undefined)).toEqual({ ok: false, reason: 'unsupported_reference' })
  })
})
