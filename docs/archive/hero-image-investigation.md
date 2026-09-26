# Hero timing investigation and tweet avatar optimization

> Historical record. See [the archive index](README.md) for status and current guidance. Counts, validation results, and proposals below describe the original work.

## Result

Tweet avatars now use Next Image with the existing 48px display dimensions, selecting a 96px optimized rendition on the tested high-density displays. Passage avatar transfer fell from 22,352 to 1,684 bytes (92.5%). The remote allowlist is restricted to HTTPS pbs.twimg.com/profile_images, with no query strings. Unrecognized source shapes retain their original rendering, and optimizer/upstream failures fall back to the original avatar. A forced local 503 verified that fallback loads successfully.

The proposed hero placeholder change was **tested and reverted**. There is no confirmed hero-LCP fix in this change. Existing eager/high-priority loading, blur placeholders, and loaded-card navigation fallback are preserved.

## Controlled comparison

Three sequential Lighthouse 13.4.1 mobile runs per page on local production builds, before and after removing blur from eager images. The experimental build also included the avatar change; the article has no tweet avatar and served as an unaffected control for that change. This is a small local lab sample, not a statistical experiment or a prediction of production scores.

| Page | Baseline LCP median | Experimental LCP median | Performance median | Decision |
| --- | --- | --- | --- | --- |
| Passage | 2.627s | 2.700s | 97 → 96 | No gain; revert placeholder change |
| Agentic Spectrum | 3.092s | 2.996s | 94 → 95 | Small difference within run variation |

Observed local render delays were only tens to low hundreds of milliseconds, not the approximately one-second delays in the earlier production run. No evidence supports attributing that production behavior solely to the blur or new project fallback. Next renders blur as a background and removes it after client decoding; it does not simply hide the actual image until hydration.

## Individual experimental reports

“After” here means the discarded empty-placeholder experiment plus optimized avatars, **not** the final avatar-only patch. Local Vercel telemetry-script 404s occur in both variants because standalone Next does not serve those platform endpoints.

| Page/run | Baseline | Experiment |
| --- | --- | --- |
| project 1 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/project-1.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/project-1.report.json) | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/project-1.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/project-1.report.json) |
| project 2 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/project-2.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/project-2.report.json) | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/project-2.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/project-2.report.json) |
| project 3 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/project-3.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/project-3.report.json) | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/project-3.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/project-3.report.json) |
| article 1 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/article-1.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/article-1.report.json) | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/article-1.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/article-1.report.json) |
| article 2 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/article-2.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/article-2.report.json) | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/article-2.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/article-2.report.json) |
| article 3 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/article-3.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/before/article-3.report.json) | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/article-3.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/after/article-3.report.json) |

## Production trace follow-up

A separate run with actual DevTools throttling measured Passage LCP at 2.1s and TBT at 60ms. It is **not comparable directly** to the previous simulated-throttling scores. Its final image LCP candidate had zero image-discovery/load timestamps, while the real hero network request finished later (about 2.55s). Consequently that run’s 1.93s “render delay” is not a clean measurement of elapsed time after the full hero downloaded. It is consistent with the inline placeholder being selected as the candidate. The evidence does not justify shipping a placeholder removal or extra preload as a proven fix.

[Production result JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/production-measured) · [Chrome trace](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/production-measured-0.trace.json) · [Network log](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/hero-investigation/production-measured-0.devtoolslog.json).

Next investigation, if warranted by real mobile traffic: collect element-timing data for the final decoded hero and compare with LCP, then isolate CSS delivery and resource competition on a deployed preview. Keep the useful navigation fallback. [LCP subpart guidance](https://web.dev/articles/optimize-lcp), [Next Image guidance](https://nextjs.org/docs/app/api-reference/components/image).

## Final validation

All 94 unit tests, format/lint/types, production build, and native image bundle verification pass after reverting the experiment. Browser checks confirm the optimized 96px avatar displays at 48×48 and the original 48px image loads when optimization fails. No production deployment was made.
