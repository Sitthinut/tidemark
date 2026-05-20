// Number formatting helpers

export function fmtTHBClean(n: number, decimals = 0): string {
  const v = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(n));
  return (n < 0 ? "-" : "") + "฿" + v;
}

export function fmtPct(n: number, decimals = 1): string {
  return (n >= 0 ? "+" : "") + n.toFixed(decimals) + "%";
}

export function fmtNum(n: number, d = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n);
}
