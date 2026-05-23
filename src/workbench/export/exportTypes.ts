import type { TimelineState } from '../timeline/timelineTypes'
import type { PreviewAspectRatio } from '../workbenchTypes'

export type ExportPreset = 'publish' | 'edit' | 'share' | 'webm'

export type ExportResolution = '720p' | '1080p' | 'source'

export type ExportQuality = 'small' | 'standard' | 'high'

export type ExportRequest = {
  projectId: string
  timeline: TimelineState
  aspectRatio: PreviewAspectRatio
  preset: ExportPreset
  resolution: ExportResolution
  quality: ExportQuality
  outputName?: string
}

export type DesktopMp4ExportStartPayload = {
  projectId: string
  webmBytes: ArrayBuffer
  outputName?: string
  resolution?: Exclude<ExportResolution, 'source'>
  quality?: ExportQuality
  fps?: number
}

export type DesktopMp4ExportResult = {
  absolutePath: string
  relativePath: string
  size: number
}
