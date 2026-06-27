import React from 'react'
import { IconChevronUp, IconMovie } from '@tabler/icons-react'
import { WorkbenchIconButton } from '../../design'
import { cn } from '../../utils/cn'
import TimelinePanel from '../timeline/TimelinePanel'
import { useWorkbenchStore } from '../workbenchStore'

type GenerationWorkspaceProps = {
  canvas: React.ReactNode
  aiSidebar?: React.ReactNode
  aiLayout?: 'sidebar' | 'overlay'
}

export default function GenerationWorkspace({
  canvas,
  aiSidebar,
  aiLayout = 'sidebar',
}: GenerationWorkspaceProps): JSX.Element {
  const width = useWorkbenchStore((s) => s.assistantWidth)
  const setWidth = useWorkbenchStore((s) => s.setAssistantWidth)
  const [timelineCollapsed, setTimelineCollapsed] = React.useState(false)
  const dragRef = React.useRef<{ startX: number; startW: number } | null>(null)
  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startW: width }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [width])
  const onPointerMove = React.useCallback((e: React.PointerEvent) => {
    const st = dragRef.current
    if (!st) return
    // 右侧停靠：往左拖（clientX 变小）= 加宽。
    setWidth(st.startW + (st.startX - e.clientX))
  }, [setWidth])
  const endDrag = React.useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }, [])
  const sidebarStyle = aiSidebar && aiLayout === 'sidebar'
    ? {
        gridTemplateColumns: `minmax(0,1fr) ${width}px`,
        gridTemplateRows: `minmax(0,1fr) ${timelineCollapsed ? '42px' : 'var(--workbench-timeline-height)'}`,
      } as React.CSSProperties
    : {
        gridTemplateRows: `minmax(0,1fr) ${timelineCollapsed ? '42px' : 'var(--workbench-timeline-height)'}`,
      } as React.CSSProperties
  return (
    <section
      className={cn(
        'workbench-generation',
        'grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_var(--workbench-timeline-height)]',
        'w-full h-full overflow-hidden bg-[var(--workbench-bg)]',
        aiSidebar && aiLayout === 'overlay' && 'relative grid-cols-[minmax(0,1fr)]',
      )}
      style={sidebarStyle}
      data-has-ai={aiSidebar ? 'true' : 'false'}
      data-ai-layout={aiSidebar ? aiLayout : 'none'}
      aria-label="生成区"
    >
      <div className={cn(
        'workbench-generation__canvas',
        'min-w-0 min-h-0 overflow-hidden border-b border-[var(--workbench-border)]',
        'relative',
      )}>
        {canvas}
      </div>
      {aiSidebar ? (
        <aside className={cn(
          'workbench-generation__ai relative',
          'grid min-w-0 min-h-0 overflow-hidden border-b border-[var(--workbench-border)]',
          aiLayout === 'overlay'
            ? 'absolute top-4 right-4 z-[80] block w-auto h-auto border-0 bg-transparent pointer-events-auto'
            : 'border-l border-l-[var(--workbench-border)] bg-[var(--workbench-surface)]',
        )} aria-label="生成区 AI 侧栏">
          {/* 左缘拖手柄：仅停靠态显示。 */}
          {aiLayout === 'sidebar' ? (
            <div
              role="separator"
              aria-label="拖动调整助手宽度"
              aria-orientation="vertical"
              className={cn(
                'group absolute left-0 top-0 bottom-0 z-10 w-2 -translate-x-1/2',
                'flex cursor-col-resize items-center justify-center touch-none',
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <span className={cn('h-8 w-[3px] rounded-full bg-nomi-ink-30 group-hover:bg-nomi-accent')} />
            </div>
          ) : null}
          {aiSidebar}
        </aside>
      ) : null}
      <div className={cn(
        'workbench-generation__timeline',
        'relative col-span-full min-w-0 min-h-0',
      )}>
        {timelineCollapsed ? (
          <section
            className={cn(
              'workbench-generation__timeline-collapsed',
              'grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3',
              'border-t border-[var(--workbench-border)] bg-[var(--workbench-surface-solid)] px-4',
              'shadow-[0_-1px_0_var(--workbench-bevel)]',
            )}
            aria-label="生成时间轴已收起"
          >
            <div className={cn('inline-flex min-w-0 items-center gap-2 text-workbench-muted')}>
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-[var(--workbench-control-radius)]',
                  'bg-[var(--workbench-surface-soft)] text-workbench-muted',
                )}
                aria-hidden="true"
              >
                <IconMovie size={15} stroke={1.8} />
              </span>
              <span className="truncate text-body-sm font-medium text-workbench-ink">生成时间轴</span>
            </div>
            <WorkbenchIconButton
              className="size-8"
              label="展开生成时间轴"
              icon={<IconChevronUp size={15} />}
              onClick={() => setTimelineCollapsed(false)}
            />
          </section>
        ) : (
          <TimelinePanel
            density="compact"
            regionLabel="生成时间轴"
            actionLabelPrefix="生成时间轴-"
            onCollapse={() => setTimelineCollapsed(true)}
          />
        )}
      </div>
    </section>
  )
}
