import { describe, expect, it } from "vitest";
import type { Holding, MixSlice } from "@/lib/static/types";
import { computeHealth } from "./health";
import { scorePortfolio } from "./score";

// ─── Test fixture helpers ────────────────────────────────────────────────────

function holding(partial: Partial<Holding> & { ticker: string; value: number }): Holding {
  return {
    ticker: partial.ticker,
    name: partial.name ?? partial.ticker,
    category: partial.category ?? "Fund",
    class: partial.class ?? "equity",
    region: partial.region ?? "United States",
    value: partial.value,
    cost: partial.cost ?? partial.value,
    units: partial.units ?? 1,
    nav: partial.nav ?? 1,
    d1: 0,
    ytd: 0,
    y1: 0,
    ter: partial.ter ?? 0,
    color: "var(--accent)",
    source: "",
  };
}

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("scorePortfolio — empty portfolio", () => {
  it("returns full marks except fees=0 and concentration=25 for an empty portfolio", () => {
    // Empty portfolio: no holdings, totalValue = 0
    const health = computeHealth([], 0, null);
    const score = scorePortfolio(health, false);

    // total should be valid (0..100) and structured correctly
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.components).toHaveLength(4);
    expect(score.hasTarget).toBe(false);

    // Drift: no target → full marks (30)
    const drift = score.components.find((c) => c.key === "drift");
    expect(drift?.score).toBe(30);

    // Cash: 0% cash → full marks (20)
    const cash = score.components.find((c) => c.key === "cash");
    expect(cash?.score).toBe(20);

    // Concentration: HHI = 0 for empty → full marks (25)
    const conc = score.components.find((c) => c.key === "concentration");
    expect(conc?.score).toBe(25);

    // Fees: TER = 0 → 25 pts
    const fees = score.components.find((c) => c.key === "fees");
    expect(fees?.score).toBe(25);
  });
});

// ─── Perfect alignment scenario ──────────────────────────────────────────────

describe("scorePortfolio — perfect alignment", () => {
  const perfectHoldings: Holding[] = [
    holding({ ticker: "SCBS&P500", value: 500, class: "equity", ter: 0.1 }),
    holding({ ticker: "K-WORLDX", value: 300, class: "equity", ter: 0.1 }),
    holding({ ticker: "K-FIXED-A", value: 200, class: "bond", ter: 0.1 }),
  ];
  const perfectMix: MixSlice[] = [
    { label: "US Equity", pct: 50, ticker: "SCBS&P500", color: "var(--accent)" },
    { label: "Global Equity", pct: 30, ticker: "K-WORLDX", color: "#7C7CFF" },
    { label: "Thai Bonds", pct: 20, ticker: "K-FIXED-A", color: "#F4A434" },
  ];

  it("scores very high when on-target, cheap, diversified, and no cash", () => {
    const health = computeHealth(perfectHoldings, 1000, perfectMix, 0.1);
    const score = scorePortfolio(health, true);

    // Drift: 0pp → 30/30
    expect(score.components.find((c) => c.key === "drift")?.score).toBe(30);

    // Fees: 0.10% TER ≤ 0.20% → 25/25
    expect(score.components.find((c) => c.key === "fees")?.score).toBe(25);

    // Cash: 0% → 20/20
    expect(score.components.find((c) => c.key === "cash")?.score).toBe(20);

    // 3 funds at 50/30/20 → HHI = 0.38 → concentration = 6/25, total = 81
    // (drift 30 + fees 25 + conc 6 + cash 20)
    expect(score.total).toBeGreaterThanOrEqual(80);
  });
});

// ─── Heavy drift ─────────────────────────────────────────────────────────────

