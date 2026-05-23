// Transparent 0-100 composite portfolio-health score.
//
// Composed of four objective components derived from the health.ts signals —
// no AI calls, no black-box weights. Every deduction is explained by a short
// rule so the UI can show WHY the score is what it is.
//
// Component weights (must sum to 100):
//   drift         30 pts  — how closely the portfolio tracks its target mix
//   fees          25 pts  — blended expense ratio vs. index-grade benchmarks
//   concentration 25 pts  — Herfindahl–Hirschman diversification index
//   cash drag     20 pts  — uninvested cash as a % of portfolio
//
// Each component is scored independently and can be read in isolation.
// The total is their sum — nothing more.

import type { HealthSignals } from "./health";

export interface ScoreComponent {
  key: "drift" | "fees" | "concentration" | "cash";
  /** Short human-readable component name. */
  label: string;
  /** Points earned (0..max). Integer. */
  score: number;
  /** Maximum possible points for this component. */
  max: number;
  /** One-sentence explanation of why this component scored what it did. */
  detail: string;
}

export interface PortfolioScore {
  /** Sum of component scores, 0–100. Integer. */
  total: number;
  /** Individual component breakdown — ordered drift, fees, concentration, cash. */
  components: ScoreComponent[];
  /** Whether a target mix was present. When false, drift scores full marks. */
  hasTarget: boolean;
}

// ─── Component max-point allocations (must sum to 100) ─────────────────────
const DRIFT_MAX = 30;
const FEE_MAX = 25;
const CONC_MAX = 25;
const CASH_MAX = 20;

// ─── Scoring rules ──────────────────────────────────────────────────────────

/**
 * Drift sub-score (0–30 pts).
 *
 * Rule: −2 pts per percentage-point of tracking gap; full penalty at ≥ 15 pp.
 * No target → full marks (drift is undefined without a benchmark).
 *
 *   trackingGapPp = 0   → 30 pts
 *   trackingGapPp = 5   → 20 pts
 *   trackingGapPp = 10  → 10 pts
 *   trackingGapPp ≥ 15  →  0 pts
 */
function driftScore(trackingGapPp: number, hasTarget: boolean): ScoreComponent {
  if (!hasTarget) {
    return {
      key: "drift",
      label: "Drift from target",
      score: DRIFT_MAX,
      max: DRIFT_MAX,
      detail: "No target set — pick a model portfolio to track drift.",
    };
  }
  const score = Math.max(0, Math.round(DRIFT_MAX - trackingGapPp * 2));
  const detail =
    trackingGapPp < 1
      ? `Within 1 pp of target — excellent tracking.`
      : trackingGapPp < 5
        ? `${trackingGapPp.toFixed(1)} pp off target — acceptable, review at next rebalance.`
        : trackingGapPp < 10
          ? `${trackingGapPp.toFixed(1)} pp off target — consider rebalancing soon.`
          : `${trackingGapPp.toFixed(1)} pp off target — significant drift, rebalance recommended.`;
  return { key: "drift", label: "Drift from target", score, max: DRIFT_MAX, detail };
}

/**
 * Fee sub-score (0–25 pts).
 *
 * Rule: TER ≤ 0.20% → 25 pts; TER ≥ 2.0% → 0 pts; linear in between.
 * The band [0.20, 2.0] covers the realistic range from cheapest tracker to
 * expensive active fund. Each +0.072% TER above 0.20% costs ~1 point.
 *
 *   TER ≤ 0.20% → 25 pts   (index-grade)
 *   TER = 0.50% → ~21 pts
 *   TER = 1.00% → ~18 pts
 *   TER ≥ 2.00% →  0 pts
 */
