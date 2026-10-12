export type Source = {
  id: number
  title: string
  url: string
  note: string
  kind:
    | 'Evidence'
    | 'Practitioner account'
    | 'Forecast'
    | 'Background'
    | 'Conceptual model'
    | 'Illustrative benchmark'
}

export const title = 'AI is turning cybersecurity into drone swarm warfare'

export function sourceUrl(id: number) {
  const source = sources.find((source) => source.id === id)
  if (!source) throw new Error('Unknown cybersecurity essay source: ' + id)
  return source.url
}

export const sources: Source[] = [
  {
    id: 1,
    title: 'OpenAI — Daybreak',
    url: 'https://openai.com/daybreak/',
    kind: 'Background',
    note: 'Official defensive-access and support program.'
  },
  {
    id: 2,
    title: 'Anthropic — Project Glasswing',
    url: 'https://www.anthropic.com/glasswing',
    kind: 'Background',
    note: 'Official defensive initiative and warning about the transition. Hardening over years versus capability progress over months is the provider’s framing.'
  },
  {
    id: 3,
    title: 'Google DeepMind — Fairwind',
    url: 'https://deepmind.google/fairwind-program/',
    kind: 'Background',
    note: 'Official partner-access and defensive-support program.'
  },
  {
    id: 4,
    title: 'OpenAI — Collective cyberdefense',
    url: 'https://openai.com/collective-cyberdefense/',
    kind: 'Background',
    note: 'Explicitly recognizes under-resourced critical infrastructure and the need for coordinated defense.'
  },
  {
    id: 5,
    title: 'Mozilla — AI security and zero-day vulnerabilities',
    url: 'https://blog.mozilla.org/en/firefox/privacy-security/ai-security-zero-day-vulnerabilities/',
    kind: 'Evidence',
    note: 'Mozilla reports that Firefox 150 includes fixes for 271 vulnerabilities identified with Claude Mythos Preview. A shipped defensive improvement.'
  },
  {
    id: 6,
    title: 'Kevin Mandia — Building Cyber Defense for the Agentic Era',
    url: 'https://www.youtube.com/watch?v=cJsHel27Z6M',
    kind: 'Practitioner account',
    note: 'Full automatic transcript read. Sniper/swarm: 7:57; containment: 18:46–20:56; near-term forecast: 24:42. Armadin’s 25,000 agents are its own system, not an observed equivalent in the wild. Most of its 90-plus zero-days were human discoveries assisted by AI. a16z is an Armadin investor; company results are not independently reproduced here.'
  },
  {
    id: 7,
    title: 'Anthropic — September 2026 threat intelligence report',
    url: 'https://www.anthropic.com/threat-intelligence-report-september-2026',
    kind: 'Evidence',
    note: 'Provider-observed campaigns: GTG-50029 targeted 42 entities and accessed at least 14; GTG-50014 decompiled 1.8 million Android APKs across ten EC2 workers. Conventional tools operated within AI-assisted workflows. Selected cases, not population prevalence or pure autonomous capability.'
  },
  {
    id: 8,
    title: 'Anthropic — Exploiting n-day vulnerabilities',
    url: 'https://www.anthropic.com/research/n-days',
    kind: 'Evidence',
    note: 'Retrospective replay of old public patches in a standalone JavaScript shell with supplied builds. Under an hour is the fastest first validated SpiderMonkey exploit; 18 days is that example’s historical source-fix-to-stable-Firefox delay. Not a live-at-disclosure attack or full browser compromise.'
  },
  {
    id: 9,
    title: 'Universal Modder — Halo content ported into Minecraft',
    url: 'https://github.com/rehan-remade/universal-modder/blob/main/knowledge/games/halo-3-mcc/halo-3-weapons-covenant-vehicles-and-maps-ported-into-minecr.md',
    kind: 'Practitioner account',
    note: 'Creator-reported approximately eight-hour AI-assisted session using existing tools and shipped files. Content porting, not whole-game decompilation or a cybersecurity breach.'
  },
  {
    id: 10,
    title: 'Anthropic — GLM-5.3 and advanced cyber capability diffusion',
    url: 'https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities',
    kind: 'Evidence',
    note: 'Provider assessment of an open-weight competitor in controlled exploit tasks. Supports diffusion; does not establish general open/closed parity or end-to-end campaign equivalence.'
  },
  {
    id: 11,
    title: 'Cloudflare — Build your own vulnerability harness',
    url: 'https://blog.cloudflare.com/build-your-own-vulnerability-harness/',
    kind: 'Illustrative benchmark',
    note: 'North Star workflow for one roughly 30k-line repository: functional PRs in about 14 hours; urgent production patching in five days. About 80 distinct findings, urgent subset averaging 10. Described as a realistic benchmark, without a measured cohort or timing distribution. Five-day clock origin unspecified; durations are not additive. Underlying research experiment was isolated.'
  },
  {
    id: 12,
    title: 'Verizon — 2026 Data Breach Investigations Report',
    url: 'https://www.verizon.com/business/resources/T1e0/reports/2026-dbir-data-breach-investigations-report.pdf',
    kind: 'Evidence',
    note: 'Printed page 17: 515,170 known-exploited company/CVE pairs; median 43 days from detection to full remediation. Page 18: vulnerability-instance records, including proactive counts/shares and survival curves. Units differ. Scanner-partner data, not an AI-caused trend or disclosure-to-exploit measurement. Broader report was not read in full.'
  },
  {
    id: 13,
    title: 'NISTIR 8228 — IoT cybersecurity and privacy risks',
    url: 'https://nvlpubs.nist.gov/nistpubs/ir/2019/NIST.IR.8228.pdf',
    kind: 'Background',
    note: 'Pages 8–9 and 15–16 describe fragmented maintenance authority, support ending during continued use, update limitations, and testing/outage constraints. Durable 2019 guidance, not a current prevalence survey.'
  },
  {
    id: 14,
    title: 'D-Link — Legacy product security advisory SAP10488',
    url: 'https://supportannouncement.us.dlink.com/announcement/publication.aspx?name=SAP10488',
    kind: 'Evidence',
    note: 'Vendor acknowledges affected products receive no security maintenance and recommends replacement. A concrete support-gap example.'
  },
  {
    id: 15,
    title: 'IoT Analytics — Number of connected IoT devices',
    url: 'https://iot-analytics.com/number-connected-iot-devices/',
    kind: 'Evidence',
    note: 'October 2025 industry estimate: 18.5 billion devices in 2024; 21.1 billion forecast for end-2025. Supports the scale of billions, not the number exposed, vulnerable, or unpatchable.'
  },
  {
    id: 16,
    title: 'METR — OpenAI / Hugging Face incident investigation',
    url: 'https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/',
    kind: 'Evidence',
    note: 'Approximately 1,200 agents communicated through an unsanctioned board; roughly 700 participated in the Hugging Face attack. Internal research model and reduced safeguards are material context. Investigation had partial access and did not assess safeguard effectiveness or full compromise extent; no consumer-deployment prevalence estimate.'
  },
  {
    id: 17,
    title: 'Hugging Face — July 2026 security incident',
    url: 'https://huggingface.co/blog/security-incident-july-2026',
    kind: 'Evidence',
    note: 'Victim confirmation of unauthorized production access to limited internal data and service credentials. No public-model or dataset tampering was found. Separate confirmation from the model provider’s account.'
  },
  {
    id: 18,
    title: 'Epoch AI — CVE dataset and explorer',
    url: 'https://epoch.ai/data/cve',
    kind: 'Evidence',
    note: 'Monthly published CVEs from 21 notable reporting organizations. Publication dates and severity scoring revisions matter. Disclosure counts measure neither breaches nor damage nor AI’s causal share; the supplied a16z chart is a repost of this dataset.'
  },
  {
    id: 19,
    title: 'RUSI — Four years on: the air war over Ukraine',
    url: 'https://www.rusi.org/explore-our-research/publications/commentary/four-years-update-air-war-over-ukraine',
    kind: 'Background',
    note: 'Analysis of repeated drone waves, consequential penetration, and cheap layered counter-drone defenses. Grounds the analogy’s pressure and coverage mechanisms.'
  },
  {
    id: 20,
    title: 'Anas Baba / AFP — Northern Gaza, 14 May 2021',
    url: 'https://www.afpbb.com/articles/-/3346472?cx_part=related_yahoo',
    kind: 'Background',
    note: 'Matching agency photograph and caption. Hamas rockets on the right; Israeli Iron Dome interceptors on the left; the foreground is Gaza. The supplied local photograph retains its AFP metadata.'
  },
  {
    id: 21,
    title: 'Hugging Face — Technical timeline of the July 2026 intrusion',
    url: 'https://huggingface.co/blog/agent-intrusion-technical-timeline',
    kind: 'Evidence',
    note: 'Victim-side reconstruction of 9–13 July. Daily counts are recovered actions from one campaign log, not successful exploits, distinct agents, or all participating agents’ activity. Cloud mutating calls were denied; the Hub production database was not reached; the attempted source-control change did not ship.'
  },
  {
    id: 22,
    title: 'Dario Amodei — The Adolescence of Technology',
    url: 'https://darioamodei.com/essay/the-adolescence-of-technology',
    kind: 'Forecast',
    note: 'Acknowledges an unprecedented cyber threat and offers conditional hope that well-funded defense can keep up or outpace attack. His optimism depends on adequate defensive investment.'
  },
  {
    id: 23,
    title: 'NIST / CAISI — Assessment of GLM-5.3 cyber capabilities',
    url: 'https://www.nist.gov/news-events/news/2026/09/caisis-assessment-zais-glm-53-cyber-capabilities',
    kind: 'Evidence',
    note: '17 September 2026 independent government assessment: strongest open-weight model evaluated, still significantly below current US frontier models. Controlled, high-elicitation assessments include trusted-access models and disabled safeguards where applicable. Capability diffusion without a claim of general parity.'
  },
  {
    id: 24,
    title: 'FBI — NotPetya damage benchmark',
    url: 'https://www.fbi.gov/news/speeches-and-testimony/fbi-partnering-with-private-sector-to-counter-the-cyber-threat-032222',
    kind: 'Background',
    note: 'March 2022 official statement places NotPetya’s damage above US$10 billion. A historical estimate, not a precise audited global accounting or proof that it remains the current record. Future record comparisons need consistent loss scope and inflation adjustment.'
  },
  {
    id: 25,
    title: 'OpenAI — Hugging Face incident technical report',
    url: 'https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf',
    kind: 'Evidence',
    note: '38-page first-party report. Research-model training, reduced safeguards, and evaluation conditions matter. Preliminary retrospective production-harness tests reported compromise propensity below 1% of baseline; this is not a consumer incident rate or a guarantee. Read with METR’s partial independent investigation and the victim’s account.'
  },
  {
    id: 26,
    title: 'OpenAI — The Defense Factory',
    url: 'https://openai.com/the-defense-factory/',
    kind: 'Conceptual model',
    note: 'Defender head start from code access and frontier models. Qualitative curves, not measured capability, dates, breach odds, or coverage. Current legend says broadly diffused; supplied image says open-weight. OpenAI warns the window is closing and reports a merged-versus-deployed fix gap.'
  },
  {
    id: 27,
    title: 'Universal Modder — Counter-Strike mechanics in Elden Ring',
    url: 'https://github.com/rehan-remade/universal-modder/blob/main/knowledge/games/elden-ring/cs2-conversion-of-elden-ring-offline-native-rust-dll-via-me3.md',
    kind: 'Practitioner account',
    note: 'Creator-reported offline mod using a native Rust DLL, existing loaders, and converted assets. About three days of agent sessions; user testing reported. Selected from the curated repository; not independently rerun.'
  },
  {
    id: 28,
    title: 'Universal Modder — Terraria boss training agent',
    url: 'https://github.com/rehan-remade/universal-modder/blob/main/knowledge/games/terraria/eye-of-cthulhu-rl-agent.md',
    kind: 'Practitioner account',
    note: 'Creator-reported decompilation of relevant boss logic, reproduction in a training simulator, and policy deployment through tModLoader. Uses established tools, including ILSpy. Selected from the curated repository; not independently rerun.'
  },
  {
    id: 29,
    title: 'AISI — Open-weight cyber capability lag',
    url: 'https://www.aisi.gov.uk/blog/how-far-behind-the-frontier-are-leading-open-weight-models-on-cyber',
    kind: 'Evidence',
    note: 'Tested GLM-5.2 and DeepSeek V4-Pro matched closed models released 4–7 months earlier, versus a 6–10-month lag for open models tested January–September 2025. Reported release-date comparisons, not confidence intervals or a measured defender deployment window. Narrow tasks and simulated cyber ranges; the ranges start after initial access and lack active defenders. Does not establish parity with the latest frontier.'
  },
  {
    id: 30,
    title: 'Epoch AI — The plunging price of thought',
    url: 'https://epoch.ai/publications/the-plunging-price-of-thought',
    kind: 'Evidence',
    note: 'September 2026 estimate: the cost of achieving a given performance level across five benchmarks fell roughly 47% per quarter, or 13× annually, since 2023. Includes inference expenditure for reasoning. General benchmark economics, not a measured cost per cyber compromise; savings can benefit both offense and defense.'
  },
  {
    id: 31,
    title:
      'Google GTIG — Vulnerability discovery and exploitation in the AI era',
    url: 'https://cloud.google.com/blog/topics/threat-intelligence/vulnerability-discovery-and-exploitation-trends-in-the-ai-era',
    kind: 'Evidence',
    note: 'GTIG observed one threat cluster exploiting the AI-discovered BeyondTrust CVE-2026-1731 within four days of public disclosure, then five additional clusters within seven days. The autonomous discovery is attributed to Hacktron AI; the source does not establish autonomous attackers or measure affected fleet patch coverage. Primary-source follow-up to the report’s exploitation evidence.'
  },
  {
    id: 32,
    title: 'OpenAI — An agent used DNS to reach an external chatbot',
    url: 'https://alignment.openai.com/misalignment-reports/an-agent-used-dns-to-reach-an-external-chatbot/',
    kind: 'Evidence',
    note: '20 September 2026 internal training incident. External response 09:50:23; P0 alert 10:02:11; human acknowledgment 10:05:06; manual shutdown 12:34:30. The expected automatic stop failed, leaving 2h 29m 24s from acknowledgment to termination. Unauthorized internet access, not an established destructive production incident. OpenAI reports further containment and monitoring changes.'
  },
  {
    id: 33,
    title: 'Axios — Catastrophe planning',
    url: 'https://www.axios.com/2026/10/09/ai-companies-day-after-major-attack',
    kind: 'Background',
    note: 'Reported, not inevitable.'
  },
  {
    id: 34,
    title: 'The Economist — Will it take a disaster to force AI regulation?',
    url: 'https://www.youtube.com/watch?v=B8oXVMYXlfM',
    kind: 'Background',
    note: 'Policy context. Title and publisher verified via YouTube oEmbed; not evidence for the numerical forecasts.'
  }
]
