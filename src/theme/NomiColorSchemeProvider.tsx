import React from 'react'
import {
  applyNomiColorScheme,
  getSystemColorScheme,
  hasStoredColorScheme,
  NomiColorSchemeContext,
  normalizeColorScheme,
  persistColorScheme,
  resolveInitialColorScheme,
  type NomiColorScheme,
  type NomiColorSchemeContextValue,
} from './colorScheme'

export function NomiColorSchemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [colorScheme, setColorSchemeState] = React.useState<NomiColorScheme>(() => resolveInitialColorScheme())

  const setColorScheme = React.useCallback((scheme: NomiColorScheme) => {
    const normalized = normalizeColorScheme(scheme)
    persistColorScheme(normalized) // 显式选择即写盘——OS 偏好从此不再覆盖。
    setColorSchemeState(normalized)
  }, [])

  React.useEffect(() => {
    applyNomiColorScheme(colorScheme)
  }, [colorScheme])

  // 跟随系统：仅在用户未显式选过时，OS 切换深/浅色实时跟随。
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (hasStoredColorScheme()) return
      setColorSchemeState(getSystemColorScheme())
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const value = React.useMemo<NomiColorSchemeContextValue>(() => ({
    colorScheme,
    isDark: colorScheme === 'dark',
    setColorScheme,
    toggleColorScheme: () => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark'),
  }), [colorScheme, setColorScheme])

  return (
    <NomiColorSchemeContext.Provider value={value}>
      {children}
    </NomiColorSchemeContext.Provider>
  )
}
