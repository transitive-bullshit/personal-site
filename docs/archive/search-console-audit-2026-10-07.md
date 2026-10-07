# Google Search Console audit — October 7, 2026

> Historical record. Reviewed through the Search Console UI as fisch0920@gmail.com (authuser 0). GSC data was last updated Oct 4–7. HTTP results are live checks from Oct 7. This audit changed no code, DNS, or Search Console settings.

Properties: `sc-domain:transitivebullsh.it`, `sc-domain:cultural-alignment.com`, `sc-domain:doom-or-bloom.com`. None has a manual action or a security issue.

## transitivebullsh.it

Over 16 months: 463 clicks, 134K impressions, average position 23.2. Last 3 months compared with the 3 before: clicks 36 vs 53, impressions 11.1K vs 29.3K. Only 115 of the property's 500 known URLs are indexed. Most of the rest are intentional subdomain exclusions (see "Noise" below).

### 1. The apex→www switch has not been picked up

`site.origin` moved to `https://www.transitivebullsh.it` on Sep 16 (f5ed11f). Filtered to the sitemap, 29 of 67 URLs are indexed. The other 38 are **Discovered – currently not indexed with no crawl yet**. They include `agentic-spectrum`, `ai-agents`, `chatgpt-twitter-bot-lessons`, `scraping-the-web-with-nodejs`, `ionic-vs-react-native`, `creator-economy-101`, `internet-diet` and 9 project pages. URL Inspection shows the www URLs as never crawled, while the apex versions are still indexed. The apex versions return 308 to www, so visitors still land correctly.

The only submitted sitemap is `https://transitivebullsh.it/sitemap.xml`, submitted in April 2022. It now redirects to the www sitemap. Inspection of www URLs reports "No referring sitemaps detected".

Action (Search Console only, no code):

- Submit `https://www.transitivebullsh.it/sitemap.xml`.
- Request indexing for the top www URLs listed above.
- Keep the apex sitemap submitted so Google recrawls the redirects.

### 2. Legacy URLs that still get search demand now 404

These apex URLs had impressions over 16 months. Each now returns a 308 to a www URL that 404s.

| URL | Clicks / impressions / position | Suggestion |
| --- | --- | --- |
| `/about` | 6 / 1,309 / 6.0 | 308 → `/`. `about` is a reserved slug with no page. |
| `/3aab2f4a9ead49528efa71fdc5141d54` | 23 / 356 / 4.6 | Ranks for "transitive bullshit"; still got 6 clicks last quarter. 308 → `/` |
| `/contact` | 0 / 301 / 5.1 | 308 → `/` |
| `/image-charts`, `/webassembly-research`, `/spotify-power-tools` (3 clicks), `/modern-web-a11y` (2 clicks), `/subscription-billing-for-saasify`, `/social-user-prospect-mapping`, `/notes`, `/micro-saas-categories`, `/puppet-master` | 1,179 down to 127 impressions each | Owner decision: restore, redirect to the closest page, or leave as 404 |
| `/microbundle`, `/tsc`, `/unbuild`, `/swc`, `/tsdx`, `/nx`, `/preconstruct`, `/yarn-berry`, `/babel` | 162 down to 8 impressions each | These are probably former subpages of `javascript-dev-tools-in-2022`. If so, redirect them there. |
| `/tags/startups`, `/tags/projects`, `/tags/typescript` | 30 down to 1 impressions each | 308 → `/writing` |

`app/[slug]/page.tsx:68` already redirects `/transitivebullshit` to the homepage. The `/about`, `/contact` and `/3aab…` redirects can go in the same place. Several other 404s are other people's Notion pages that the old site rendered by ID, such as `/quickchart-pro-sla`, `/kontakta-oss` and `/finding-safety-and-beauty-in-colombia-…`. Those 404s are correct.

### 3. `blog.transitivebullsh.it` points at nothing

DNS has `blog` as a CNAME to `alias.zeit.co`, but every path returns Vercel `DEPLOYMENT_NOT_FOUND` (404). Until June, Search Console recorded `/automagical-architecture/` there as a redirect.

"Mastering the Art of NPM" still links to `blog.transitivebullsh.it/awesome-js-modules/`. Either:

- attach the subdomain to this project with a path-preserving redirect to www, or
- remove the DNS record and fix the link in Notion.

### 4. Smaller items

- **Homepage title.** It is "Transitive Bullshit". The only query with meaningful clicks is "travis fischer" (85 clicks, 1,723 impressions, position 4.3), so consider putting the name in the title.
- **Side-project 500s, reproduced Oct 7:**
  - `severance.transitivebullsh.it/x/BarackObama` returns 500 after 7.4 s.
  - `next-movie.transitivebullsh.it/titles/1422` and `/titles/274` return 500.
  - `twitter-search.transitivebullsh.it/api/get-index` returns 500. Consider disallowing `/api` there.
- **Apex host status.** It reports "server connectivity high in the past", but recent crawls are fine. No action needed.
- **Old TXT records.** DNS holds a malformed TXT record: a pasted zone-file line containing the unused `google-site-verification=CpUX…` token, which is owned by travis@transitivebullsh.it. It also holds an `ALIAS for alias.zeit.co` TXT record. Clean these up only if Workspace verification doesn't depend on them.
- **Videos.** 10 videos are flagged "not on a watch page". They are tweet videos embedded on project pages, which is expected.

