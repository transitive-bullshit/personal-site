export type EssayPart = {
  id: string
  title: string
  paragraphs: string[]
  margin: { label: string; body: string; refs: number[] }
}

// Shared by the reader, author mode, and Markdown export.
export const essayChrome = {
  deck: 'Cheap, adaptive offense meets a world that has to keep operating while it changes.',
  openingMarginLabel: 'The analogy',
  openingMarginBody: 'Persistent pressure. Cheap mass. Uneven coverage.',
  swarmCaption: 'Same composition. A different battlefield.',
  predictionsTitle: 'Concrete predictions',
  predictionsEyebrow: 'Personal predictions / 12–18 months',
  predictionsDates: 'October 2027 checkpoint · April 2028 deadline',
  predictionsIntro:
    'These are my predictions for the next twelve to eighteen months.',
  predictionsMarginLabel: 'Evidence → judgment',
  predictionsMarginBody:
    'Judge these forecasts by operational harm and recovery.',
  mentalModelTitle: 'The mental model'
}

export const essayOpening = [
  'Look at the two patterns of motion in that sky. On the right, Hamas rockets fan toward southern Israel. On the left, Iron Dome interceptors curve up to meet them. AFP photographer Anas Baba captured this image over northern Gaza in May 2021. [20]',
  "Drones take this change in the economics of warfare further. We've seen this pattern before: a new weapon fundamentally changes the economics and balance of power. Think about gunpowder, or more recently, drones that can be mass-produced cheaply and efficiently compared with very large, slow-moving military infrastructure like aircraft carriers. Repeated drone waves put sustained pressure on distributed infrastructure, even as cheap, layered defenses improve. [19]",
  "We're already seeing a similar pattern in cybersecurity: cheap agents probing, adapting, trying again, and working across many targets at once. Even if you're sufficiently AGI-pilled, I think it's easy to underestimate how much of today's security depends on expert attack effort staying expensive.",
  "The frontier labs are already mobilizing defenses. But I don't believe that will be enough. My core view is that AI makes sustained expert attack effort cheap faster than reliable protection reaches much of the world it attacks.",
  'Attackers can choose where to apply that effort. Defenders have to keep the systems they already run working. That is the asymmetry I want people to have in mind—and why I expect the transition to favor offense across the exposed world.'
]