describe("scorePortfolio — heavy drift", () => {
  // Holdings heavily overweight equities, underweight bonds
  const holdings: Holding[] = [
    holding({ ticker: "SCBS&P500", value: 900, class: "equity", ter: 0.3 }),
    holding({ ticker: "K-FIXED-A", value: 100, class: "bond", ter: 0.2 }),
  ];
  const target: MixSlice[] = [
    { label: "US Equity", pct: 60, ticker: "SCBS&P500", color: "var(--accent)" },
    { label: "Thai Bonds", pct: 40, ticker: "K-FIXED-A", color: "#F4A434" },
  ];

  it("deducts heavily from drift component when far off target", () => {
    const health = computeHealth(holdings, 1000, target);
    // trackingGapPp = overweight sum = SCBS&P500 +30pp = 30
    expect(health.trackingGapPp).toBeCloseTo(30);

    const score = scorePortfolio(health, true);
    const drift = score.components.find((c) => c.key === "drift");

    // 30pp drift → score = max(0, 30 - 30*2) = 0
    expect(drift?.score).toBe(0);
    expect(drift?.max).toBe(30);
  });

  it("keeps total score valid (0..100) under extreme drift", () => {
    const health = computeHealth(holdings, 1000, target);
    const score = scorePortfolio(health, true);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });
});

// ─── Drift with no target ─────────────────────────────────────────────────────

describe("scorePortfolio — no target (hasTarget = false)", () => {
  const holdings: Holding[] = [
    holding({ ticker: "SCBS&P500", value: 800, class: "equity", ter: 1.5 }),
    holding({ ticker: "K-FIXED-A", value: 200, class: "bond", ter: 0.5 }),
  ];

  it("awards full drift marks when no target is set", () => {
    const health = computeHealth(holdings, 1000, null);
    const score = scorePortfolio(health, false);
    const drift = score.components.find((c) => c.key === "drift");
    expect(drift?.score).toBe(30);
    expect(drift?.max).toBe(30);
    expect(drift?.detail).toContain("No target set");
    expect(score.hasTarget).toBe(false);
  });
});

// ─── Fee component rules ──────────────────────────────────────────────────────

describe("scorePortfolio — fee component", () => {
  function healthWithTer(ter: number) {
    return computeHealth([holding({ ticker: "X", value: 1000, ter })], 1000, null);
  }

  it("awards 25 pts at index-grade TER (≤ 0.20%)", () => {
    const score = scorePortfolio(healthWithTer(0.1), false);
    expect(score.components.find((c) => c.key === "fees")?.score).toBe(25);
  });

  it("awards 25 pts exactly at the 0.20% boundary", () => {
    const score = scorePortfolio(healthWithTer(0.2), false);
    expect(score.components.find((c) => c.key === "fees")?.score).toBe(25);
  });

  it("awards 0 pts at TER ≥ 2.0%", () => {
    const score = scorePortfolio(healthWithTer(2.0), false);
    expect(score.components.find((c) => c.key === "fees")?.score).toBe(0);
  });

  it("awards 0 pts at TER > 2.0% (clamped)", () => {
    const score = scorePortfolio(healthWithTer(3.0), false);
    expect(score.components.find((c) => c.key === "fees")?.score).toBe(0);
  });

  it("interpolates linearly at TER = 1.1% (midpoint)", () => {
    // midpoint of [0.20, 2.0]: (0.20 + 2.0) / 2 = 1.10 → 12.5 pts → rounds to 13
    const score = scorePortfolio(healthWithTer(1.1), false);
    const feeScore = score.components.find((c) => c.key === "fees")?.score ?? -1;
    expect(feeScore).toBeGreaterThanOrEqual(12);
    expect(feeScore).toBeLessThanOrEqual(13);
  });
});

// ─── Concentration component rules ───────────────────────────────────────────

