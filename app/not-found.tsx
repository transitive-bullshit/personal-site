import Link from 'next/link'

export default function NotFound() {
  return (
    <main id='main' className='home'>
      <h1>Page not found</h1>
      <p className='home-intro'>This page is no longer here.</p>
      <nav className='mt-8 flex flex-wrap gap-6' aria-label='Find another page'>
        <Link href='/'>Home</Link>
        <Link href='/projects'>Projects</Link>
        <Link href='/writing'>Writing</Link>
      </nav>
    </main>
  )
}