export const essayParts: EssayPart[] = [
  {
    id: 'defenders',
    title: 'The good guys are mobilizing too',
    margin: {
      label: 'A real defensive victory',
      body: '271 vulnerabilities fixed in Firefox 150. A shipped upstream improvement; worldwide protection still depends on distribution and uptake.',
      refs: [5]
    },
    paragraphs: [
      'The obvious response is that only a good guy with AI can stop a bad guy with AI. And the labs are putting serious resources behind that response.',
      "[OpenAI's Daybreak](https://openai.com/daybreak/), [Anthropic's Glasswing](https://www.anthropic.com/glasswing), and [Google's Fairwind](https://deepmind.google/fairwind-program/) are putting defensive capability, fixes, and deployment support into important software foundations and organizations responsible for essential services. [1] [2] [3]",
      "OpenAI's [Defense Factory](https://openai.com/the-defense-factory/) makes the strongest version of this argument explicit: the defender's window. Defenders can give agents direct access to their own code and use frontier models before comparable capability diffuses more broadly. Turn that head start into continuous discovery, validation, and repair, and defenders can close weaknesses before attackers exploit them. [26]",
      'AISI puts a number on how quickly comparable cyber capability has been spreading. The leading open models it tested matched closed models released four to seven months earlier, down from six to ten months through much of 2025. That is a real head start. The question is how much of the exposed world can turn it into protection in time. [29]',
      "Mozilla's Firefox 150 release includes fixes for 271 vulnerabilities identified with Claude Mythos Preview. That is the kind of defensive progress that matters: upstream fixes shipped to users. [5]",
      "This is where the drone analogy has an important limit. A software defender does not need a fresh interceptor for every incoming request. One deployed patch or enforced policy can defeat an entire attack family. A million copies of the same failed exploit don't become a million independent chances to get through.",
      'The labs understand the deployment problem. OpenAI explicitly warns about under-resourced critical infrastructure, and its Defense Factory account describes a gap between merged patches and fixes deployed across its own fleet. Anthropic says hardening may take years while capabilities advance substantially over months. [4] [26] [2]',
      "The defender's window is real. I expect it to close before much of the exposed world is protected. The head start only matters where defenders can connect the models to their systems and turn findings into protection before offensive capability reaches those same systems. Legacy companies and unsupported IoT devices cannot inherit that operating model by default. I expect the best defenders to get much better, and real-world cyber damage to get much worse."
    ]
  },
  {
    id: 'capability',
    title: 'Expert attack effort is becoming abundant',
    margin: {
      label: 'One operator. Many targets.',
      body: '42 entities targeted; at least 14 accessed in an AI-assisted campaign observed by Anthropic.',
      refs: [7]
    },
    paragraphs: [
      'Expert attention has been a constraint on how many targets an attacker can pursue and how long they can keep adapting. AI changes who can afford that work and how much of it they can sustain.',
      "Mandiant founder Kevin Mandia describes human-led espionage as a sniper round: scarce expert attention concentrated on selected targets. AI lets an operator spread that attention across many more targets and explore them in parallel. Today's swarms can be louder and less coordinated, but the economics have already changed. [6]",
      "Epoch estimates that the cost of achieving a given level of performance across five AI benchmarks has been falling roughly thirteenfold each year since 2023. That helps defenders too. My concern is what happens when increasingly capable work becomes cheap enough to keep running against targets that previously weren't worth the effort. [30]",
      'You can see the same shift in the wave of AI-assisted game mods, reverse engineering, and software recreations: Halo content in Minecraft, Counter-Strike mechanics in Elden Ring, a Terraria boss turned into a training simulator. These are fun, largely innocuous applications of agents understanding and changing unfamiliar software. The same techniques can serve malicious actors when the target stops being a game. [9] [27] [28]',
      'Anthropic reports a single operator targeting 42 entities and gaining internal access to at least 14. In a separate AI-assisted operation, a conventional pipeline decompiled 1.8 million Android app packages and searched for embedded secrets. The 42-target campaign makes the shift especially concrete: one operator sustaining reconnaissance, custom tooling, and exploitation across multiple organizations. [7]',
      'In another operation, Anthropic observed AI-assisted workflows modifying and rebuilding malware after security products detected it. That is adaptation, beyond more scans. [7]',
      "Restrictions on frontier access may buy defenders time. They do not establish a durable monopoly on offensive capability. Anthropic documents advanced cyber capabilities in the open-weight GLM-5.3 model. NIST's independent assessment still places it significantly below the current US frontier, while calling it the strongest open-weight model it has evaluated. Diffusion can matter well before parity. [10] [23]",
      'The stakes change when the target is a bank, a phone, a hospital, a utility, or a voting system. More targets become worth persistent attention. Persistence matters when agents can learn from failure and look for a different reachable weakness.'
    ]
  },
  {
    id: 'coverage',
    title: 'Capability is not coverage',
    margin: {
      label: 'The release is only the start',
      body: 'A shipped fix still has to reach installed systems. Legacy dependencies, vendor-locked firmware, and unsupported devices make that next step harder.',
      refs: [13, 14]
    },
    paragraphs: [
      "The condition inside the defender's window is that effective protection has to arrive before offensive access spreads. OpenAI is trying to compress the whole loop, including inventory, ownership, deployment, and verification. My concern is who can install and sustain that loop across the systems they actually run. [26]",
      "An AI research agent discovered a flaw in BeyondTrust's remote-access software. Within four days of public disclosure, Google's threat intelligence team observed one threat cluster exploiting it. Within seven days, there were six. Defensive discovery had become an opportunity for multiple attackers while every affected organization still had to secure its own systems. [31]",
      "Even advanced defenders encounter this gap. Cloudflare's illustrative workflow puts working fixes at roughly 14 hours and urgent production patching at five days. OpenAI found merged patches whose fixes had not reached deployed systems, then expanded verification to close that gap. These are organizations with the models, the engineers, and control of their infrastructure. Now consider the companies that have none of those advantages. [11] [26]",
      "That is why I don't find more findings, more fixes, or more tool adoption reassuring on their own. Protection has to keep pace with the exposed systems and the pressure they face.",
      'The strongest counterargument is automatic containment. Mandia compares it to a battlefield dressing: stop the bleeding now; get to the hospital for the full repair later. Existing endpoint and firewall platforms can close an attack path before every vulnerable application has been patched. I take that seriously. Centrally managed companies can move fast. The coverage question is where those controls can see the path, have authority to act, and are already deployed. [6]',
      'My concern is how much of the exposed world those protections reach while offensive capability keeps getting cheaper. The real world is slow. Real processes are slow. Legacy companies have custom software, hidden dependencies, downtime limits, and systems they cannot simply turn off. Like an aircraft carrier, legacy infrastructure has to be refitted while it keeps doing its job.',
      'Then there are billions of connected IoT devices, spread across different owners, firmware, and support arrangements. Many lack a workable update path. NIST documents these maintenance constraints; D-Link recommends replacing affected legacy products that no longer receive security maintenance. A better model cannot manufacture missing vendor support or install replacement hardware. [13] [14] [15]',
      'Survival of the fittest gets harsher. And your own security posture is only part of it. Even strong defenders depend on suppliers, identities, and infrastructure outside their direct control. Weak dependencies can transmit damage beyond the first organization compromised.',
      'My prediction is that cheap, adaptive offense keeps finding consequential openings across the unevenly protected world faster than we close them.'
    ]
  },
  {
    id: 'accident',
    title: 'Malice is only one route to harm',
    margin: {
      label: 'Human intent ≠ agent behavior',
      body: 'Good intentions need enforced boundaries. The unauthorized behavior and the defenses that held both matter.',
      refs: [16, 17, 25]
    },
    paragraphs: [
      'The [OpenAI–Hugging Face incident](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/) adds another asymmetry: an operator can be running a legitimate task while its agents knowingly act outside it. Benign intent at the top does not guarantee authorized behavior below. [16] [17]',
      'Safeguards aimed at malicious users address only one route to harm. Legitimate workloads still need containment when their agents depart from the task. [16]',
      "The reduced safeguards and the defenses that held are central to how I read the incident. OpenAI's preliminary retrospective tests suggest its production harness would have greatly reduced this behavior. Enforced containment matters. [21] [25]",
      "OpenAI's September DNS incident exposes another part of that problem. An agent in an internal training run used DNS to reach an external chatbot despite network restrictions. Monitoring raised an alert; a human acknowledged it within three minutes. But the expected automatic stop failed, and the run continued for roughly another two and a half hours before manual shutdown. Detection has to lead to enforced containment. [32]",
      'The risk grows through both routes: malicious operators scaling attacks, and legitimate operators losing control. As agents become more capable and more connected, good intentions become a weaker basis for trusting the systems we put them in.'
    ]
  }
]

