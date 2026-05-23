export const metadata = { title: "Privacy Policy · Macrotide" };

// Plain boilerplate — operator should review/replace before any public launch.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>Last updated: 2026-05-23</p>

      <h2>1. Who runs this</h2>
      <p>
        Macrotide is a self-hosted, open-source app. This instance is operated by the individual who
        invited you. Your data lives in that operator's own database, not on a commercial Macrotide
        service.
      </p>

      <h2>2. What we store</h2>
      <ul>
        <li>
          <strong>Account:</strong> your name, email address, and the identity providers / passkeys
          you use to sign in.
        </li>
        <li>
          <strong>Your content:</strong> the buckets, holdings, plans, journal entries, and chat
          threads you create.
        </li>
        <li>
          <strong>Usage:</strong> per-day AI token counts used to enforce quotas.
        </li>
      </ul>

      <h2>3. Data isolation</h2>
      <p>
        Your records are scoped to your account and are not visible to other users of this instance.
        Built-in reference data (e.g. model portfolios) is shared and read-only.
      </p>

      <h2>4. Third parties</h2>
      <ul>
        <li>
          <strong>AI providers (via OpenRouter):</strong> text and images you submit to chat / OCR
          are sent to model providers to generate responses.
        </li>
        <li>
          <strong>Cloudflare Turnstile:</strong> used at sign-up for bot protection.
        </li>
        <li>
          <strong>OAuth providers (Google / GitHub):</strong> used only to authenticate you; we
          receive your basic profile (name, email) from them.
        </li>
        <li>
          <strong>Market data sources:</strong> queried for prices/NAVs; they do not receive your
          personal data.
        </li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        We use a session cookie to keep you signed in, and a separate cookie for the anonymous demo
        mode. No third-party advertising or tracking cookies are set.
      </p>

      <h2>6. Your choices</h2>
      <p>
        You can stop using the service at any time. To delete your account and associated data,
        contact the operator who invited you. Self-hosted operators can remove a user's data
        directly from the database.
      </p>

      <h2>7. Changes</h2>
      <p>This policy may be updated; the "last updated" date above will change accordingly.</p>
    </>
  );
}
