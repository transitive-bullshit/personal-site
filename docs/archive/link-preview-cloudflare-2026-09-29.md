# External preview blocked by Cloudflare — September 29, 2026

> Historical record. Current diagnostic guidance is in [Metadata](../metadata.md#external-hover-previews). Security settings and responses below describe the incident, not current service state.

The link to `https://cultural-alignment.com/scenarios/bender-jacks-on` on `/projects/burning-tokens` showed fallback text without a social image. Both local fetching and the local production API returned the correct title and 1200×630 image, while the deployed preview API failed.

Cloudflare security events identified Bot Fight Mode challenging the `PersonalSitePreview` request. The production fetcher received HTTP 403 and could not complete the browser challenge. After the user approved disabling Bot Fight Mode for that zone, production preview and image requests returned HTTP 200 and the card displayed the correct metadata. The user chose to keep it disabled at the time. No metadata or preview-parser code change was needed.

The useful diagnostic branch is production-versus-local access: verify the upstream status and security events before altering a parser that works locally.

Evidence: [original coding-session diagnosis and retest](/Users/tfischer/.codex/sessions/2026/09/29/rollout-2026-09-29T02-59-13-01a0e999-9aa4-7592-9d87-ec5f2c3c4007.jsonl:373). This machine-local log may be unavailable in other checkouts.