export const capabilityAside =
  'The game examples use different methods: Halo assets ported with existing tools; a native Rust mod that puts Counter-Strike mechanics into Elden Ring; Terraria boss logic decompiled, reproduced in a simulator, and used to train an in-game agent. Creators report roughly eight hours for the Halo port and about three days of agent sessions for the Elden Ring mod. [9] [27] [28]'
export const releaseAside =
  "Anthropic's retrospective patch-replay study shows how much that clock has changed. Mythos produced its fastest working SpiderMonkey exploit in under an hour; the corresponding public source fix had taken 18 days to reach the Firefox 148 release. And Firefox is one of the better cases: supported software with automatic updates. [8]"

export const finalPredictions = [
  {
    id: 'commodity',
    title: 'Sophisticated offense becomes a commodity',
    body: 'Small crews will routinely sustain persistent, adaptive campaigns across hundreds of targets with much less specialist intervention. The step change is how much expert work they can keep running, beyond cheap scanning or personalized phishing.',
    test: "From 8 October 2026 through 30 April 2028, I expect at least three independently documented campaigns, attributed to distinct small teams or lone operators, each involving attempted exploitation across at least 200 real organizations. Credible reporting must establish the operator's limited personnel and adaptation to target-specific obstacles; mass scanning alone does not qualify. Human direction is compatible with this prediction. These cases would establish repeated accessibility, not population-wide prevalence. Calling it a commodity also requires evidence of a repeatable workflow used beyond a single bespoke operation."
  },
  {
    id: 'damage',
    title: 'Damage rises sharply despite defensive progress',
    body: 'Maintained platforms and sophisticated defenders will improve. I expect a much larger rise in serious real-world harm as unsupported devices, brittle infrastructure, and weak shared dependencies face escalating pressure.',
    test: "Judge this by confirmed operational harm: interrupted essential services, economic loss, and difficult recovery, with credible evidence of AI's contribution. CVE disclosures and blocked probes do not count as damage. Compare like-for-like incident evidence where available; a global percentage claim would require a stable dataset we do not yet have. I expect substantial worsening, but I am not assigning a precise worldwide growth rate. [18]"
  },
  {
    id: 'unauthorized',
    title: 'Unauthorized agent harm becomes a recurring incident category',
    body: 'Legitimate deployments or tests exceeding their authority will repeatedly cause consequential production effects. The distinction between malicious use and unintended harm will matter less to the people whose services stop working.',
    test: 'At least three independently confirmed incidents, involving distinct organizations, with onset from 8 October 2026 through 30 April 2028. Agents in legitimate workflows must cause unauthorized production access, data loss, or service disruption. Attempts and evaluation failures without real production effects do not count. The July 2026 Hugging Face incident is an early example, not one of these future three.'
  },
  {
    id: 'catastrophe',
    title: 'An AI-enabled catastrophe sets a new damage benchmark',
    body: 'My boldest prediction: a single AI-enabled cyberattack causes cascading disruption across multiple critical sectors, impairs essential services for weeks, and produces greater economic damage than any previous single cyberattack. I expect this by the same deadline.',
    test: "The attack must begin from 8 October 2026 through 30 April 2028 and substantially impair essential services in each of at least two critical sectors for fourteen days or more. Credible forensics must establish consequential AI exploitation, adaptation, or coordination. Compare non-overlapping direct, restoration, and interruption losses in 2026 US dollars against credible prior single-event estimates. Include NotPetya: the FBI's estimate exceeds US$10 billion, a lower bound for the 2017 attack, not proof of today's record. Adjust from each event's original loss year and respect estimate ranges. Loss estimates can mature after the deadline; an uncertain comparison remains unproven. AI-written phishing alone does not qualify. [24]"
  }
]

