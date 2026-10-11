import { afterEach, expect, it, vi } from 'vitest'
import { publicFetch } from '../scripts/public-fetch'

const dns = vi.hoisted(() => ({
  lookup:
    vi.fn<
      (
        hostname: string,
        options: { all: true }
      ) => Promise<{ address: string; family: number }[]>
    >()
}))
vi.mock('node:dns/promises', () => dns)
const lookup = dns.lookup
const href = (input: Parameters<typeof fetch>[0]) =>
  input instanceof Request
    ? input.url
    : input instanceof URL
      ? input.href
      : input
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(lookup).mockReset()
})

it('validates DNS for each redirect destination before issuing the next fetch', async () => {
  const events: string[] = []
  vi.mocked(lookup).mockImplementation(async (hostname) => {
    events.push('dns:' + hostname)
    return [
      {
        address: hostname === 'private.example.com' ? '10.0.0.1' : '1.1.1.1',
        family: 4
      }
    ]
  })
  const cancel = vi.fn<() => void>()
  const fetcher = vi.fn<typeof fetch>(async (input, options) => {
    events.push('fetch:' + new URL(href(input)).hostname)
    expect(options?.redirect).toBe('manual')
    return new Response(new ReadableStream({ cancel }), {
      status: 302,
      headers: { location: 'https://private.example.com/secret' }
    })
  })
  vi.stubGlobal('fetch', fetcher)
  await expect(publicFetch('https://public.example.com/start')).rejects.toThrow(
    'public address'
  )
  expect(events).toEqual([
    'dns:public.example.com',
    'fetch:public.example.com',
    'dns:private.example.com'
  ])
  expect(cancel).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenCalledOnce()
})

it('rejects mixed public/private DNS answers and unsupported destinations before fetching', async () => {
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetcher)
  vi.mocked(lookup).mockResolvedValue([
    { address: '1.1.1.1', family: 4 },
    { address: '127.0.0.1', family: 4 }
  ])
  await expect(publicFetch('https://mixed.example.com')).rejects.toThrow(
    'public address'
  )
  for (const url of [
    'file:///tmp/example',
    'https://user:password@example.com'
  ])
    await expect(publicFetch(url)).rejects.toThrow('Unsupported preview URL')
  expect(fetcher).not.toHaveBeenCalled()
})

it('resolves relative public redirects and returns the destination response', async () => {
  vi.mocked(lookup).mockResolvedValue([{ address: '1.1.1.1', family: 4 }])
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(null, { status: 301, headers: { location: '/final' } })
    )
    .mockResolvedValueOnce(new Response('Public preview'))
  vi.stubGlobal('fetch', fetcher)
  const response = await publicFetch('https://example.com/start')
  expect(await response.text()).toBe('Public preview')
  expect(fetcher.mock.calls.map(([url]) => href(url))).toEqual([
    'https://example.com/start',
    'https://example.com/final'
  ])
  expect(vi.mocked(lookup).mock.calls).toEqual([
    ['example.com', { all: true }],
    ['example.com', { all: true }]
  ])
})
