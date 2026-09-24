'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SiteNavigation({ writingPaths }: { writingPaths: string[] }) {
  const pathname = usePathname()
  const section =
    pathname === '/projects' || pathname.startsWith('/projects/')
      ? '/projects'
      : pathname === '/writing' || writingPaths.includes(pathname)
        ? '/writing'
        : undefined

  return (
    <nav className='site-header-nav' aria-label='Main navigation'>
      {[
        { href: '/projects', label: 'Projects' },
        { href: '/writing', label: 'Writing' }
      ].map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            pathname === href ? 'page' : section === href ? 'true' : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
