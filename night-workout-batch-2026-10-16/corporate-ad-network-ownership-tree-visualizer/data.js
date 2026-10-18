/* Ad Network Ownership Tree — bundled STATIC reference data.
 * This is an approximate, educational snapshot compiled for this extension.
 * It is NOT live corporate data: acquisitions, rebrands, and shutdowns happen
 * constantly. Treat every entry as "to the best of our knowledge" and verify
 * anything important against official sources. Users can edit entries in the UI. */
const AD_TREE = [
  {
    name: 'Alphabet', kind: 'Parent company', note: 'Holding company of Google.',
    children: [
      { name: 'Google Ads', kind: 'Ad platform', note: 'Search & display ads.' },
      { name: 'Google Ad Manager', kind: 'Ad server/SSP', note: 'Formerly DoubleClick for Publishers.' },
      { name: 'Google AdMob', kind: 'Mobile ad network', note: 'In-app advertising.' },
      { name: 'Google AdSense', kind: 'Publisher network', note: 'Contextual ads for publishers.' },
      { name: 'YouTube Ads', kind: 'Video ads', note: 'Sold via Google Ads.' },
      { name: 'Display & Video 360', kind: 'DSP', note: 'Enterprise demand-side platform.' }
    ]
  },
  {
    name: 'Meta', kind: 'Parent company', note: 'Formerly Facebook.',
    children: [
      { name: 'Meta Ads (Facebook/Instagram)', kind: 'Ad platform', note: 'Social ads across Meta apps.' },
      { name: 'Meta Audience Network', kind: 'Ad network', note: 'Off-platform mobile ad placements.' }
    ]
  },
  {
    name: 'Amazon', kind: 'Parent company',
    children: [
      { name: 'Amazon Ads', kind: 'Ad platform', note: 'Sponsored products, DSP, streaming TV ads.' }
    ]
  },
  {
    name: 'Microsoft', kind: 'Parent company',
    children: [
      { name: 'Microsoft Advertising', kind: 'Ad platform', note: 'Search ads (Bing) and retail media.' },
      { name: 'Xandr', kind: 'Ad exchange/SSP', note: 'Acquired from AT&T in 2021.' },
      { name: 'LinkedIn Ads', kind: 'Ad platform', note: 'LinkedIn is a Microsoft subsidiary.' }
    ]
  },
  {
    name: 'Magnite', kind: 'Independent', note: 'Formed by the Rubicon Project + Telaria merger.',
    children: [
      { name: 'Rubicon Project', kind: 'SSP (legacy)', note: 'Merged into Magnite.' },
      { name: 'Telaria', kind: 'Video SSP (legacy)', note: 'Merged into Magnite.' },
      { name: 'SpotX', kind: 'Video SSP', note: 'Acquired by Magnite in 2021.' }
    ]
  },
  {
    name: 'The Trade Desk', kind: 'Independent DSP', note: 'Buy-side platform, no owned media.',
    children: []
  },
  {
    name: 'PubMatic', kind: 'Independent SSP', note: 'Supply-side platform for publishers.',
    children: []
  },
  {
    name: 'Criteo', kind: 'Independent', note: 'Retargeting and commerce media.',
    children: []
  },
  {
    name: 'Taboola', kind: 'Independent', note: 'Native/content-recommendation ads.',
    children: []
  },
  {
    name: 'Outbrain', kind: 'Independent', note: 'Native/content-recommendation ads.',
    children: []
  },
  {
    name: 'AppLovin', kind: 'Independent', note: 'Mobile app ads and mediation.',
    children: [
      { name: 'MAX (mediation)', kind: 'Mediation', note: 'AppLovin mediation platform.' },
      { name: 'Adjust', kind: 'Attribution', note: 'Mobile measurement, acquired by AppLovin.' }
    ]
  },
  {
    name: 'Unity', kind: 'Parent company', note: 'Game engine company.',
    children: [
      { name: 'Unity Ads', kind: 'Ad network', note: 'In-game advertising.' },
      { name: 'ironSource', kind: 'Ad platform', note: 'Merged with Unity in 2022.' }
    ]
  },
  {
    name: 'InMobi', kind: 'Independent', note: 'Mobile advertising platform (India/US).',
    children: [
      { name: 'Glance', kind: 'Adtech/surfaces', note: 'InMobi-backed lock-screen/content platform.' }
    ]
  },
  {
    name: 'Oracle', kind: 'Parent company (historical)', note: 'Wound down its ad business in 2024.',
    children: [
      { name: 'Oracle Advertising (legacy)', kind: 'Defunct', note: 'Data Cloud / Moat shut down in 2024.' }
    ]
  }
];