function feeScore(ter: number): ScoreComponent {
  const score = ter <= 0.2 ? FEE_MAX : Math.max(0, Math.round(FEE_MAX * (1 - (ter - 0.2) / 1.8)));
  const detail =
    ter <= 0.2
      ? `${ter.toFixed(2)}% TER — index-grade efficiency.`
      : ter <= 0.75
        ? `${ter.toFixed(2)}% TER — reasonable for an index investor.`
        : ter <= 1.5
          ? `${ter.toFixed(2)}% TER — moderately high; consider cheaper alternatives.`
          : `${ter.toFixed(2)}% TER — high cost drag on long-term returns.`;
  return { key: "fees", label: "Blended fees", score, max: FEE_MAX, detail };
}

/**
 * Concentration sub-score (0–25 pts).
 *
 * Rule: uses the Herfindahl–Hirschman index (HHI, 0..1).
 *   HHI = 0     → 25 pts (theoretically infinite diversification)
 *   HHI = 0.25  → 12.5 pts (4 equal-weight funds)
 *   HHI ≥ 0.50  →  0 pts (≤ 2 equal funds — highly concentrated)
 *
 * Linear: score = max(0, 25 × (1 − HHI / 0.5))
 */
function concentrationScore(
  hhi: number,
  top: { ticker: string; pct: number } | null,
  top3Pct: number,
  holdingCount: number,
): ScoreComponent {
  const score = Math.max(0, Math.round(CONC_MAX * (1 - hhi / 0.5)));
  const detail =
    holdingCount === 0
      ? "No holdings."
      : hhi <= 0.1
        ? `Well diversified across ${holdingCount} fund${holdingCount !== 1 ? "s" : ""}.`
        : top && top.pct >= 35
          ? `${top.ticker} is ${top.pct.toFixed(0)}% of the book — heavily concentrated.`
          : top
            ? `${top.ticker} leads at ${top.pct.toFixed(0)}%; top-3 = ${top3Pct.toFixed(0)}%.`
            : "Portfolio present.";
  return { key: "concentration", label: "Diversification", score, max: CONC_MAX, detail };
}

/**
 * Cash-drag sub-score (0–20 pts).
 *
 * Rule: cash ≤ 2% → 20 pts; cash ≥ 20% → 0 pts; linear in between.
 * 2% is a reasonable emergency-buffer threshold; ≥ 20% is serious uninvested drag.
 *
 *   cash ≤ 2%   → 20 pts
 *   cash = 10%  → ~11 pts
 *   cash ≥ 20%  →  0 pts
 */
function cashScore(cashPct: number): ScoreComponent {
  const score =
    cashPct <= 2 ? CASH_MAX : Math.max(0, Math.round(CASH_MAX * (1 - (cashPct - 2) / 18)));
  const detail =
    cashPct <= 2
      ? `${cashPct.toFixed(1)}% cash — minimal drag.`
      : cashPct <= 10
        ? `${cashPct.toFixed(1)}% cash — small drag on returns.`
        : `${cashPct.toFixed(1)}% cash — notable drag; consider deploying.`;
  return { key: "cash", label: "Cash drag", score, max: CASH_MAX, detail };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute a transparent 0-100 composite portfolio-health score.
 *
 * The four components (drift, fees, concentration, cash) each contribute a
 * clearly-documented sub-score. The total is their sum — no hidden factors,
 * no AI calls. Pass `hasTarget = false` when no model-portfolio target has
 * been selected; drift then scores full marks rather than penalising the user
 * for not having set a target.
 *
 * @example
 * const health = computeHealth(holdings, totalValue, targetMix, targetTer);
 * const score  = scorePortfolio(health, targetMix !== null);
 * // score.total → e.g. 74
 * // score.components[0] → { key: "drift", score: 20, max: 30, detail: "…" }
 */
export function scorePortfolio(health: HealthSignals, hasTarget: boolean): PortfolioScore {
  const components: ScoreComponent[] = [
    driftScore(health.trackingGapPp, hasTarget),
    feeScore(health.blendedTer),
    concentrationScore(
      health.concentration.hhi,
      health.concentration.top,
      health.concentration.top3Pct,
      health.concentration.holdingCount,
    ),
    cashScore(health.cashPct),
  ];

  const total = components.reduce((s, c) => s + c.score, 0);
  return { total, components, hasTarget };
}
