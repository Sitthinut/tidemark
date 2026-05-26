"use client";

// Macrotide — public marketing landing.
//
// Rendered by `/app/page.tsx` when there is no session and no demo cookie.
// This is the single source of the product pitch — the in-app onboarding does
// NOT duplicate this copy. CTAs route to real auth (/login) or start a real
// demo session via `/api/demo`; there is no simulated brokerage flow here.
//
// Honesty rule: anything not yet shipped is described as planned, never
// present. Status table is the README; intent is product-direction.md.
//
// Image-slot strategy: each <ImageSlot> keeps the source prompt in code, while
// the rendered page uses project-local screenshots and generated hero art.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

import { BrandMark } from "./BrandMark";
import "./landing.css";

/* ============================================================
 * <ImageSlot> — placeholder for real screenshots / abstract images
 *
 *   <ImageSlot kind="real" prompt="…" spec="…">
 *     <img src="/landing/portfolio.png" alt="" />
 *   </ImageSlot>
 *
 * Drop an <img> or <video> in as a child; CSS `:has()` hides the prompt.
 * ============================================================ */
interface ImageSlotProps {
  kind?: "real" | "abstract";
  prompt: string;
  spec?: string;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

function ImageSlot({
  kind = "real",
  prompt,
  spec,
  className = "",
  children,
  style,
}: ImageSlotProps) {
  const label = kind === "real" ? "Real app screenshot" : "Abstract image";
  return (
    <figure className={`mt-imgslot ${className}`} data-shot={kind} style={style}>
      {children}
      <div className="mt-imgslot-inner">
        <span className="mt-imgslot-kind">{label}</span>
        <div className="mt-imgslot-prompt">{prompt}</div>
        {spec ? <div className="mt-imgslot-spec">{spec}</div> : null}
      </div>
    </figure>
  );
}

/* ============================================================
 * Tiny inline icons
 * ============================================================ */
function ArrowIcon() {
  return (
    <svg
      className="mt-arrow"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ verticalAlign: "-2px" }}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.18c-3.2.7-3.87-1.36-3.87-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.44-2.69 5.41-5.25 5.69.41.36.78 1.07.78 2.16v3.2c0 .31.21.68.8.56 4.57-1.53 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

/* ============================================================
 * Header — brand · GitHub · Sign in · Get started
 * ============================================================ */
function Header({ onSignIn }: { onSignIn: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="mt-header" data-scrolled={scrolled}>
      <div className="mt-container mt-header-inner">
        <a className="mt-brand" href="#top">
          <span className="mt-brand-mark">
            <BrandMark />
          </span>
          Macrotide
        </a>
        <div className="mt-nav-right">
          <a
            className="mt-nav-link"
            href="https://github.com/Sitthinut/macrotide"
            target="_blank"
            rel="noreferrer"
          >
            <GitHubIcon /> <span style={{ marginLeft: 6 }}>GitHub</span>
          </a>
          <button type="button" className="mt-btn mt-btn-ghost" onClick={onSignIn}>
            Sign in
          </button>
          <button type="button" className="mt-btn mt-btn-primary" onClick={onSignIn}>
            Get started
          </button>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
 * Hero — center-aligned, single short headline, abstract image
 * ============================================================ */
function Hero({ onSignIn, onDemo, demoBusy }: HeroProps) {
  return (
    <section id="top" className="mt-hero">
      <div className="mt-container mt-narrow">
        <div className="mt-eyebrow">
          <span className="mt-eyebrow-dot" aria-hidden="true" />
          Open source · For Thai index investors
        </div>

        <h1 className="mt-h1">
          An honest mirror
          <br />
          for your <em>index portfolio.</em>
        </h1>

        <p className="mt-lede">
          Macrotide reads your Thai mutual-fund holdings and shows you what your index is really
          doing — and what your fees really cost. Proposes, never trades.
        </p>

        <div className="mt-cta-row">
          <button type="button" className="mt-btn mt-btn-primary mt-btn-lg" onClick={onSignIn}>
            Get started
            <ArrowIcon />
          </button>
          <button
            type="button"
            className="mt-btn mt-btn-secondary mt-btn-lg"
            onClick={onDemo}
            disabled={demoBusy}
          >
            {demoBusy ? "Loading the demo…" : "Explore the demo"}
          </button>
        </div>

        <div className="mt-micro-trust">
          <span>MIT-licensed</span>
          <span>Self-hostable</span>
          <span>Never sold or shared</span>
        </div>
      </div>

      <div className="mt-container">
        <div className="mt-hero-stage">
          <ImageSlot
            kind="abstract"
            className="mt-hero-image"
            prompt="Calm horizon at dawn — a single thin band of cool teal water between soft warm sand and a hazy off-white sky. Slow long-exposure, painterly grain, no people, no boats, no text. Suggests tide, patience, evidence. Subtle warm-to-cool gradient. Premium, restrained, financial-publication feel."
            spec="aspect-ratio 16 / 9 · prefer 2400×1350 · JPG or WebP"
          >
            <Image
              src="/landing/hero-tide.png"
              alt=""
              width={1672}
              height={941}
              priority
              sizes="(max-width: 720px) calc(100vw - 44px), min(100vw - 64px, 1120px)"
            />
          </ImageSlot>
          <div className="mt-hero-overlays" aria-hidden="true">
            <div className="mt-hero-overlay mt-overlay-tl">
              <div className="mt-ov-label">Health score</div>
              <div className="mt-ov-value">
                78<span className="mt-ov-unit">/ 100</span>
              </div>
              <div className="mt-ov-note">good · fee creep flagged · 1 holding</div>
            </div>
            <div className="mt-hero-overlay mt-overlay-br">
              <div className="mt-ov-label">Blended fee</div>
              <div className="mt-ov-value">
                0.74<span className="mt-ov-unit">% / yr</span>
              </div>
              <div className="mt-ov-note">value-weighted across 6 funds</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface HeroProps {
  onSignIn: () => void;
  onDemo: () => void;
  demoBusy: boolean;
}

/* ============================================================
 * Trust strip
 * ============================================================ */
function TrustStrip() {
  const items = [
    "Open source (MIT)",
    "Self-hostable on your VM",
    "Reads holdings — never trades",
    "Thai SEC fund data",
  ];
  return (
    <section className="mt-trust-strip">
      <div className="mt-container">
        <div className="mt-trust-row">
          {items.map((t) => (
            <div className="mt-trust-item" key={t}>
              <span className="mt-trust-pin" aria-hidden="true" />
              {t}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * What it does — three feature cards (live only)
 * ============================================================ */
function WhatItDoes() {
  return (
    <section id="what" className="mt-section">
      <div className="mt-container">
        <div className="mt-section-head">
          <div className="mt-section-eyebrow">What it does today</div>
          <h2 className="mt-h2">
            The honest version of <em>where you stand</em>.
          </h2>
          <p className="mt-section-lead">
            Three things, available now in the running app. Anything still planned is on the roadmap
            — and described that way.
          </p>
        </div>

        <div className="mt-feature-grid">
          <article className="mt-feature">
            <ImageSlot
              kind="real"
              className="mt-feature-img"
              prompt="Real app screenshot — Portfolio screen showing the health score (a single 0–100 number with a short breakdown), blended fee as a headline, and a compact allocation drift list. Light theme, Geist font. Macrotide app, dashboard view."
              spec="aspect 4 / 3 · 1200×900 · PNG"
            >
              <Image
                src="/landing/portfolio.png"
                alt="Macrotide portfolio dashboard"
                width={804}
                height={1070}
                sizes="(max-width: 880px) calc(100vw - 44px), 363px"
              />
            </ImageSlot>
            <div className="mt-feature-body">
              <h3 className="mt-feature-title">Honest portfolio analysis</h3>
              <p className="mt-feature-text">
                Allocation, drift, blended fee, concentration, and cash drag — rolled into a
                transparent 0–100 health score.
              </p>
            </div>
          </article>

          <article className="mt-feature">
            <ImageSlot
              kind="real"
              className="mt-feature-img"
              prompt="Real app screenshot — Performance vs index. A clean line chart of the user's portfolio vs S&P 500 (or SET) over 1Y, with a small comparison readout above the chart. Light theme, Geist font."
              spec="aspect 4 / 3 · 1200×900 · PNG"
            >
              <Image
                src="/landing/performance.png"
                alt="Macrotide performance chart"
                width={804}
                height={1070}
                sizes="(max-width: 880px) calc(100vw - 44px), 363px"
              />
            </ImageSlot>
            <div className="mt-feature-body">
              <h3 className="mt-feature-title">Performance vs your index</h3>
              <p className="mt-feature-text">
                Real, aligned benchmark series — SET, S&amp;P 500, Nasdaq, Nikkei — over the same
                window as your portfolio.
              </p>
            </div>
          </article>

          <article className="mt-feature">
            <ImageSlot
              kind="real"
              className="mt-feature-img"
              prompt="Real app screenshot — Advisor chat with one accept-only proposal card (plan edit) visible mid-conversation. Show the Accept / Reject buttons clearly. Light theme, Geist font."
              spec="aspect 4 / 3 · 1200×900 · PNG"
            >
              <Image
                src="/landing/advisor-chat.png"
                alt="Macrotide advisor chat beside portfolio"
                width={1440}
                height={1070}
                sizes="(max-width: 880px) calc(100vw - 44px), 363px"
              />
            </ImageSlot>
            <div className="mt-feature-body">
              <h3 className="mt-feature-title">Advisor that proposes</h3>
              <p className="mt-feature-text">
                An Advisor that reads your real portfolio. Every write is an accept-only proposal
                card — you stay in the loop.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Advisor spotlight — phone-shaped portrait shot + copy
 * ============================================================ */
function AdvisorSpotlight() {
  return (
    <section className="mt-section mt-section-tight">
      <div className="mt-container">
        <div className="mt-bigrow">
          <div className="mt-phone-wrap">
            <ImageSlot
              kind="real"
              className="mt-shot mt-shot-phone"
              prompt="Real app screenshot — Advisor chat on mobile (portrait). Shows 2–3 messages and one accept-only proposal card with a small plan diff (e.g. 'Trim K-USA-A −฿57,400'). Light theme, Geist font. Captured from the actual Macrotide app on a phone viewport (~390×844)."
              spec="aspect 9 / 16 · 1080×1920 · PNG, transparent or warm-cream bg"
            >
              <Image
                src="/landing/advisor-mobile.png"
                alt="Macrotide advisor chat on mobile"
                width={390}
                height={814}
                sizes="min(280px, 88vw)"
              />
            </ImageSlot>
          </div>
          <div className="mt-bigrow-copy">
            <div className="mt-kicker">The Advisor · reads on phone, laptop, anywhere</div>
            <h3 className="mt-h3">Reads your portfolio. Proposes, never trades.</h3>
            <p className="mt-p">
              The Advisor calls scoped tools against your real holdings — it doesn't guess at an
              "average" investor. Every write is surfaced as a proposal card you accept or reject.
              Nothing happens silently, and no order is ever placed.
            </p>
            <p className="mt-p">
              If a number isn't available, it says so. The Advisor references only figures its tools
              actually returned.
            </p>
            <a className="mt-quiet-link" href="#what">
              See what the Advisor can do →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * The loop — four pillars, shipped vs planned
 * ============================================================ */
const PILLARS: Array<{
  num: string;
  name: string;
  body: string;
  tag: "shipped" | "planned";
  tagLabel: string;
}> = [
  {
    num: "01",
    name: "Learn",
    body: "Short, evidence-based reads on index investing — woven into the Advisor.",
    tag: "planned",
    tagLabel: "On the roadmap",
  },
  {
    num: "02",
    name: "Analyze",
    body: "Allocation, drift, blended fee, concentration, performance vs your index.",
    tag: "shipped",
    tagLabel: "Available now",
  },
  {
    num: "03",
    name: "Research",
    body: "Today: an RSS feed. Planned: a clustered brief and a digest grounded in your holdings.",
    tag: "planned",
    tagLabel: "Partly shipped · synthesis planned",
  },
  {
    num: "04",
    name: "Select",
    body: "A fee-aware fund finder that names the lowest-fee fund for the exposure you want.",
    tag: "planned",
    tagLabel: "Flagship next bet",
  },
];

function Loop() {
  return (
    <section id="loop" className="mt-section mt-loop">
      <div className="mt-container">
        <div className="mt-section-head">
          <div className="mt-section-eyebrow">The four-stage loop</div>
          <h2 className="mt-h2">
            Learn. Analyze. Research. <em className="mt-em-blue">Select.</em>
          </h2>
          <p className="mt-section-lead">
            The loop a self-directed index investor actually walks, repeatedly. Each pillar is
            labeled by what's shipped and what's still planned.
          </p>
        </div>

        <div className="mt-loop-list">
          {PILLARS.map((p) => (
            <div className="mt-loop-item" key={p.name}>
              <div className="mt-loop-num">Pillar {p.num}</div>
              <h3 className="mt-loop-h">{p.name}</h3>
              <p className="mt-loop-text">{p.body}</p>
              <div className="mt-pillar-tag-row">
                <span className={`mt-tag mt-tag-${p.tag}`}>
                  <span className="mt-tag-dot" />
                  {p.tagLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Open source — no faux stats
 * ============================================================ */
function OpenSource() {
  return (
    <section id="open" className="mt-section mt-open-source">
      <div className="mt-container mt-narrow">
        <div className="mt-section-head" style={{ marginBottom: 0 }}>
          <div className="mt-section-eyebrow">Built honestly</div>
          <h2 className="mt-h2">
            Open by default. <em>Yours</em> by default.
          </h2>
          <p className="mt-section-lead">
            Macrotide is a personal-use experiment, soft-public for family and friends. The code is
            public, the data stays with you, and the Advisor cannot move money.
          </p>
        </div>

        <div className="mt-os-badges">
          <div className="mt-os-badge">
            <span className="mt-os-v">MIT</span>
            <span className="mt-os-l">License</span>
          </div>
          <div className="mt-os-badge">
            <span className="mt-os-v">Self-host</span>
            <span className="mt-os-l">Single-owner VM</span>
          </div>
          <div className="mt-os-badge">
            <span className="mt-os-v">SQLite</span>
            <span className="mt-os-l">On your instance</span>
          </div>
          <div className="mt-os-badge">
            <span className="mt-os-v">Passkey</span>
            <span className="mt-os-l">Sign-in</span>
          </div>
          <div className="mt-os-badge">
            <span className="mt-os-v">Read-only</span>
            <span className="mt-os-l">Advisor scope</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Final CTA
 * ============================================================ */
function FinalCta({ onSignIn, onDemo, demoBusy }: HeroProps) {
  return (
    <section className="mt-final-cta">
      <div className="mt-container mt-narrow">
        <h2 className="mt-h2-final">
          See whether you're <em>actually</em>
          <br />
          matching your index.
        </h2>
        <p className="mt-section-lead" style={{ marginInline: "auto" }}>
          Sign in with a passkey — or poke around the no-signup demo. Either way, you'll know your
          blended fee in under a minute.
        </p>
        <div className="mt-cta-row" style={{ justifyContent: "center", marginTop: 32 }}>
          <button type="button" className="mt-btn mt-btn-primary mt-btn-lg" onClick={onSignIn}>
            Get started
            <ArrowIcon />
          </button>
          <button
            type="button"
            className="mt-btn mt-btn-secondary mt-btn-lg"
            onClick={onDemo}
            disabled={demoBusy}
          >
            {demoBusy ? "Loading the demo…" : "Explore the demo"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Footer
 * ============================================================ */
function Footer() {
  return (
    <footer className="mt-footer">
      <div className="mt-container">
        <div className="mt-footer-row">
          <div className="mt-footer-left">
            <a className="mt-brand" href="#top">
              <span className="mt-brand-mark">
                <BrandMark />
              </span>
              Macrotide
            </a>
            <small className="mt-footer-disclaimer">
              Experimental software. Not investment, tax, or legal advice. Don't rely on it for real
              investment decisions.
            </small>
          </div>
          <div className="mt-footer-links">
            <a href="https://github.com/Sitthinut/macrotide/blob/main/README.md">README</a>
            <a href="https://github.com/Sitthinut/macrotide/blob/main/ROADMAP.md">Roadmap</a>
            <a href="https://github.com/Sitthinut/macrotide/tree/main/docs">Docs</a>
            <a href="https://github.com/Sitthinut/macrotide">GitHub</a>
            <a href="https://github.com/Sitthinut/macrotide/blob/main/LICENSE">MIT License</a>
            <a href="https://github.com/Sitthinut/macrotide/blob/main/SECURITY.md">Security</a>
          </div>
        </div>
        <div className="mt-footer-bottom">
          <span>© 2026 Macrotide — personal-use experiment</span>
          <span>Thai SEC Open API · long-term index investing</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
 * Top-level
 * ============================================================ */
export default function Landing() {
  const router = useRouter();
  const [demoBusy, setDemoBusy] = useState(false);

  function onSignIn() {
    router.push("/login");
  }

  async function onDemo() {
    setDemoBusy(true);
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      if (!res.ok) throw new Error("demo start failed");
      router.replace("/");
    } catch {
      setDemoBusy(false);
    }
  }

  return (
    <div className="mt-landing-root">
      <Header onSignIn={onSignIn} />
      <main>
        <Hero onSignIn={onSignIn} onDemo={onDemo} demoBusy={demoBusy} />
        <TrustStrip />
        <WhatItDoes />
        <AdvisorSpotlight />
        <Loop />
        <OpenSource />
        <FinalCta onSignIn={onSignIn} onDemo={onDemo} demoBusy={demoBusy} />
      </main>
      <Footer />
    </div>
  );
}
