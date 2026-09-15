import Link from 'next/link'

export default function NotFound() {
  return (
    <main id='main' className='home'>
      <h1>Page not found</h1>
      <p className='home-intro'>This page is no longer here.</p>
      <p className='mt-8'>
        <Link href='/'>Back to writing →</Link>
      </p>
    </main>
  )
}
