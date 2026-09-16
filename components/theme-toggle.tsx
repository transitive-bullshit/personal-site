'use client'

import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'

const themes = {
  light: { label: 'Light Mode', icon: SunIcon },
  dark: { label: 'Dark Mode', icon: MoonIcon }
} as const

type ThemeName = keyof typeof themes

const nextThemes = {
  light: 'dark',
  dark: 'light'
} as const satisfies Record<ThemeName, ThemeName>

const emptySubscribe = () => () => {}

function isThemeName(theme: string | undefined): theme is ThemeName {
  return theme !== undefined && Object.hasOwn(themes, theme)
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
  const currentTheme =
    mounted && isThemeName(resolvedTheme) ? resolvedTheme : undefined
  const current = currentTheme ? themes[currentTheme] : undefined
  const nextTheme = currentTheme ? nextThemes[currentTheme] : 'dark'
  const next = themes[nextTheme]
  const Icon = current?.icon
  const label = current
    ? `${current.label}. Switch to ${next.label}`
    : 'Switch color mode'

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon-sm'
      aria-label={label}
      title={label}
      disabled={!currentTheme}
      data-cuelume-toggle='toggle'
      onClick={() => setTheme(nextTheme)}
    >
      {Icon ? <Icon aria-hidden='true' data-icon='inline-start' /> : null}
    </Button>
  )
}
