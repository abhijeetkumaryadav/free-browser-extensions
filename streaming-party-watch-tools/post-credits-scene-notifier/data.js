// ─────────────────────────────────────────────────────────────
// CreditCheck — static post-credits dataset
// Compiled Oct 2026 from widely published guides. This is a STATIC
// guide shipped with the extension: there is no live movie database
// and no network access. Always double-check for new releases.
// Fields: mid  = scene during credits · post = scene after credits
// ─────────────────────────────────────────────────────────────
const CREDITS_DATA = [
  { title: "Avengers: Endgame",            year: 2019, mid: false, post: true,  note: "Audio sting only — no visual scene." },
  { title: "Avatar: The Way of Water",     year: 2022, mid: false, post: false, note: "No credits scenes." },
  { title: "Barbie",                       year: 2023, mid: true,  post: false, note: "Mid-credits gag scene." },
  { title: "Black Panther: Wakanda Forever", year: 2022, mid: true, post: false, note: "Mid-credits scene only." },
  { title: "Deadpool & Wolverine",         year: 2024, mid: true,  post: true,  note: "Mid-credits montage + post-credits joke." },
  { title: "Dune: Part Two",               year: 2024, mid: false, post: false, note: "No credits scenes." },
  { title: "Everything Everywhere All at Once", year: 2022, mid: true, post: false, note: "Mid-credits gag scene." },
  { title: "Godzilla x Kong: The New Empire", year: 2024, mid: false, post: false, note: "No credits scenes." },
  { title: "Guardians of the Galaxy Vol. 3", year: 2023, mid: true, post: true, note: "Mid-credits team tease + post-credits scene." },
  { title: "Inside Out 2",                 year: 2024, mid: true,  post: false, note: "Mid-credits scene only." },
  { title: "John Wick: Chapter 4",         year: 2023, mid: false, post: true,  note: "Post-credits scene." },
  { title: "Kingdom of the Planet of the Apes", year: 2024, mid: false, post: false, note: "No credits scenes." },
  { title: "Oppenheimer",                  year: 2023, mid: false, post: false, note: "No credits scenes." },
  { title: "Spider-Man: No Way Home",      year: 2021, mid: true,  post: true,  note: "Mid-credits cameo + post-credits teaser." },
  { title: "The Batman",                   year: 2022, mid: false, post: true,  note: "Post-credits tease." },
  { title: "The Marvels",                  year: 2023, mid: true,  post: false, note: "Mid-credits scene only." },
  { title: "The Super Mario Bros. Movie",  year: 2023, mid: true,  post: true,  note: "Mid-credits + post-credits scenes." },
  { title: "Top Gun: Maverick",            year: 2022, mid: false, post: false, note: "No credits scenes." },
  { title: "Wonka",                        year: 2023, mid: true,  post: false, note: "Mid-credits scene only." },
];
