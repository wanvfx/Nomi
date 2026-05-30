/**
 * 模型设置悬浮卡片。
 *
 * 用户反馈：DesignDrawer 420px 全屏高 + 背景 dim → "大幅度遮挡"。
 * 改成：右上角浮卡，320px 宽，按内容自适应高度（max-height 70vh），
 * 无背景遮罩；点外部 / Escape 关闭。
 *
 * Workspace 在悬浮卡片打开时仍然可见 + 可操作（不 dim）。
 */
import React from 'react'
import { Portal } from '@mantine/core'
import { OnboardingDrawer } from './OnboardingDrawer'

const PANEL_WIDTH = 320
const TOP_OFFSET = 64    // 留出 AppBar (56px) + 一点空隙
const RIGHT_OFFSET = 12

type Props = {
  opened: boolean
  onClose: () => void
}

export function OnboardingFloatingPanel({ opened, onClose }: Props): JSX.Element | null {
  const panelRef = React.useRef<HTMLDivElement>(null)

  // ESC 关闭
  React.useEffect(() => {
    if (!opened) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [opened, onClose])

  // 点击外部关闭
  React.useEffect(() => {
    if (!opened) return
    const handler = (e: MouseEvent) => {
      if (!panelRef.current) return
      if (panelRef.current.contains(e.target as Node)) return
      onClose()
    }
    // 延迟一帧绑定，避免触发"打开按钮"的同次 click 立刻关闭
    const id = window.requestAnimationFrame(() => {
      window.addEventListener('mousedown', handler)
    })
    return () => {
      window.cancelAnimationFrame(id)
      window.removeEventListener('mousedown', handler)
    }
  }, [opened, onClose])

  if (!opened) return null

  return (
    <Portal>
      <div
        ref={panelRef}
        role="dialog"
        aria-label="模型设置"
        style={{
          position: 'fixed',
          top: TOP_OFFSET,
          right: RIGHT_OFFSET,
          width: PANEL_WIDTH,
          maxHeight: `calc(100vh - ${TOP_OFFSET + 16}px)`,
          background: 'var(--nomi-paper)',
          borderRadius: 'var(--nomi-radius-lg)',
          boxShadow: 'var(--nomi-shadow-lg)',
          zIndex: 4000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          // 进入动画
          animation: 'nomi-panel-pop 140ms cubic-bezier(.2, .7, .3, 1)',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <OnboardingDrawer />
        </div>
        <style>{`
          @keyframes nomi-panel-pop {
            from { opacity: 0; transform: translateY(-4px) scale(0.985); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </Portal>
  )
}