### Noise / intentional

- `nextjs-notion-starter-kit.*` is blocked by robots: 35 URLs, plus 3 marked "indexed though blocked". Its traffic is other people's Notion pages.
- `nala.*`:
  - 161 URLs under "Alternate page with proper canonical tag"
  - about 55 photos under "Crawled – not indexed"
- The `react-notion-x-demo.*` and `next-movie.*` duplicates.
- Apex/http redirect entries.
- Crawled `_next` assets, `favicon.ico`, `index.md` and `/api/social-image?id=` URLs.

## cultural-alignment.com

The sitemap was submitted Sep 2. Of its 857 URLs, 714 are indexed (83%). 85 are "Crawled – not indexed", and a validation of those has **Failed**. 58 are "Discovered", with validation Started. Since launch the site has 9 clicks and 2.21K impressions at position 15. Crawl health is clean (99% of responses are 200).

1. **The hub pages render no content on the server.** In server HTML:
   - `/` has 0 scenario links and about 12 words in `<main>`.
   - `/scenarios` has no H1, about 43 words, and only 5 links: the family filters.
   - `/scenarios/family/*` look the same.

   Cause: `features/spatial-gallery/spatial-gallery.tsx` starts in `renderMode='checking'` and server-renders only `CanvasLoading`. Its list fallback exists only on the client. (The `BAILOUT_TO_CLIENT_SIDE_RENDERING` marker comes from `<Analytics/>` and is harmless.) Accordingly, `/scenarios`, `/concepts`, `/risk-families` and `/about` are "Crawled – not indexed", and `/franchises` and every `/scenarios/family/*` page are "Discovered". Fix: server-render the scenario list (links, plus an H1) as the default and enhance it with WebGL on the client.

2. **Duplicate family pages.** `/scenarios/family/misalignment` is a thin duplicate of `/risk-families/misalignment`, which has an H1 and 431 words. Canonicalize or redirect the family filter pages to `/risk-families/*`, or drop them from the sitemap.
3. **Titles and descriptions:**
   - The site ranks at position 64 for its own name, "cultural alignment". The homepage title is just "Cultural Alignment"; add a descriptor.
   - Scenario titles such as "Andor / Cassian’s Arrest" leave out the brand because of `title.absolute` in `lib/content/social-metadata.ts:106`.
   - Concept and source descriptions are boilerplate: "…that illustrate goodhart’s law…" with the name lowercased, and "Examples of AI Safety from Gattaca."
   - Source pages are thin, at about 160 words.

   Together these are the likely cause of the 85 crawled-not-indexed detail pages.

4. **Temporary www redirect.** `www.cultural-alignment.com` returns **307**. Make it a permanent (308) redirect in Vercel domain settings.

## doom-or-bloom.com

The sitemap was submitted Oct 2. Of its 213 URLs, 65 are indexed. 146 are "Discovered" (119 of those are `/users/*`). Since about Sep 30 the site has 7 clicks and 159 impressions, with a 4.4% CTR and average position 7.9. Crawl health is clean, and the breadcrumbs and dataset structured data are valid.

- **The 12 "noindex" URLs are intentional.** Pages like `/de/p-doom`, `/de/blog` and `/fr/users/*` canonicalize to English and are not in the sitemap. The sitemap's hreflang entries only reference indexable localized pages.
- **Mostly waiting on Google.** Request indexing for `/p-doom`, a 3.9K-word page that is still "Discovered".
- **Minor:**
  - `/blog` and `/users` are "Crawled – not indexed"; `/blog` has about 215 words.
  - `/$` and `/&` 404 because Google extracted junk URLs. No action needed.

## Follow-up actions — October 8, 2026

- **Search Console:**
  - Submitted `https://www.transitivebullsh.it/sitemap.xml` and resubmitted the doom-or-bloom sitemap.
  - Requested indexing on transitivebullsh.it for `agentic-spectrum`, `ai-agents`, `chatgpt-twitter-bot-lessons`, `scraping-the-web-with-nodejs`, `ionic-vs-react-native`, `creator-economy-101`, `the-social-audio-revolution`, `a-guide-to-finding-awesome-co-founders` and `why-im-so-hyped-about-the-passion-economy`.
  - Requested indexing on doom-or-bloom for `/p-doom`, `/users` and `/blog`.
  - The daily per-account quota blocked `/internet-diet` and doom-or-bloom's `/blog/hacker-news-vs-x`.
  - By Oct 8, `/p-doom`, `/users`, `/blog`, `/blog/hacker-news-vs-x`, `www…/scraping-the-web-with-nodejs` and `www…/a-guide-to-finding-awesome-co-founders` were already indexed.
- **Vercel:**
  - Added `blog.transitivebullsh.it` to `personal-site` as a 308 redirect to `www.transitivebullsh.it`.
  - Added `www.cultural-alignment.com` to `cultural-alignment` as a 308 redirect to the apex. Before this, the unattached host returned Vercel's default 307.
- **Legacy URLs:** most legacy 404s were pages under the private "Misc / Notes" Notion page that the old site rendered publicly. `/3aab…` is a blank row in its "Image Charts → Competitor Pricing" table. These stay 404. Only paths with a current successor redirect; see `lib/content/legacy-redirects.ts`.
- **Content:** "Mastering the Art of NPM" now links to `/javascript-modules-worth-using` instead of the dead blog subdomain.