describe("scorePortfolio — concentration component", () => {
  it("awards full marks for a well-spread portfolio (many equal-weight funds)", () => {
    // 10 equal funds → HHI = 0.1, score = max(0, 25 * (1 - 0.1/0.5)) = 25*0.8 = 20
    const tenFunds = Array.from({ length: 10 }, (_, i) =>
      holding({ ticker: `FUND${i}`, value: 100 }),
    );
    const health = computeHealth(tenFunds, 1000, null);
    const score = scorePortfolio(health, false);
    const conc = score.components.find((c) => c.key === "concentration");
    // HHI = 10 * (0.1^2) = 0.1 → score = 25 * (1 - 0.2) = 20
    expect(conc?.score).toBe(20);
  });

  it("awards near-0 pts for a single-fund portfolio (maximum concentration)", () => {
    // Single fund → HHI = 1.0, score = max(0, 25 * (1 - 2)) = 0
    const single = [holding({ ticker: "SCBS&P500", value: 1000 })];
    const health = computeHealth(single, 1000, null);
    const score = scorePortfolio(health, false);
    const conc = score.components.find((c) => c.key === "concentration");
    expect(conc?.score).toBe(0);
  });
});

// ─── Cash drag component rules ────────────────────────────────────────────────

describe("scorePortfolio — cash drag component", () => {
  function healthWithCash(cashPct: number) {
    const cashValue = cashPct * 10; // total = 1000
    const equityValue = 1000 - cashValue;
    const hlds = [
      holding({ ticker: "SCBS&P500", value: equityValue, class: "equity" }),
      holding({ ticker: "KFCASH-A", value: cashValue, class: "cash" }),
    ].filter((h) => h.value > 0);
    return computeHealth(hlds, 1000, null);
  }

  it("awards 20 pts when cash ≤ 2%", () => {
    const score = scorePortfolio(healthWithCash(1), false);
    expect(score.components.find((c) => c.key === "cash")?.score).toBe(20);
  });

  it("awards 20 pts exactly at the 2% boundary", () => {
    const score = scorePortfolio(healthWithCash(2), false);
    expect(score.components.find((c) => c.key === "cash")?.score).toBe(20);
  });

  it("awards 0 pts at cash ≥ 20%", () => {
    const score = scorePortfolio(healthWithCash(20), false);
    expect(score.components.find((c) => c.key === "cash")?.score).toBe(0);
  });

  it("awards 0 pts at cash > 20% (clamped)", () => {
    const score = scorePortfolio(healthWithCash(50), false);
    expect(score.components.find((c) => c.key === "cash")?.score).toBe(0);
  });
});

// ─── Component structure invariants ──────────────────────────────────────────

describe("scorePortfolio — structural invariants", () => {
  const someHoldings: Holding[] = [
    holding({ ticker: "SCBS&P500", value: 600, class: "equity", ter: 0.4 }),
    holding({ ticker: "K-FIXED-A", value: 300, class: "bond", ter: 0.2 }),
    holding({ ticker: "KFCASH-A", value: 100, class: "cash", ter: 0.1 }),
  ];

  it("total equals sum of component scores", () => {
    const health = computeHealth(someHoldings, 1000, null);
    const score = scorePortfolio(health, false);
    const componentSum = score.components.reduce((s, c) => s + c.score, 0);
    expect(score.total).toBe(componentSum);
  });

  it("component maxes sum to 100", () => {
    const health = computeHealth(someHoldings, 1000, null);
    const score = scorePortfolio(health, false);
    const maxSum = score.components.reduce((s, c) => s + c.max, 0);
    expect(maxSum).toBe(100);
  });

  it("all component scores are within [0, max]", () => {
    const health = computeHealth(someHoldings, 1000, null);
    const score = scorePortfolio(health, false);
    for (const c of score.components) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(c.max);
    }
  });

  it("returns exactly 4 components with expected keys", () => {
    const health = computeHealth(someHoldings, 1000, null);
    const score = scorePortfolio(health, false);
    const keys = score.components.map((c) => c.key);
    expect(keys).toEqual(["drift", "fees", "concentration", "cash"]);
  });

  it("total is always an integer in [0, 100]", () => {
    const health = computeHealth(someHoldings, 1000, null);
    const score = scorePortfolio(health, false);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(Number.isInteger(score.total)).toBe(true);
  });
});
