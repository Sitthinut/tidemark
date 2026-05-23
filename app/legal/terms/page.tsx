export const metadata = { title: "Terms of Service · Macrotide" };

// Plain boilerplate — operator should review/replace before any public launch.
export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>Last updated: 2026-05-23</p>

      <h2>1. What Macrotide is</h2>
      <p>
        Macrotide is a self-hosted, open-source companion for index investors: it helps you track
        funds, plan allocations, and chat with an AI assistant. It is provided for personal,
        informational use only.
      </p>

      <h2>2. Not financial advice</h2>
      <p>
        Nothing in Macrotide — including AI-generated responses, analysis scores, or plan
        suggestions — constitutes financial, investment, tax, or legal advice. Figures may be
        delayed, estimated, or wrong. You are solely responsible for your investment decisions.
        Consult a licensed professional before acting.
      </p>

      <h2>3. Your account</h2>
      <p>
        You may sign in with a supported identity provider (Google, GitHub) or a passkey. You are
        responsible for keeping access to your sign-in methods secure. One account is intended for
        one person; do not share credentials.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        Do not use Macrotide to break the law, abuse the AI service (including attempts to exceed
        rate limits or token quotas), upload others' data without permission, or disrupt the service
        for other users.
      </p>

      <h2>5. AI features</h2>
      <p>
        Chat and OCR features send your input to third-party model providers via OpenRouter. Usage
        is subject to per-account token limits. Availability and model selection may change at any
        time.
      </p>

      <h2>6. No warranty</h2>
      <p>
        The service is provided "as is", without warranty of any kind. To the maximum extent
        permitted by law, the operator is not liable for any loss arising from your use of
        Macrotide, including investment losses or data loss.
      </p>

      <h2>7. Changes</h2>
      <p>
        These terms may be updated. Continued use after a change means you accept the revised terms.
      </p>

      <p style={{ marginTop: 32, color: "var(--muted)", fontSize: 13 }}>
        Questions? This is a personal, self-hosted deployment — contact the operator who invited
        you.
      </p>
    </>
  );
}
