import { describe, expect, it } from "vitest";
import type { FundPortfolioRow } from "@/lib/db/queries/fund-enrichment";
import { buildPortfolioDisplayRows } from "./portfolio-display";

// Minimal row factory — only the fields the transform reads matter.
function row(p: Partial<FundPortfolioRow> & { id: number }): FundPortfolioRow {
  return {
    id: p.id,
    projId: "M0257_2564",
    period: "202603.0",
    asOfDate: "2026-03-31",
    assetliabId: p.assetliabId ?? null,
    assetliabDesc: p.assetliabDesc ?? null,
    issueCode: p.issueCode ?? null,
    isinCode: p.isinCode ?? null,
    issuer: p.issuer ?? null,
    assetliabValue: p.assetliabValue ?? null,
    percentNav: p.percentNav ?? null,
    lastUpdDate: null,
  };
}

describe("buildPortfolioDisplayRows", () => {
  it("collapses anonymous (no issuer/ISIN) rows into one net row, keeps named individual", () => {
    const rows = [
      row({
        id: 1,
        assetliabId: "108",
        assetliabDesc: "หน่วยลงทุน",
        issuer: "iShares Trust",
        percentNav: 100.98,
      }),
      row({
        id: 2,
        assetliabId: "216",
        assetliabDesc: "เงินฝาก",
        issuer: "Siam Commercial Bank",
        percentNav: 2.29,
      }),
      row({
        id: 3,
        assetliabId: "217",
        assetliabDesc: "เงินฝาก",
        issuer: "Kasikorn Bank",
        percentNav: 0.81,
      }),
      row({
        id: 4,
        assetliabId: "402",
        assetliabDesc: "สัญญาฟอร์เวิร์ด",
        issueCode: "CFX1",
        percentNav: -0.32,
      }),
      row({
        id: 5,
        assetliabId: "402",
        assetliabDesc: "สัญญาฟอร์เวิร์ด",
        issueCode: "CFX2",
        percentNav: -0.31,
      }),
      row({
        id: 6,
        assetliabId: "402",
        assetliabDesc: "สัญญาฟอร์เวิร์ด",
        issueCode: "CFX3",
        percentNav: 0.12,
      }),
    ];

    const out = buildPortfolioDisplayRows(rows);

    // 3 named (iShares + 2 banks) + 1 collapsed forward group = 4 display rows.
    expect(out).toHaveLength(4);

    // Largest weight leads.
    expect(out[0].label).toBe("หน่วยลงทุน");
    expect(out[0].percentNav).toBeCloseTo(100.98);

    // The forwards collapse into one net row, sorted last (negative net), and
    // expose their members for inline expansion.
    const group = out.at(-1);
    expect(group?.label).toBe("สัญญาฟอร์เวิร์ด (net · 3)");
    expect(group?.percentNav).toBeCloseTo(-0.51); // -0.32 - 0.31 + 0.12
    expect(group?.members).toHaveLength(3);
    expect(group?.issuer).toBeNull();
  });

  it("does not collapse a single anonymous row into a group label", () => {
    const out = buildPortfolioDisplayRows([
      row({
        id: 1,
        assetliabId: "402",
        assetliabDesc: "สัญญาฟอร์เวิร์ด",
        issueCode: "CFX1",
        percentNav: -0.1,
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("สัญญาฟอร์เวิร์ด"); // no "(net · N)" suffix
    expect(out[0].members).toBeUndefined();
  });

  it("keeps an equity fund's stocks individual (each has an issuer)", () => {
    const out = buildPortfolioDisplayRows([
      row({
        id: 1,
        assetliabDesc: "หุ้นสามัญ",
        issuer: "PTT PCL",
        isinCode: "TH0646010006",
        percentNav: 8.1,
      }),
      row({
        id: 2,
        assetliabDesc: "หุ้นสามัญ",
        issuer: "CP All PCL",
        isinCode: "TH0737010004",
        percentNav: 6.4,
      }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.members === undefined)).toBe(true);
  });
});
