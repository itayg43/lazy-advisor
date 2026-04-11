import type { ResponseInputItem } from "openai/resources/responses/responses";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { extractResearchSummary } from "#pipeline/stages/research/research.extraction";
import { ResearchSummarySchema } from "#schemas/pipeline.schema";

const LAST_RUN_PATH = new URL("RESEARCH_EXTRACTION_LAST_RUN.md", import.meta.url).pathname;

describe("researchExtraction", () => {
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastResult: unknown | undefined;

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: !ctx.task.result?.errors?.length,
      transcript: lastTranscript,
      profile: lastResult,
    });
    lastTranscript = lastResult = undefined;
  });

  const assertValidSummary = (summary: unknown): void => {
    const result = ResearchSummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  };

  // RESEARCH_EXAMPLES #5: 28yo moderate beginner, 20-year horizon, emergency fund.
  // Allocation: 60% global equities, 20% Israeli S&P 500 index funds, 20% קרן כספית.
  // Tests extraction of categories, tickers, expense ratios, tracking indices, and percentages.
  it("should extract categories with percentages, tickers, expense ratios, and tracking indices", async () => {
    const researchText = `
Allocation plan:
- Global Equities (FTSE All-World): 60%
- Israeli S&P 500 Index Funds (קרנות מחקות): 20%
- קרן כספית (Israeli Money Market): 20%

## Global Equities (FTSE All-World) — 60%

**VWRA — Vanguard FTSE All-World UCITS ETF (Accumulating)**
Tracks the FTSE All-World index, covering 4,000+ stocks across 50 countries. Accumulating structure — dividends reinvest inside the fund at a 15% withholding rate (US-Ireland tax treaty). Expense ratio: 0.22% per year. Irish-domiciled.
Source: https://www.vanguard.co.uk/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating

## Israeli S&P 500 Index Funds (קרנות מחקות) — 20%

**1159235 — Harel S&P 500 Tracking Fund**
Israeli index fund tracking the S&P 500 index. Shekel-denominated, traded on TASE. No currency conversion required. Annual management fee: 0.25%.
Source: https://maya.tase.co.il/fund/1159235

## קרן כספית (Israeli Money Market) — 20%

**5122505 — Migdal Money Market Fund**
Israeli money market fund (קרן כספית). Low-risk, shekel-denominated, highly liquid. Annual management fee: 0.03%.
Source: https://maya.tase.co.il/fund/5122505
    `.trim();

    const transcript: ResponseInputItem[] = [{ role: "user", content: researchText }];
    lastTranscript = [{ role: "user", content: researchText }];

    const summary = await extractResearchSummary(transcript);
    lastResult = summary;

    assertValidSummary(summary);
    expect(summary.categories.length).toBeGreaterThanOrEqual(3);

    const globalEquityCategory = summary.categories.find((c) =>
      c.allocationCategory.toLowerCase().match(/global equit|ftse all-world|world/i),
    );
    expect(globalEquityCategory).toBeDefined();
    expect(globalEquityCategory?.percentage).toBe(60);

    const vwra = globalEquityCategory?.etfs.find((e) => e.ticker === "VWRA");
    expect(vwra).toBeDefined();
    expect(vwra?.expenseRatio).toBe(0.22);
    expect(vwra?.trackingIndex.toLowerCase()).toMatch(/ftse all-world/);

    const israeliCategory = summary.categories.find((c) =>
      c.allocationCategory.match(/קרנות מחקות|s&p 500|ישראלי/i),
    );
    expect(israeliCategory).toBeDefined();
    expect(israeliCategory?.percentage).toBe(20);

    const harel = israeliCategory?.etfs.find((e) => e.ticker === "1159235");
    expect(harel).toBeDefined();
    expect(harel?.expenseRatio).toBe(0.25);
    expect(harel?.trackingIndex.toLowerCase()).toMatch(/s&p 500/);

    const moneyMarketCategory = summary.categories.find(
      (c) =>
        c.allocationCategory.includes("כספית") ||
        c.allocationCategory.toLowerCase().includes("money market"),
    );
    expect(moneyMarketCategory).toBeDefined();
    expect(moneyMarketCategory?.percentage).toBe(20);

    const migdal = moneyMarketCategory?.etfs.find((e) => e.ticker === "5122505");
    expect(migdal).toBeDefined();
    expect(migdal?.expenseRatio).toBe(0.03);
  });

  // RESEARCH_EXAMPLES #6: 25yo aggressive investor, 20+ year horizon, no bonds.
  // Allocation: 60% global equities, 30% emerging markets, 10% tech & automation.
  // SXRV is a thematic ETF with no tracking index mentioned → should default to "none".
  it("should default trackingIndex to none when not mentioned in research text", async () => {
    const researchText = `
Allocation plan:
- Global Equities (FTSE All-World): 60%
- Emerging Markets Equities: 30%
- Technology & Automation: 10%

## Global Equities (FTSE All-World) — 60%

**VWRA — Vanguard FTSE All-World UCITS ETF (Accumulating)**
Tracks the FTSE All-World index. Expense ratio: 0.22% per year. Irish-domiciled accumulating.
Source: https://www.vanguard.co.uk/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating

## Emerging Markets Equities — 30%

**EIMI — iShares Core MSCI Emerging Markets IMI UCITS ETF (Accumulating)**
Tracks the MSCI Emerging Markets Investable Market index, covering large, mid, and small-cap stocks across 24 emerging economies. Expense ratio: 0.18% per year. Irish-domiciled accumulating.
Source: https://www.ishares.com/uk/individual/en/products/264659/ishares-core-msci-emerging-markets-imi-ucits-etf

## Technology & Automation — 10%

**SXRV — iShares Automation & Robotics UCITS ETF**
Thematic fund investing in companies developing automation, robotics, and AI technologies. Expense ratio: 0.40% per year. Irish-domiciled accumulating.
Source: https://www.ishares.com/uk/individual/en/products/279174/ishares-automation-robotics-ucits-etf
    `.trim();

    const transcript: ResponseInputItem[] = [{ role: "user", content: researchText }];
    lastTranscript = [{ role: "user", content: researchText }];

    const summary = await extractResearchSummary(transcript);
    lastResult = summary;

    assertValidSummary(summary);

    const emergingCategory = summary.categories.find((c) =>
      c.allocationCategory.toLowerCase().match(/emerging/),
    );
    expect(emergingCategory).toBeDefined();
    expect(emergingCategory?.percentage).toBe(30);

    const eimi = emergingCategory?.etfs.find((e) => e.ticker === "EIMI");
    expect(eimi).toBeDefined();
    expect(eimi?.expenseRatio).toBe(0.18);
    expect(eimi?.trackingIndex.toLowerCase()).toMatch(/msci emerging/);

    const techCategory = summary.categories.find((c) =>
      c.allocationCategory.toLowerCase().match(/tech|automation|robot/),
    );
    expect(techCategory).toBeDefined();
    expect(techCategory?.percentage).toBe(10);

    const sxrv = techCategory?.etfs.find((e) => e.ticker === "SXRV");
    expect(sxrv).toBeDefined();
    expect(sxrv?.expenseRatio).toBe(0.4);
    expect(sxrv?.trackingIndex).toBe("none");
  });
});
