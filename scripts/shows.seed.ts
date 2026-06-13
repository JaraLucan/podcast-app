import type { ShowCategory } from "@/lib/types/database";

/**
 * Curated launch catalog (PRD §10). `search` is the query used against the
 * iTunes Search API by `seed-shows.ts` to resolve the real `rss_url`,
 * `image_url`, and `website_url` — so we never hardcode feed URLs that rot.
 * Always eyeball the resolved titles the seeder prints before trusting them.
 */
export type SeedShow = {
  slug: string;
  title: string;
  publisher: string;
  category: ShowCategory;
  description: string;
  search: string;
};

export const SEED_SHOWS: SeedShow[] = [
  // ── Tech ──────────────────────────────────────────────────────────────
  {
    slug: "lex-fridman",
    title: "Lex Fridman Podcast",
    publisher: "Lex Fridman",
    category: "tech",
    description:
      "Long-form conversations on science, technology, AI, power, and meaning.",
    search: "Lex Fridman Podcast",
  },
  {
    slug: "a16z",
    title: "a16z Podcast",
    publisher: "Andreessen Horowitz",
    category: "tech",
    description:
      "Andreessen Horowitz on technology, the future, and how it affects business and culture.",
    search: "a16z Podcast Andreessen Horowitz",
  },
  {
    slug: "hard-fork",
    title: "Hard Fork",
    publisher: "The New York Times",
    category: "tech",
    description:
      "Kevin Roose and Casey Newton on the tech news that matters and where it's heading.",
    search: "Hard Fork New York Times",
  },
  {
    slug: "decoder",
    title: "Decoder with Nilay Patel",
    publisher: "The Verge / Vox Media",
    category: "tech",
    description:
      "Big ideas and other problems — interviews on how tech leaders make decisions.",
    search: "Decoder with Nilay Patel",
  },
  {
    slug: "the-vergecast",
    title: "The Vergecast",
    publisher: "The Verge / Vox Media",
    category: "tech",
    description: "The flagship podcast of The Verge on the week in tech.",
    search: "The Vergecast",
  },
  {
    slug: "sharp-tech",
    title: "Sharp Tech with Ben Thompson",
    publisher: "Stratechery",
    category: "tech",
    description:
      "Ben Thompson and Andrew Sharp apply Stratechery's frameworks to the news.",
    search: "Sharp Tech with Ben Thompson",
  },

  // ── Business / startups / VC ──────────────────────────────────────────
  {
    slug: "all-in",
    title: "All-In",
    publisher: "All-In Podcast, LLC",
    category: "business",
    description:
      "Chamath, Jason, Sacks & Friedberg on tech, markets, politics, and poker.",
    search: "All-In with Chamath Jason Sacks Friedberg",
  },
  {
    slug: "acquired",
    title: "Acquired",
    publisher: "Ben Gilbert and David Rosenthal",
    category: "business",
    description:
      "The stories and strategies behind the world's greatest companies.",
    search: "Acquired podcast Ben Gilbert David Rosenthal",
  },
  {
    slug: "this-week-in-startups",
    title: "This Week in Startups",
    publisher: "Jason Calacanis",
    category: "business",
    description:
      "Jason Calacanis and guests on startups, venture capital, and building companies.",
    search: "This Week in Startups Jason Calacanis",
  },
  {
    slug: "lennys-podcast",
    title: "Lenny's Podcast",
    publisher: "Lenny Rachitsky",
    category: "business",
    description:
      "Product, growth, and career advice from the people who built the best products.",
    search: "Lenny's Podcast Product Growth Career",
  },
  {
    slug: "the-twenty-minute-vc",
    title: "The Twenty Minute VC (20VC)",
    publisher: "Harry Stebbings",
    category: "business",
    description:
      "Harry Stebbings interviews the world's best founders and investors.",
    search: "The Twenty Minute VC 20VC Harry Stebbings",
  },
  {
    slug: "the-logan-bartlett-show",
    title: "The Logan Bartlett Show",
    publisher: "Redpoint Ventures",
    category: "business",
    description:
      "Candid conversations with tech leaders and investors about building and investing.",
    search: "The Logan Bartlett Show Redpoint",
  },

  // ── Finance / markets ─────────────────────────────────────────────────
  {
    slug: "bg2",
    title: "BG2 Pod",
    publisher: "BG2Pod",
    category: "finance",
    description:
      "Brad Gerstner and Bill Gurley on markets, tech investing, and the macro.",
    search: "BG2Pod Brad Gerstner Bill Gurley",
  },
  {
    slug: "odd-lots",
    title: "Odd Lots",
    publisher: "Bloomberg",
    category: "finance",
    description:
      "Joe Weisenthal and Tracy Alloway on the most interesting topics in finance and economics.",
    search: "Odd Lots Bloomberg",
  },
  {
    slug: "the-compound-and-friends",
    title: "The Compound and Friends",
    publisher: "The Compound",
    category: "finance",
    description:
      "Josh Brown, Michael Batnick, and guests on markets, investing, and culture.",
    search: "The Compound and Friends",
  },
  {
    slug: "animal-spirits",
    title: "Animal Spirits",
    publisher: "The Compound",
    category: "finance",
    description:
      "Michael Batnick and Ben Carlson talk markets, life, and investing.",
    search: "Animal Spirits Podcast Compound",
  },
  {
    slug: "invest-like-the-best",
    title: "Invest Like the Best",
    publisher: "Colossus",
    category: "finance",
    description:
      "Patrick O'Shaughnessy explores markets, ideas, and life with leading investors and operators.",
    search: "Invest Like the Best Patrick OShaughnessy",
  },
  {
    slug: "masters-in-business",
    title: "Masters in Business",
    publisher: "Bloomberg",
    category: "finance",
    description:
      "Barry Ritholtz interviews the most influential people in business and finance.",
    search: "Masters in Business Barry Ritholtz Bloomberg",
  },
  {
    slug: "forward-guidance",
    title: "Forward Guidance",
    publisher: "Blockworks",
    category: "finance",
    description:
      "Macro investing, markets, and the global economy with top guests.",
    search: "Forward Guidance Blockworks",
  },
  {
    slug: "we-study-billionaires",
    title: "We Study Billionaires",
    publisher: "The Investor's Podcast Network",
    category: "finance",
    description:
      "Studying the financial markets and the strategies of billionaire investors.",
    search: "We Study Billionaires Investors Podcast",
  },
  {
    slug: "excess-returns",
    title: "Excess Returns",
    publisher: "Excess Returns",
    category: "finance",
    description:
      "Jack Forehand and Justin Carbonneau on evidence-based investing.",
    search: "Excess Returns investing podcast",
  },
  {
    slug: "prof-g-markets",
    title: "Prof G Markets",
    publisher: "Vox Media",
    category: "finance",
    description:
      "Scott Galloway and Ed Elson break down the week's biggest market stories.",
    search: "Prof G Markets Scott Galloway",
  },
  {
    slug: "capital-allocators",
    title: "Capital Allocators",
    publisher: "Ted Seides",
    category: "finance",
    description:
      "Ted Seides interviews the people who allocate the world's capital.",
    search: "Capital Allocators Ted Seides",
  },

  // ── AI ────────────────────────────────────────────────────────────────
  {
    slug: "dwarkesh",
    title: "Dwarkesh Podcast",
    publisher: "Dwarkesh Patel",
    category: "ai",
    description:
      "Deep, unhurried interviews on AI, history, science, and progress.",
    search: "Dwarkesh Podcast Patel",
  },
  {
    slug: "latent-space",
    title: "Latent Space",
    publisher: "swyx & Alessio",
    category: "ai",
    description:
      "The podcast for AI engineers — practical conversations on building with AI.",
    search: "Latent Space AI Engineer podcast",
  },
  {
    slug: "no-priors",
    title: "No Priors",
    publisher: "Conviction",
    category: "ai",
    description:
      "Sarah Guo and Elad Gil on AI, the technology, and the people building it.",
    search: "No Priors AI Sarah Guo Elad Gil",
  },
  {
    slug: "the-cognitive-revolution",
    title: "The Cognitive Revolution",
    publisher: "Erik Torenberg & Nathan Labenz",
    category: "ai",
    description:
      "How AI is changing everything — interviews with builders and researchers.",
    search: "The Cognitive Revolution AI podcast",
  },
  {
    slug: "ai-daily-brief",
    title: "The AI Daily Brief",
    publisher: "Nathaniel Whittemore",
    category: "ai",
    description:
      "A daily look at the most important news and discussions in AI.",
    search: "The AI Daily Brief Nathaniel Whittemore",
  },
  {
    slug: "mlst",
    title: "Machine Learning Street Talk",
    publisher: "MLST",
    category: "ai",
    description:
      "Technical, in-depth discussions on machine learning and AI research.",
    search: "Machine Learning Street Talk",
  },

  // ── Crypto ────────────────────────────────────────────────────────────
  {
    slug: "bankless",
    title: "Bankless",
    publisher: "Bankless",
    category: "crypto",
    description:
      "Ryan Sean Adams and David Hoffman on crypto, DeFi, and the open financial system.",
    search: "Bankless Ryan Sean Adams David Hoffman",
  },
];
