'use client'

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'

const themes = {
  system: { label: 'System', icon: MonitorIcon },
  light: { label: 'Light', icon: SunIcon },
  dark: { label: 'Dark', icon: MoonIcon }
} as const

type ThemeName = keyof typeof themes

const nextThemes = {
  system: 'light',
  light: 'dark',
  dark: 'system'
} as const satisfies Record<ThemeName, ThemeName>

const emptySubscribe = () => () => {}

function isThemeName(theme: string | undefined): theme is ThemeName {
  return theme !== undefined && Object.hasOwn(themes, theme)
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
  const currentTheme = mounted && isThemeName(theme) ? theme : 'system'
  const current = themes[currentTheme]
  const nextTheme = nextThemes[currentTheme]
  const next = themes[nextTheme]
  const Icon = current.icon
  const label = `${current.label} theme. Switch to ${next.label.toLowerCase()} theme`

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      aria-label={label}
      title={label}
      data-cuelume-toggle='toggle'
      onClick={() => setTheme(nextTheme)}
    >
      <Icon aria-hidden='true' data-icon='inline-start' />
    </Button>
  )
}
