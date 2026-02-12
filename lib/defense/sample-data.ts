import type {DefenseSemaformStory} from './types'

export const fallbackDefenseStories: DefenseSemaformStory[] = [
  {
    id: 'fallback-1',
    title: 'USSF expands access to proliferated LEO SATCOM services',
    slug: 'ussf-leo-satcom-services',
    publishedAt: '2026-02-11T12:00:00.000Z',
    deck:
      'Space Force procurement is moving toward faster task-order execution on commercial LEO bandwidth for contested missions.',
    domain: 'space',
    missionTags: ['Joint C2', 'Resilient Comms', 'Contested Logistics'],
    technologyTags: ['SATCOM', 'Network Orchestration', 'Terminal Integration'],
    acquisitionStatus: 'awarded',
    horizon: 'near',
    sourceBadge: 'Program office',
    sourceUrl: 'https://www.ssc.spaceforce.mil/',
    track: 'programs',
    contentType: 'program',
    highImpact: true,
    theNews: [
      'Space Systems Command expanded a multi-vendor vehicle for managed low-Earth-orbit SATCOM services.',
      'The vehicle allows mission teams to place follow-on task orders without re-running full source selections.',
      'Program language emphasizes integration of commercial LEO with existing GEO and MEO paths for continuity under disruption.',
    ],
    analystView: [
      {
        station: 'founder',
        bullets: [
          'This likely means teaming through current awardees is the practical on-ramp if you are not on contract yet.',
          'This likely means differentiation moves to cyber hardening and integration speed, not bandwidth alone.',
        ],
      },
      {
        station: 'prime_pm',
        bullets: [
          'This likely means task-order quality and integration credibility will decide captures more than initial award access.',
          'This likely means lifecycle support and cross-constellation operations become the higher-margin work.',
        ],
      },
      {
        station: 'investor',
        bullets: [
          'This likely means vehicle inclusion is a strong moat signal, but revenue pacing still depends on order velocity.',
          'This likely means firms with repeat task-order wins should command premium growth multiples.',
        ],
      },
      {
        station: 'policy',
        bullets: [
          'This likely means commercial infrastructure resilience is now a direct readiness concern.',
          'This likely means appropriations debates will compare SATCOM modernization against munitions urgency.',
        ],
      },
    ],
    roomForDisagreement: [
      'Task-order tempo could lag if interoperability standards tighten during execution.',
      'Appropriation shifts may delay adoption despite contract availability.',
    ],
    viewFrom: [
      {
        perspective: 'Operators',
        note: 'Resilience under degraded spectrum is more important than peak throughput claims.',
      },
      {
        perspective: 'Acquisition teams',
        note: 'Vehicle speed only translates into outcomes when requirements are tightly scoped.',
      },
    ],
    notableLinks: [
      {
        label: 'Space Systems Command updates',
        url: 'https://www.ssc.spaceforce.mil/',
        source: 'primary',
      },
      {
        label: 'CSIS military space analysis',
        url: 'https://www.csis.org/topics/defense-and-security',
        source: 'deep_dive',
      },
    ],
    featured: true,
  },
  {
    id: 'fallback-2',
    title: 'Army signals brigade-level counter-UAS sensing sprint',
    slug: 'army-counter-uas-brigade-sprint',
    publishedAt: '2026-02-11T08:00:00.000Z',
    deck:
      'Requirement language prioritizes rapid fielding and integration into existing brigade C2 workflows.',
    domain: 'land',
    missionTags: ['Counter-UAS', 'Force Protection', 'Homeland Defense'],
    technologyTags: ['RF sensing', 'EO/IR', 'Edge AI'],
    acquisitionStatus: 'rfi',
    horizon: 'near',
    sourceBadge: 'SAM.gov',
    sourceUrl: 'https://sam.gov/',
    track: 'programs',
    contentType: 'program',
    highImpact: true,
    theNews: [
      'Army channels published requirement language for brigade-level counter-UAS sensing with open architecture constraints.',
      'Response requests emphasize compatibility with existing C2 systems and fast deployment schedules.',
      'Submission criteria include sustainment planning and operator training support details.',
    ],
    analystView: [
      {
        station: 'founder',
        bullets: [
          'This likely means standalone sensor performance is not enough without clear integration and sustainment partners.',
          'This likely means teams with existing field support workflows have a timeline advantage.',
        ],
      },
      {
        station: 'prime_pm',
        bullets: [
          'This likely means capture strength will depend on integration risk closure at brigade and division levels.',
          'This likely means teaming depth around training and support will be evaluated early.',
        ],
      },
      {
        station: 'investor',
        bullets: [
          'This likely means counter-UAS demand remains durable but conversion risk sits in integration execution.',
          'This likely means system-level platform players should outperform single-feature vendors.',
        ],
      },
      {
        station: 'policy',
        bullets: [
          'This likely means domestic and allied force-protection pressure is moving c-UAS to a higher urgency tier.',
          'This likely means export and data-governance rules may become gating factors for certain solutions.',
        ],
      },
    ],
    roomForDisagreement: [
      'Fielding pace could stay uneven if TOC integration burden remains high.',
      'Funding might shift toward interceptors if threat volume grows faster than sensing quality.',
    ],
    viewFrom: [
      {
        perspective: 'Brigade staffs',
        note: 'False-positive rates and setup time matter more than demo-day precision metrics.',
      },
      {
        perspective: 'Industry teams',
        note: 'Execution credibility around sustainment is now equal to hardware performance.',
      },
    ],
    notableLinks: [
      {
        label: 'SAM.gov opportunities',
        url: 'https://sam.gov/',
        source: 'primary',
      },
      {
        label: 'DefenseScoop c-UAS coverage',
        url: 'https://defensescoop.com/',
        source: 'secondary',
      },
    ],
    featured: true,
  },
  {
    id: 'fallback-3',
    title: 'DoD industrial-base push reframes munitions throughput as deterrence variable',
    slug: 'dod-industrial-base-munitions-throughput',
    publishedAt: '2026-02-10T15:00:00.000Z',
    deck:
      'Guidance continues to emphasize second sourcing and production resilience for long-lead munitions components.',
    domain: 'multi-domain',
    missionTags: ['Industrial Base', 'Munitions', 'Supply Chain'],
    technologyTags: ['Advanced Manufacturing', 'Digital Twins', 'Propulsion'],
    acquisitionStatus: 'prototyping',
    horizon: 'medium',
    sourceBadge: 'DoD release',
    sourceUrl: 'https://business.defense.gov/Engage/News/',
    track: 'macro',
    contentType: 'policy',
    highImpact: true,
    theNews: [
      'Defense industrial-base updates continue to prioritize throughput, resiliency, and supplier diversification.',
      'Program language increasingly calls out long-lead component exposure in source selections.',
      'Public-private risk-sharing language appears in more expansion announcements.',
    ],
    analystView: [
      {
        station: 'founder',
        bullets: [
          'This likely means process innovation and qualification speed can be a primary wedge into larger programs.',
          'This likely means startups that de-risk tier-two suppliers have stronger prime-partner leverage.',
        ],
      },
      {
        station: 'prime_pm',
        bullets: [
          'This likely means proposal reviews will weigh alternate sourcing plans as heavily as price.',
          'This likely means production ramp credibility must be explicit at bid time.',
        ],
      },
      {
        station: 'investor',
        bullets: [
          'This likely means tooling and qualification milestones are stronger leading indicators than backlog headlines.',
          'This likely means capex-heavy companies can still outperform when supply reliability is proven.',
        ],
      },
      {
        station: 'policy',
        bullets: [
          'This likely means capacity is being treated as strategic posture, not only procurement efficiency.',
          'This likely means antitrust and competition debates may intensify around consolidation pressure.',
        ],
      },
    ],
    roomForDisagreement: [
      'Lower-tier suppliers may still bottleneck despite policy attention.',
      'Specialized material inflation could offset expected gains from larger production lots.',
    ],
    viewFrom: [
      {
        perspective: 'Program offices',
        note: 'Supplier health telemetry is now central to schedule confidence.',
      },
      {
        perspective: 'Capital allocators',
        note: 'Durable production reliability is a stronger signal than single-year demand spikes.',
      },
    ],
    notableLinks: [
      {
        label: 'Defense industrial-base news',
        url: 'https://business.defense.gov/Engage/News/',
        source: 'primary',
      },
      {
        label: 'GAO defense supply-chain reports',
        url: 'https://www.gao.gov/defense-capabilities-and-management',
        source: 'deep_dive',
      },
    ],
    featured: false,
  },
  {
    id: 'fallback-4',
    title: 'FY planning cycle highlights ISR and autonomy as protected budget lines',
    slug: 'fy-planning-isr-autonomy-protected-lines',
    publishedAt: '2026-02-10T11:00:00.000Z',
    deck:
      'Early budget signals continue to ringfence ISR and autonomy modernization despite broader portfolio tradeoffs.',
    domain: 'air',
    missionTags: ['ISR', 'Autonomy', 'Joint Fires'],
    technologyTags: ['AI/ML', 'Mission Software', 'Edge Compute'],
    acquisitionStatus: 'pre-rfi',
    horizon: 'medium',
    sourceBadge: 'Policy doc',
    sourceUrl: 'https://comptroller.defense.gov/Budget-Materials/',
    track: 'macro',
    contentType: 'budget',
    highImpact: true,
    theNews: [
      'Planning-cycle guidance shows continued prioritization for ISR and autonomy capabilities.',
      'Budget language emphasizes transition from prototype pilots to operational scaling plans.',
      'Readiness and sustainment funding remains under pressure in competing portfolios.',
    ],
    analystView: [
      {
        station: 'founder',
        bullets: [
          'This likely means solutions with clear transition pathways have better odds than pure R&D positioning.',
          'This likely means near-term contract opportunities will reward integration readiness over novelty.',
        ],
      },
      {
        station: 'prime_pm',
        bullets: [
          'This likely means capture plans should align autonomy packages with concrete readiness outcomes.',
          'This likely means cross-program budget cannibalization risk must be modeled early.',
        ],
      },
      {
        station: 'investor',
        bullets: [
          'This likely means sustained budget protection supports software-enabled defense theses over point hardware bets.',
          'This likely means timeline confidence improves when transition milestones are explicit in program docs.',
        ],
      },
      {
        station: 'policy',
        bullets: [
          'This likely means modernization priorities are hardening around data-driven battlespace awareness.',
          'This likely means oversight pressure will increase on prototype-to-program conversion rates.',
        ],
      },
    ],
    roomForDisagreement: [
      'Appropriations outcomes can still rebalance priorities late in the cycle.',
      'Program offices may overstate transition readiness from ongoing pilots.',
    ],
    viewFrom: [
      {
        perspective: 'Service planners',
        note: 'Protection in topline planning does not eliminate execution friction in transitions.',
      },
    ],
    notableLinks: [
      {
        label: 'DoD budget materials',
        url: 'https://comptroller.defense.gov/Budget-Materials/',
        source: 'primary',
      },
      {
        label: 'CRS defense budget explainers',
        url: 'https://crsreports.congress.gov/',
        source: 'deep_dive',
      },
    ],
    featured: false,
  },
  {
    id: 'fallback-5',
    title: 'Dual-use defense startups see larger rounds tied to long-cycle gov demand',
    slug: 'dual-use-startups-larger-rounds-gov-demand',
    publishedAt: '2026-02-09T17:00:00.000Z',
    deck:
      'Recent deal flow shows investors rewarding teams with program-aligned traction and procurement literacy.',
    domain: 'cyber',
    missionTags: ['Defense Software', 'Cyber', 'Autonomy'],
    technologyTags: ['AI', 'Simulation', 'Secure Networks'],
    acquisitionStatus: 'prototyping',
    horizon: 'medium',
    sourceBadge: 'Funding',
    sourceUrl: 'https://news.crunchbase.com/defense-tech/',
    track: 'capital',
    contentType: 'funding',
    highImpact: false,
    theNews: [
      'Defense-adjacent startup financing continues to include larger rounds for mission-aligned companies.',
      'Investor commentary stresses contract quality and procurement timelines as diligence priorities.',
      'Market narratives favor platforms that bridge commercial and defense demand.',
    ],
    analystView: [
      {
        station: 'founder',
        bullets: [
          'This likely means fundraising outcomes improve when you demonstrate program-office pull, not just pilot volume.',
          'This likely means capture and compliance readiness now affects valuation earlier than before.',
        ],
      },
      {
        station: 'prime_pm',
        bullets: [
          'This likely means well-funded startups will expect clearer teaming economics and faster technical integration.',
          'This likely means partner selection should prioritize companies with realistic transition roadmaps.',
        ],
      },
      {
        station: 'investor',
        bullets: [
          'This likely means late-stage premiums should be tied to contract durability rather than headline growth alone.',
          'This likely means downside risk is concentrated in companies without validated procurement motion.',
        ],
      },
      {
        station: 'policy',
        bullets: [
          'This likely means private capital is increasingly shaping defense innovation pathways.',
          'This likely means oversight attention may shift to market concentration in critical dual-use categories.',
        ],
      },
    ],
    roomForDisagreement: [
      'Private-market marks may outrun real contract conversion in some segments.',
      'Policy shifts could narrow dual-use pathways for sensitive technologies.',
    ],
    viewFrom: [
      {
        perspective: 'Founders',
        note: 'Capital is available, but diligence bar on acquisition realism is much higher.',
      },
      {
        perspective: 'LPs',
        note: 'Fund returns depend on cycle-time compression more than raw deal count.',
      },
    ],
    notableLinks: [
      {
        label: 'Crunchbase defense-tech updates',
        url: 'https://news.crunchbase.com/defense-tech/',
        source: 'primary',
      },
      {
        label: 'Public-market defense trends',
        url: 'https://finance.yahoo.com/topic/defense/',
        source: 'secondary',
      },
      {
        label: 'Critical view on sector multiples',
        url: 'https://www.ft.com/companies/defence',
        source: 'critique',
      },
    ],
    featured: false,
  },
  {
    id: 'fallback-6',
    title: 'Navy C2 modernization pipeline increases demand for modular software inserts',
    slug: 'navy-c2-modernization-modular-software',
    publishedAt: '2026-02-09T09:30:00.000Z',
    deck:
      'Program updates emphasize open architecture and incremental deployment cycles across fleet systems.',
    domain: 'maritime',
    missionTags: ['Joint C2', 'Fleet Readiness', 'ISR'],
    technologyTags: ['Mission Software', 'Open Architecture', 'Edge Analytics'],
    acquisitionStatus: 'rfp',
    horizon: 'near',
    sourceBadge: 'DoD release',
    sourceUrl: 'https://www.navy.mil/',
    track: 'tech',
    contentType: 'tech',
    highImpact: false,
    theNews: [
      'Navy modernization updates continue to reference open architecture and modular software insertion goals.',
      'Program offices are sequencing deliveries into shorter deployment increments.',
      'Contract language highlights interoperability with existing fleet command-and-control systems.',
    ],
    analystView: [
      {
        station: 'founder',
        bullets: [
          'This likely means narrow software modules with proven interoperability can access larger fleet programs faster.',
          'This likely means integration evidence in real operator environments is now table stakes.',
        ],
      },
      {
        station: 'prime_pm',
        bullets: [
          'This likely means delivery cadence and test discipline will matter more than monolithic platform scope.',
          'This likely means partner ecosystems need clear interface ownership early in capture.',
        ],
      },
      {
        station: 'investor',
        bullets: [
          'This likely means recurring software value is strengthening inside historically hardware-heavy naval portfolios.',
          'This likely means companies with deployment velocity evidence should outperform in diligence.',
        ],
      },
      {
        station: 'policy',
        bullets: [
          'This likely means open architecture policy is translating into concrete procurement behavior.',
          'This likely means oversight can focus on interoperability outcomes instead of platform-specific lock-in.',
        ],
      },
    ],
    roomForDisagreement: [
      'Legacy system constraints may slow the pace of modular insertion.',
      'Certification burden could reduce the intended speed benefits.',
    ],
    viewFrom: [
      {
        perspective: 'Fleet operators',
        note: 'Update frequency only helps when reliability remains predictable under mission pressure.',
      },
    ],
    notableLinks: [
      {
        label: 'Navy official updates',
        url: 'https://www.navy.mil/',
        source: 'primary',
      },
      {
        label: 'Acquisition analysis on MOSA',
        url: 'https://defensescoop.com/',
        source: 'deep_dive',
      },
    ],
    featured: false,
  },
]