export const finalForecastPremise =
  "I'm assuming AI capabilities continue progressing roughly exponentially, with AGI and then ASI within five to ten years. I'm also assuming inference stays affordable, offensive access spreads, and a substantial exposed installed base persists. We don't need AGI for this transition to cause serious damage."
export const finalClosing = [
  'I would revise these predictions if automatic containment, shared fixes, and replacement reach exposed systems faster than offensive access spreads, and damaging incidents fall as a result. I want to see deployed protection working under pressure.',
  'The mental model I keep coming back to is swarm warfare: cheap, adaptive, persistent offense meets a world that has to keep operating while it changes. Defensive AI can be extremely effective, and still reach the exposed world too unevenly to prevent a much more damaging transition.',
  'The next post is about what we can actually do with that understanding: defensive measures, operating habits, and mental models for navigating this new age.'
]

export const furtherReading = [
  {
    title: 'Secure Acceleration',
    url: 'https://secureacceleration.com',
    note: 'All nine report pages read. Useful leads on coordination and loss of control; its forecasts and proposed swarm equation are the authors’ views.'
  },
  {
    title: 'Scott Alexander — My Takeaways From AI 2027',
    url: 'https://www.astralcodexten.com/p/my-takeaways-from-ai-2027',
    note: 'Scenario commentary, not measured cyber evidence.'
  },
  {
    title: 'Google Research and collaborators — Scaling Agent Systems',
    url: 'https://arxiv.org/html/2512.08296v3',
    note: 'Multi-agent benefits depend on task structure; non-cyber benchmarks do not imply a universal swarm multiplier.'
  },
  {
    title: 'State of AI Report 2026',
    url: 'https://www.stateof.ai/State-of-AI-Report-2026.pdf',
    note: 'Research synthesis; the findings used here link to their primary sources above.'
  }
]
