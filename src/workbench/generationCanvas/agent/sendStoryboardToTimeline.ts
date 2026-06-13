import { useWorkbenchStore } from '../../workbenchStore'
import { useGenerationCanvasStore } from '../store/generationCanvasStore'
import { sendGenerationNodeToTimeline } from './sendGenerationNodeToTimeline'
import { planStoryboardTimeline, type StoryboardTimelineUnitRole } from './storyboardTimelinePlan'
import type { TimelineState } from '../../timeline/timelineTypes'

export type SendStoryboardToTimelineResult = {
  ok: boolean
  total: number
  sent: Array<{ nodeId: string; clipId: string; trackType: string; startFrame: number; role?: StoryboardTimelineUnitRole }>
  skipped: Array<{ nodeId: string; reason: string }>
}

/** 时间轴当前最右端帧（append 落点）：两轨所有 clip 的 endFrame 取最大，空轴则 0。 */
function timelineEndFrame(timeline: TimelineState): number {
  let end = 0
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.endFrame > end) end = clip.endFrame
    }
  }
  return end
}

/**
 * 把一组「排片单位」（已按剧本镜序排好）逐个落到时间轴：每个 clip 落自然轨
 * （视频→媒体轨、占位图→图片轨），cursor 在两轨间顺序累加——时间上首尾相接、
 * 不重叠，导出时跨两轨取当前帧活动 clip，成片连续。两个入口共用此核心。
 */
function placeUnitsSequentially(
  units: ReadonlyArray<{ nodeId: string; role?: StoryboardTimelineUnitRole }>,
  startFrame: number,
): SendStoryboardToTimelineResult['sent'] {
  let cursor = Math.max(0, Math.floor(startFrame))
  const sent: SendStoryboardToTimelineResult['sent'] = []
  for (const unit of units) {
    const result = sendGenerationNodeToTimeline(
      {
        readGenerationNodes: () => useGenerationCanvasStore.getState().nodes,
        readTimeline: () => useWorkbenchStore.getState().timeline,
        addTimelineClipAtFrame: (clip, trackType, frame) => {
          useWorkbenchStore.getState().addTimelineClipAtFrame(clip, trackType, frame)
        },
        readTimelineAfterInsert: () => useWorkbenchStore.getState().timeline,
      },
      unit.nodeId,
      { startFrame: cursor },
    )
    if (result.ok) {
      cursor = result.startFrame + result.clip.frameCount
      sent.push({
        nodeId: unit.nodeId,
        clipId: result.clip.id,
        trackType: result.trackType,
        startFrame: result.startFrame,
        ...(unit.role ? { role: unit.role } : {}),
      })
    }
  }
  return sent
}

/**
 * 手动「发送到时间轴」（工具栏按钮，作用于选中子集）：按 `shotIndex` 镜序把选中节点
 * 铺到时间轴（从播放头开始）。排序与 Agent 路径共享同一份真相（shotIndex），
 * 不再用不可靠的连线拓扑。
 */
export function sendStoryboardToTimeline(nodeIds: readonly string[]): SendStoryboardToTimelineResult {
  const canvasState = useGenerationCanvasStore.getState()
  const { units, skipped } = planStoryboardTimeline(canvasState.nodes, canvasState.edges, nodeIds)
  const startFrame = Math.max(0, Math.floor(useWorkbenchStore.getState().timeline.playheadFrame ?? 0))
  const sent = placeUnitsSequentially(units, startFrame)
  const skippedById = new Map(skipped.map((item) => [item.nodeId, item]))
  for (const item of sent) skippedById.delete(item.nodeId)
  return { ok: sent.length > 0, total: units.length, sent, skipped: [...skippedById.values()] }
}

export type ArrangeStoryboardToTimelineOptions = {
  /** 排片范围：省略 = 整条故事板（所有镜头节点）；给定 = 仅这些节点。 */
  nodeIds?: readonly string[]
}

/**
 * Agent 入口 arrange_storyboard_to_timeline：把整条（或指定子集）故事板按剧本镜序
 * **追加**到时间轴末尾（用户拍板：追加语义，非破坏现有 clip）。视频优先、缺视频走
 * 关键帧占位、未生成跳过并回报——排序/选片全在纯函数里，LLM 只负责触发。
 */
export function arrangeStoryboardToTimeline(
  options: ArrangeStoryboardToTimelineOptions = {},
): SendStoryboardToTimelineResult {
  const canvasState = useGenerationCanvasStore.getState()
  const { units, skipped } = planStoryboardTimeline(canvasState.nodes, canvasState.edges, options.nodeIds)
  const startFrame = timelineEndFrame(useWorkbenchStore.getState().timeline)
  const sent = placeUnitsSequentially(units, startFrame)
  return { ok: sent.length > 0, total: units.length, sent, skipped }
}
