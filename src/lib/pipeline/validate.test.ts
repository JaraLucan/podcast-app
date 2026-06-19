import { describe, expect, it } from "vitest";

import type { BriefContent } from "./types";
import { countBriefWords, findQuotes, LIMITS, validateBrief } from "./validate";

function makeBrief(overrides: Partial<BriefContent> = {}): BriefContent {
  return {
    tldr: "Gurley reversed his long-held stance on AI capex, calling 2024 spending by the major hyperscalers unsustainable above the two-hundred-billion-dollar level. He argued that the gap between infrastructure investment and realized revenue has now widened past anything he saw during the fiber buildout, and warned that the correction could arrive well before the models themselves turn profitable for most buyers.",
    takeaways: [
      "Microsoft will spend roughly eighty billion dollars on data centers in fiscal 2025, up about forty percent year over year, with the bulk earmarked for AI training clusters rather than traditional cloud capacity that still carries the company's margins today.",
      "Nvidia data-center revenue reached thirty billion dollars last quarter, more than triple the figure from a year earlier, and Gurley stressed that almost all of that demand traces back to a handful of well-capitalized buyers who could pull back quickly.",
      "The hosts disagreed sharply on whether OpenAI can realistically reach one hundred billion dollars in revenue by 2029, with one calling the target plausible given enterprise adoption and the other dismissing it as a financing narrative rather than a forecast.",
      "Gurley argued that public-market multiples for AI infrastructure names look stretched at twenty-five times forward sales, a level he compared directly to the late-nineties telecom bubble that wiped out most of the equity invested.",
      "Both agreed that inference costs are falling far faster than expected, which paradoxically pressures the economics of the very data centers being built today because the depreciation schedules assume far higher utilization than current demand supports.",
      "The conversation closed on the labor angle, with a prediction that the first genuinely autonomous enterprise agents ship in volume within eighteen months and reset how software is priced and sold across the sector.",
    ],
    key_moments: [
      { ts_seconds: 305, label: "Why Gurley changed his mind on capex" },
      { ts_seconds: 1120, label: "The fiber-buildout comparison" },
      { ts_seconds: 1820, label: "The two-hundred-billion sustainability debate" },
      { ts_seconds: 2740, label: "Falling inference costs and depreciation" },
      { ts_seconds: 3600, label: "OpenAI revenue projections clash" },
    ],
    numbers: [
      { label: "Microsoft FY25 data-center spend", value: "$80B", context: "up about 40% YoY" },
      { label: "Nvidia data-center revenue", value: "$30B", context: "last quarter, triple a year ago" },
      { label: "AI infrastructure forward multiple", value: "25x sales", context: "Gurley's bubble comparison" },
    ],
    why_it_matters:
      "The capex debate sets expectations for 2025 earnings across every hyperscaler and the chip supply chain beneath them. If Gurley is right that spending has outrun demand, the AI-infrastructure trade unwinds before most models reach profitability, and the pain lands first on the equipment and power suppliers that priced in years of uninterrupted growth. It is the clearest public reversal yet from an investor who spent the prior year defending the buildout.",
    ...overrides,
  };
}

describe("findQuotes", () => {
  it("finds straight and curly double-quoted spans", () => {
    expect(findQuotes('He said "buy the dip" loudly.')).toEqual(["buy the dip"]);
    expect(findQuotes("She called it “a bubble” today.")).toEqual([
      "a bubble",
    ]);
  });

  it("returns empty when there are no quotes", () => {
    expect(findQuotes("No quotes here at all.")).toEqual([]);
  });

  it("finds multiple quotes", () => {
    expect(findQuotes('"one" and "two"')).toEqual(["one", "two"]);
  });
});

describe("countBriefWords", () => {
  it("sums words across all rendered fields", () => {
    const n = countBriefWords(makeBrief());
    expect(n).toBeGreaterThan(80);
  });
});

describe("validateBrief", () => {
  it("passes a well-formed brief", () => {
    const flags = validateBrief(makeBrief(), 4000);
    expect(flags.passed).toBe(true);
    expect(flags.issues).toHaveLength(0);
  });

  it("flags more than one verbatim quote", () => {
    const flags = validateBrief(
      makeBrief({
        why_it_matters: 'He said "one quote" and also "a second quote" here.',
      }),
      4000,
    );
    expect(flags.passed).toBe(false);
    expect(flags.issues.some((i) => i.includes("verbatim quotes"))).toBe(true);
  });

  it("flags a quote longer than the word limit", () => {
    const longQuote =
      '"' + Array.from({ length: LIMITS.maxQuoteWords + 3 }, () => "word").join(" ") + '"';
    const flags = validateBrief(
      makeBrief({ tldr: `The guest said ${longQuote} on stage.` }),
      4000,
    );
    expect(flags.passed).toBe(false);
    expect(flags.issues.some((i) => i.includes("words"))).toBe(true);
  });

  it("flags too few takeaways", () => {
    const flags = validateBrief(
      makeBrief({ takeaways: ["only one"] }),
      4000,
    );
    expect(flags.issues.some((i) => i.includes("Takeaways out of range"))).toBe(
      true,
    );
  });

  it("flags a timestamp beyond the episode duration", () => {
    const flags = validateBrief(
      makeBrief({
        key_moments: [
          { ts_seconds: 100, label: "a" },
          { ts_seconds: 200, label: "b" },
          { ts_seconds: 999999, label: "way past the end" },
        ],
      }),
      4000,
    );
    expect(flags.passed).toBe(false);
    expect(flags.issues.some((i) => i.includes("exceeds episode duration"))).toBe(
      true,
    );
  });

  it("flags an empty required section", () => {
    const flags = validateBrief(makeBrief({ tldr: "" }), 4000);
    expect(flags.issues.some((i) => i.includes("Empty TL;DR"))).toBe(true);
  });

  it("flags banned filler phrasing", () => {
    const flags = validateBrief(
      makeBrief({ tldr: "In this episode, the hosts discuss AI capex trends." }),
      4000,
    );
    expect(flags.passed).toBe(false);
    expect(flags.issues.some((i) => i.includes("filler"))).toBe(true);
  });

  it("flags takeaways that lack concrete specifics", () => {
    const flags = validateBrief(
      makeBrief({
        takeaways: [
          "things were discussed at length",
          "the mood was generally optimistic",
          "they shared some opinions",
          "it was an interesting talk",
        ],
      }),
      4000,
    );
    expect(flags.passed).toBe(false);
    expect(flags.issues.some((i) => i.includes("concrete specific"))).toBe(true);
  });
});
