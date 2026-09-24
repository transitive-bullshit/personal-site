import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main id='main' className='home'>
      <h1>Page not found</h1>
      <p className='home-intro'>
        We couldn’t find that page. Head home, or explore projects and writing.
      </p>
      <nav className='not-found-actions' aria-label='Find another page'>
        <Button asChild>
          <Link href='/'>
            <ArrowLeftIcon aria-hidden='true' data-icon='inline-start' />
            Back home
          </Link>
        </Button>
        <Button variant='outline' asChild>
          <Link href='/projects'>Projects</Link>
        </Button>
        <Button variant='outline' asChild>
          <Link href='/writing'>Writing</Link>
        </Button>
      </nav>
    </main>
  )
}
