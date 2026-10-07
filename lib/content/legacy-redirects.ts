// Rows of the tool tables in /javascript-dev-tools-in-2022. The legacy site
// published each row as its own top-level page.
const devToolSlugs = [
  'babel',
  'create-react-app',
  'esbuild',
  'microbundle',
  'nextjs',
  'npm',
  'nuxtjs',
  'nx',
  'parcel',
  'pnpm',
  'preconstruct',
  'remix',
  'rollup',
  'snowpack',
  'sveltekit',
  'swc',
  'tsc',
  'tsdx',
  'tsup',
  'unbuild',
  'vite',
  'webpack',
  'yarn-berry',
  'yarn-classic'
]

// Top-level paths from the legacy site that still receive search traffic or
// inbound links, mapped to their closest current page. These slugs are
// reserved so content can never be shadowed by a redirect. Legacy pages
// without a current equivalent intentionally remain 404s.
export const legacyRedirects = {
  transitivebullshit: '/',
  about: '/',
  contact: '/',
  // Blank legacy notes page that ranked for the site name.
  '3aab2f4a9ead49528efa71fdc5141d54': '/',
  'awesome-js-modules': '/javascript-modules-worth-using',
  'saasify-developer-experience-dx': '/projects/saasify',
  'saasify-status': '/projects/saasify',
  'subscription-billing-for-saasify': '/projects/saasify',
  ...Object.fromEntries(
    devToolSlugs.map((slug) => [slug, '/javascript-dev-tools-in-2022'])
  )
} satisfies Record<string, string>
