# CyberSwarm external preview audit — October 12, 2026

Checked all 36 distinct external URLs in the code-owned essay through the deployed metadata API and, where advertised, its image proxy. This is a point-in-time audit before the local preview change, not a guarantee of future upstream availability.

- 21 URLs returned metadata and a working image.
- 7 returned unavailable metadata: Daybreak, Defense Factory, Collective Cyberdefense, the FBI NotPetya speech, and three PDFs.
- 5 returned metadata without an image: two URL variants of the Mandia YouTube video, D-Link SAP10488, OpenAI’s DNS incident report, and the arXiv paper.
- 3 GitHub mod URLs returned metadata but their shared repository image failed through the deployed proxy. The CDN image returned HTTP 200 locally; the production failure cause remains unconfirmed.

Direct requests using the preview fetcher’s user agent confirmed HTTP 403 with `cf-mitigated: challenge` for all three openai.com pages and the FBI page. PDF rejection follows the HTML-only preview contract. Text-only responses do not by themselves establish that the source lacks metadata in a full browser.

All 15 affected URLs now resolve to saved previews: 14 destinations plus the timestamped YouTube variant. Published images are saved for the three OpenAI pages, the GitHub repository, and the video; text-only pages, the FBI speech, and all three PDFs use authored title/publisher cards. Every asset is 1200×630. Unsaved links also receive rendered fallbacks when metadata or images are unavailable. See [Metadata](../metadata.md#external-hover-previews) for ownership and provenance. The table below preserves the original production observations.

| URL | Metadata API | Image proxy |
| --- | --- | --- |
| [alignment.openai.com/misalignment-reports/an-agent-used-dns-to-reach-an-external-chatbot/](https://alignment.openai.com/misalignment-reports/an-agent-used-dns-to-reach-an-external-chatbot/) | 200 | No image returned |
| [arxiv.org/html/2512.08296v3](https://arxiv.org/html/2512.08296v3) | 200 | No image returned |
| [blog.cloudflare.com/build-your-own-vulnerability-harness/](https://blog.cloudflare.com/build-your-own-vulnerability-harness/) | 200 | 200 |
| [blog.mozilla.org/en/firefox/privacy-security/ai-security-zero-day-vulnerabilities/](https://blog.mozilla.org/en/firefox/privacy-security/ai-security-zero-day-vulnerabilities/) | 200 | 200 |
| [cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf](https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf) | 422 | No image returned |
| [cloud.google.com/blog/topics/threat-intelligence/vulnerability-discovery-and-exploitation-trends-in-the-ai-era](https://cloud.google.com/blog/topics/threat-intelligence/vulnerability-discovery-and-exploitation-trends-in-the-ai-era) | 200 | 200 |
| [darioamodei.com/essay/the-adolescence-of-technology](https://darioamodei.com/essay/the-adolescence-of-technology) | 200 | 200 |
| [deepmind.google/fairwind-program/](https://deepmind.google/fairwind-program/) | 200 | 200 |
| [epoch.ai/data/cve](https://epoch.ai/data/cve) | 200 | 200 |
| [epoch.ai/publications/the-plunging-price-of-thought](https://epoch.ai/publications/the-plunging-price-of-thought) | 200 | 200 |
| [github.com/rehan-remade/universal-modder/blob/main/knowledge/games/elden-ring/cs2-conversion-of-elden-ring-offline-native-rust-dll-via-me3.md](https://github.com/rehan-remade/universal-modder/blob/main/knowledge/games/elden-ring/cs2-conversion-of-elden-ring-offline-native-rust-dll-via-me3.md) | 200 | 422 |
| [github.com/rehan-remade/universal-modder/blob/main/knowledge/games/halo-3-mcc/halo-3-weapons-covenant-vehicles-and-maps-ported-into-minecr.md](https://github.com/rehan-remade/universal-modder/blob/main/knowledge/games/halo-3-mcc/halo-3-weapons-covenant-vehicles-and-maps-ported-into-minecr.md) | 200 | 422 |
| [github.com/rehan-remade/universal-modder/blob/main/knowledge/games/terraria/eye-of-cthulhu-rl-agent.md](https://github.com/rehan-remade/universal-modder/blob/main/knowledge/games/terraria/eye-of-cthulhu-rl-agent.md) | 200 | 422 |
| [huggingface.co/blog/agent-intrusion-technical-timeline](https://huggingface.co/blog/agent-intrusion-technical-timeline) | 200 | 200 |
| [huggingface.co/blog/security-incident-july-2026](https://huggingface.co/blog/security-incident-july-2026) | 200 | 200 |
| [iot-analytics.com/number-connected-iot-devices/](https://iot-analytics.com/number-connected-iot-devices/) | 200 | 200 |
| [metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/) | 200 | 200 |
| [nvlpubs.nist.gov/nistpubs/ir/2019/NIST.IR.8228.pdf](https://nvlpubs.nist.gov/nistpubs/ir/2019/NIST.IR.8228.pdf) | 422 | No image returned |
| [openai.com/collective-cyberdefense/](https://openai.com/collective-cyberdefense/) | 422 | No image returned |
| [openai.com/daybreak/](https://openai.com/daybreak/) | 422 | No image returned |
| [openai.com/the-defense-factory/](https://openai.com/the-defense-factory/) | 422 | No image returned |
| [secureacceleration.com/](https://secureacceleration.com) | 200 | 200 |
| [supportannouncement.us.dlink.com/announcement/publication.aspx](https://supportannouncement.us.dlink.com/announcement/publication.aspx?name=SAP10488) | 200 | No image returned |
| [www.afpbb.com/articles/-/3346472](https://www.afpbb.com/articles/-/3346472?cx_part=related_yahoo) | 200 | 200 |
| [www.aisi.gov.uk/blog/how-far-behind-the-frontier-are-leading-open-weight-models-on-cyber](https://www.aisi.gov.uk/blog/how-far-behind-the-frontier-are-leading-open-weight-models-on-cyber) | 200 | 200 |
| [www.anthropic.com/glasswing](https://www.anthropic.com/glasswing) | 200 | 200 |
| [www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities) | 200 | 200 |
| [www.anthropic.com/research/n-days](https://www.anthropic.com/research/n-days) | 200 | 200 |
| [www.anthropic.com/threat-intelligence-report-september-2026](https://www.anthropic.com/threat-intelligence-report-september-2026) | 200 | 200 |
| [www.astralcodexten.com/p/my-takeaways-from-ai-2027](https://www.astralcodexten.com/p/my-takeaways-from-ai-2027) | 200 | 200 |
| [www.fbi.gov/news/speeches-and-testimony/fbi-partnering-with-private-sector-to-counter-the-cyber-threat-032222](https://www.fbi.gov/news/speeches-and-testimony/fbi-partnering-with-private-sector-to-counter-the-cyber-threat-032222) | 422 | No image returned |
| [www.nist.gov/news-events/news/2026/09/caisis-assessment-zais-glm-53-cyber-capabilities](https://www.nist.gov/news-events/news/2026/09/caisis-assessment-zais-glm-53-cyber-capabilities) | 200 | 200 |
| [www.rusi.org/explore-our-research/publications/commentary/four-years-update-air-war-over-ukraine](https://www.rusi.org/explore-our-research/publications/commentary/four-years-update-air-war-over-ukraine) | 200 | 200 |
| [www.stateof.ai/State-of-AI-Report-2026.pdf](https://www.stateof.ai/State-of-AI-Report-2026.pdf) | 422 | No image returned |
| [www.youtube.com/watch](https://www.youtube.com/watch?v=cJsHel27Z6M) | 200 | No image returned |
| [www.youtube.com/watch](https://www.youtube.com/watch?v=cJsHel27Z6M&t=489s) | 200 | No image returned |
