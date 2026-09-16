# Site metadata

Verified 2026-09-16 against the production build: 61 canonical pages (36 articles, 22 projects, three main pages).

- `/sitemap.xml` already existed and includes every canonical page. `/llms.txt` already included articles and projects; it now also links the main pages and sitemap. `/robots.txt` advertises the sitemap.
- All pages have canonical URLs, Open Graph and Twitter titles, descriptions, and images. Main pages use `lib/metadata.ts`; explicitly supplying each page's social fields avoids Next.js's shallow metadata inheritance.
- Articles retain their versioned Takumi cards and BlogPosting JSON-LD. Project covers remain their social images, with the default card for missing covers. Project structured-data URLs use the current `/projects/[slug]` routes.
- JSON-LD includes the site and owner, homepage WebPage, listing CollectionPages with ItemLists, and project CreativeWorks. Project author names come from the snapshot; missing names and publication dates are omitted. CreativeWork accommodates the mix of software and other projects without inventing application-specific fields. See [CreativeWork](https://schema.org/CreativeWork) and [CollectionPage](https://schema.org/CollectionPage).
- `public/social-image.jpg` is a 1200 × 630 portrait card (40,506 bytes). Social image URLs follow the existing deployment-origin policy; canonical page URLs use `site.origin`.
- Icons were resized from the supplied 1024px PNG (1,335,984 bytes): `app/icon.png` is 192px / 20,097 bytes; `app/favicon.ico` contains 16, 32, and 48px frames / 9,884 bytes; `app/apple-icon.png` is 180px / 17,332 bytes. Next.js emits the icon links automatically.

Validation: formatting, lint, types, all 87 tests, and Next.js production compilation/prerendering pass. The generated HTML audit checked all 61 pages for canonical URLs, social fields, matching OG/Twitter images, parseable page-specific JSON-LD, and favicon/PNG links. Sitemap URLs are unique and cover exactly those pages; llms links every page. Image dimensions and ICO frames were inspected, and the default social card was visually reviewed.

The build's final `tsx` launcher hit a sandbox IPC restriction. Running the same bundle verification with `node --import tsx scripts/verify-social-image-bundle.ts` passed. No deployment or live crawler validation was performed.
