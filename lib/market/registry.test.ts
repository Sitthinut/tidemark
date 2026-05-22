import { describe, expect, it } from "vitest";
import { listProviders, resolveProvider } from "./registry";

describe("resolveProvider", () => {
  it("routes yahoo source → yahoo provider", () => {
    expect(resolveProvider("yahoo", "AAPL").id).toBe("yahoo");
    expect(resolveProvider("yahoo", "^GSPC").id).toBe("yahoo");
    expect(resolveProvider("yahoo", "PTT.BK").id).toBe("yahoo");
  });

  it("routes thai_mutual_fund source → sec-thailand provider", () => {
    expect(resolveProvider("thai_mutual_fund", "K-FIXED-A").id).toBe("sec-thailand");
    expect(resolveProvider("thai_mutual_fund", "SCBS&P500").id).toBe("sec-thailand");
  });

  it("throws for an unknown source", () => {
    expect(() => resolveProvider("alpaca", "AAPL")).toThrow(/No provider matches/);
  });

  it("ships both yahoo and sec-thailand providers", () => {
    const ids = listProviders().map((p) => p.id);
    expect(ids).toContain("yahoo");
    expect(ids).toContain("sec-thailand");
  });
});
