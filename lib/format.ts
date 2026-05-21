// Number formatting helpers

export function fmtTHBClean(n: number, decimals = 0): string {
  const v = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(n));
  return `${n < 0 ? "-" : ""}฿${v}`;
}

export function fmtPct(n: number, decimals = 1): string {
  return `${(n >= 0 ? "+" : "") + n.toFixed(decimals)}%`;
}

export function fmtNum(n: number, d = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n);
}

const DAY_MS = 86_400_000;

export function fmtRelativeDate(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const days = Math.max(0, Math.floor((now.getTime() - then.getTime()) / DAY_MS));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)} months ago`;
}
