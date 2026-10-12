export type SavedLinkPreviewSource = {
  key: string
  url: string
  title: string
  description: string
  siteName: string
  kind: string
  sourceImage?: string
}

// Published metadata or concise source labels. sourceImage is an advertised
// social image, except the standard YouTube thumbnail URL.
export const savedLinkPreviewSources: SavedLinkPreviewSource[] = [
  {
    key: 'daybreak',
    url: 'https://openai.com/daybreak/',
    title: 'Daybreak | OpenAI for cybersecurity',
    description:
      'Deploy AI for cyber defense with OpenAI models and Codex Security to identify threats, generate patches, and verify remediation across code and systems.',
    siteName: 'OpenAI',
    kind: 'Cyber defense',
    sourceImage:
      'https://images.ctfassets.net/kftzwdyauwt9/RAoZVm0QSDA9IBOdqncy4/73926b872759234815531ddaf4a80792/daybreak.png?w=1600&h=900&fit=fill'
  },
  {
    key: 'defense-factory',
    url: 'https://openai.com/the-defense-factory/',
    title: 'Defense Factory | OpenAI',
    description:
      'The defender’s window is closing: building continuous defense with the Defense Factory',
    siteName: 'OpenAI',
    kind: 'Cyber defense',
    sourceImage:
      'https://cdn.openai.com/the-defense-factory/9ed8fb44-cc38-484b-bae9-5eab7c5ffb92/df-ogimage.png'
  },
  {
    key: 'collective-cyberdefense',
    url: 'https://openai.com/collective-cyberdefense/',
    title: 'A call for collective action on cyber defense',
    description:
      'Industry, government, and AI leaders call for collective action to strengthen cyber defenses and protect the critical infrastructure we all depend on.',
    siteName: 'OpenAI',
    kind: 'Open letter',
    sourceImage:
      'https://images.ctfassets.net/kftzwdyauwt9/6imVXMcUcHNW3dFi3sWjCo/997611e54208bc274e1e1d6f0db21e31/collective-cyber-defense--seo-v001.png?w=1600&h=900&fit=fill'
  },
  ...[
    [
      'halo-mod',
      'halo-3-mcc/halo-3-weapons-covenant-vehicles-and-maps-ported-into-minecr.md',
      'Halo content ported into Minecraft'
    ],
    [
      'elden-ring-mod',
      'elden-ring/cs2-conversion-of-elden-ring-offline-native-rust-dll-via-me3.md',
      'Counter-Strike mechanics in Elden Ring'
    ],
    [
      'terraria-mod',
      'terraria/eye-of-cthulhu-rl-agent.md',
      'Terraria boss turned into a training simulator'
    ]
  ].map(([key, path, title]) => ({
    key: key!,
    url:
      'https://github.com/rehan-remade/universal-modder/blob/main/knowledge/games/' +
      path,
    title: title!,
    description:
      'Universal Modder · AI-assisted game modding and reverse engineering.',
    siteName: 'rehan-remade / universal-modder',
    kind: 'GitHub project',
    sourceImage:
      'https://opengraph.githubassets.com/56cbe74f1ebde647030b0369fce4923ee722ee1f998207b95737619231bf8b3c/rehan-remade/universal-modder'
  })),
  {
    key: 'mandia-video',
    url: 'https://www.youtube.com/watch?v=cJsHel27Z6M',
    title: 'Building Cyber Defense for the Agentic Era',
    description:
      'Kevin Mandia on AI agents, cyber offense, and defensive containment.',
    siteName: 'YouTube',
    kind: 'Video · Kevin Mandia',
    sourceImage: 'https://i.ytimg.com/vi/cJsHel27Z6M/maxresdefault.jpg'
  },
  {
    key: 'dlink-advisory',
    url: 'https://supportannouncement.us.dlink.com/announcement/publication.aspx?name=SAP10488',
    title: 'Legacy product security advisory SAP10488',
    description:
      'D-Link guidance for legacy products that no longer receive security maintenance.',
    siteName: 'D-Link',
    kind: 'Security advisory'
  },
  {
    key: 'dns-incident',
    url: 'https://alignment.openai.com/misalignment-reports/an-agent-used-dns-to-reach-an-external-chatbot/',
    title: 'An agent used DNS to reach an external chatbot',
    description:
      'OpenAI’s report on unauthorized external access during an internal training run.',
    siteName: 'OpenAI Alignment',
    kind: 'Incident report'
  },
  {
    key: 'scaling-agent-systems',
    url: 'https://arxiv.org/html/2512.08296v3',
    title: 'Towards a Science of Scaling Agent Systems',
    description:
      'Research on how multi-agent performance depends on task structure.',
    siteName: 'arXiv',
    kind: 'Research paper · 2512.08296v3'
  },
  {
    key: 'fbi-cyber-speech',
    url: 'https://www.fbi.gov/news/speeches-and-testimony/fbi-partnering-with-private-sector-to-counter-the-cyber-threat-032222',
    title: 'FBI Partnering with the Private Sector to Counter the Cyber Threat',
    description:
      'FBI Director Christopher Wray’s remarks at the Detroit Economic Club in Detroit, Michigan.',
    siteName: 'Federal Bureau of Investigation',
    kind: 'Speech · March 22, 2022'
  },
  {
    key: 'nist-iot-report',
    url: 'https://nvlpubs.nist.gov/nistpubs/ir/2019/NIST.IR.8228.pdf',
    title: 'Considerations for Managing IoT Cybersecurity and Privacy Risks',
    description:
      'NISTIR 8228 · Internet of Things cybersecurity and privacy guidance.',
    siteName: 'NIST',
    kind: 'PDF · NISTIR 8228'
  },
  {
    key: 'hugging-face-incident-report',
    url: 'https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf',
    title: 'OpenAI–Hugging Face Incident Technical Report',
    description:
      'First-party technical report on the Hugging Face model evaluation security incident.',
    siteName: 'OpenAI',
    kind: 'PDF · Technical report'
  },
  {
    key: 'state-of-ai-2026',
    url: 'https://www.stateof.ai/State-of-AI-Report-2026.pdf',
    title: 'State of AI Report 2026',
    description:
      'Research, industry, politics, and safety in artificial intelligence.',
    siteName: 'State of AI',
    kind: 'PDF · Annual report'
  }
]
