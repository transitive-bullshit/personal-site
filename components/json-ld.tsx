import { serializeJsonLd } from '@/lib/content/metadata'

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
