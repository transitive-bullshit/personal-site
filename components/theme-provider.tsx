'use client'

import { bind } from 'cuelume'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect, type ComponentProps } from 'react'

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  useEffect(() => {
    bind()
  }, [])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
