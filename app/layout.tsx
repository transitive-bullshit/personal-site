import type { Metadata } from 'next'
import Link from 'next/link'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { site } from '@/lib/site'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  title: { default: site.name, template: '%s · ' + site.name },
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title: site.name,
    description: site.description,
    url: site.origin,
    siteName: site.name
  },
  twitter: { card: 'summary_large_image', creator: '@' + site.twitter }
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en' data-scroll-behavior='smooth' suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <a href='#main' className='skip-link'>
            Skip to content
          </a>
          <div className='site-shell'>
            <header className='site-header'>
              <Link className='site-brand' href='/'>
                Travis Fischer
              </Link>
              <div className='site-header-actions'>
                <nav aria-label='Main navigation'>
                  <Link href='/'>Writing</Link>
                  <a href='https://github.com/transitive-bullshit'>GitHub</a>
                  <a href='https://x.com/transitive_bs'>X</a>
                </nav>
                <ThemeToggle />
              </div>
            </header>
            {children}
            <footer className='site-footer'>
              <span>Travis Fischer · Transitive Bullshit</span>
              <div className='site-footer-actions'>
                <Link href='/'>All writing</Link>
                <ThemeToggle />
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
