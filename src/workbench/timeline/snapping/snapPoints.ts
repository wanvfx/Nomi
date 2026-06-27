import type { TimelineState } from '../timelineTypes'
import type { SnapPoint } from './snapTypes'

export type BuildSnapPointsOptions = {
  /** 拖动中的 clip 自身（及成组成员）不作为吸附目标。 */
  excludeClipIds?: ReadonlySet<string>
  /** 是否把 playhead 当吸附目标（拖 playhead 自身时应关掉）。默认 true。 */
  includePlayhead?: boolean
}

/**
 * 收集"稀疏强目标"吸附点：起点(0) · playhead · 各 clip 头/尾。
 *
 * 真实用户评审反馈：整秒(每秒一个)吸附点太密 → 拖动像走搓衣板、咔哒连抖、想留缝放不准。
 * 故 **整秒默认不收集**（如需"对齐到秒"可作为 zoom-in 高级选项单独再加，不进默认集）。
 * 稀疏目标 + 交互层"按原始距离逐帧判定"天然实现"靠近即吸、拖远即脱离"，无需快捷键。
 */
export function buildSnapPoints(timeline: TimelineState, options: BuildSnapPointsOptions = {}): SnapPoint[] {
  const exclude = options.excludeClipIds ?? new Set<string>()
  const points: SnapPoint[] = [{ frame: 0, type: 'origin', label: '起点' }]

  if (options.includePlayhead !== false) {
    points.push({ frame: timeline.playheadFrame, type: 'playhead', label: '播放头' })
  }

  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (exclude.has(clip.id)) continue
      const name = clip.label || clip.text || '片段'
      points.push({ frame: clip.startFrame, type: 'clipStart', label: `${name}头`, clipId: clip.id })
      points.push({ frame: clip.endFrame, type: 'clipEnd', label: `${name}尾`, clipId: clip.id })
    }
  }

  return points
}
