import Link from "next/link";
import type { ReactNode } from "react";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <Link href="/login" style={{ color: "var(--muted)", fontSize: 13, textDecoration: "none" }}>
          ← Back to Macrotide
        </Link>
        <article style={{ marginTop: 24, lineHeight: 1.65, fontSize: 15 }}>{children}</article>
      </div>
    </div>
  );
}
