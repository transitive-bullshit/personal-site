import { websiteMetadata } from '@/lib/metadata'
import { JsonLd } from '@/components/json-ld'
import { siteJsonLd } from '@/lib/content/metadata'
import SiGithub from '@icons-pack/react-simple-icons/icons/SiGithub'
import SiX from '@icons-pack/react-simple-icons/icons/SiX'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import Link from 'next/link'
import { LinkPreviewProvider } from '@/components/link-preview-provider'
import { SiteSearch } from '@/components/site-search'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { internalLinkPreviews } from '@/lib/content/link-previews'
import { site } from '@/lib/site'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  ...websiteMetadata(site.name, site.description, '/'),
  title: { default: site.name, template: '%s · ' + site.name }
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en' data-scroll-behavior='smooth' suppressHydrationWarning>
      <body>
        <JsonLd data={siteJsonLd} />
        <ThemeProvider
          attribute='class'
          defaultTheme='dark'
          enableSystem
          disableTransitionOnChange
        >
          <a href='#main' className='skip-link'>
            Skip to content
          </a>
          <div className='site-shell'>
            <header className='site-header'>
              <Link className='site-brand' href='/'>
                TransitiveBullsh.it
              </Link>
              <nav className='site-header-nav' aria-label='Main navigation'>
                <Link href='/projects'>Projects</Link>
                <Link href='/writing'>Writing</Link>
              </nav>
              <div className='site-header-actions'>
                <Button variant='ghost' size='icon-sm' asChild>
                  <a
                    href='https://x.com/transitive_bs'
                    target='_blank'
                    rel='noreferrer'
                    aria-label='X (opens in a new tab)'
                    title='X'
                  >
                    <SiX aria-hidden='true' data-icon='inline-start' title='' />
                  </a>
                </Button>
                <Button variant='ghost' size='icon-sm' asChild>
                  <a
                    href='https://github.com/transitive-bullshit'
                    target='_blank'
                    rel='noreferrer'
                    aria-label='GitHub (opens in a new tab)'
                    title='GitHub'
                  >
                    <SiGithub
                      aria-hidden='true'
                      data-icon='inline-start'
                      title=''
                    />
                  </a>
                </Button>
                <ThemeToggle />
                <SiteSearch />
              </div>
            </header>
            {children}
            <footer className='site-footer'>
              <span>Travis Fischer · Transitive Bullshit</span>
              <div className='site-footer-actions'>
                <Link href='/projects'>Projects</Link>
                <Link href='/writing'>Writing</Link>
                <ThemeToggle />
              </div>
            </footer>
          </div>
          <LinkPreviewProvider internalPreviews={internalLinkPreviews} />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
