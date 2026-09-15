/**
 * Central source of truth for legal policy versions and document content.
 *
 * When a policy changes materially, bump its version here. The signup API and
 * legal acceptance API both read from this module, so a version bump will:
 *   - Require new signups to accept the new version.
 *   - Allow the re-acceptance mechanism to detect outdated acceptances for
 *     existing users (compare LegalAcceptance.version vs CURRENT_VERSIONS).
 *
 * Document content lives here too so it can be served publicly (for the
 * landing page and signup flow) without duplicating the text client-side.
 *
 * NOTE: The content below is placeholder text that should be reviewed by a
 * legal professional before production use. Do not treat this as legal advice.
 */

export const CURRENT_VERSIONS = {
  terms: "1.1",
  privacy: "1.1",
  cookies: "1.1",
  /** Cookie consent banner version — bump when the banner UX or choices change. */
  cookieConsent: "1.0",
} as const;

export type LegalDocType = "terms" | "privacy" | "cookies";

export interface LegalDocMeta {
  key: LegalDocType;
  label: string;
  shortLabel: string;
  version: string;
  /** Path-style slug for deep-linking (e.g. /legal/terms). */
  slug: string;
}

export const LEGAL_DOCS_META: LegalDocMeta[] = [
  { key: "terms", label: "Terms of Service", shortLabel: "Terms", version: CURRENT_VERSIONS.terms, slug: "terms" },
  { key: "privacy", label: "Privacy Policy", shortLabel: "Privacy", version: CURRENT_VERSIONS.privacy, slug: "privacy" },
  { key: "cookies", label: "Cookie Policy", shortLabel: "Cookies", version: CURRENT_VERSIONS.cookies, slug: "cookies" },
];

export function getLegalDocMeta(doc: string): LegalDocMeta | undefined {
  return LEGAL_DOCS_META.find((d) => d.key === doc || d.slug === doc);
}

/** Plain-text legal document content. Served via the public API. */
export const LEGAL_DOC_CONTENT: Record<LegalDocType, string> = {
  terms: `Terms of Service

Version ${CURRENT_VERSIONS.terms}

This is a placeholder Terms of Service document for DnD. It should be reviewed by a legal professional before production use.

1. Acceptance of Terms
By creating an account or accessing DnD, you agree to these terms. If you do not agree, you may not use the service.

2. Description of Service
DnD is a trading journaling, analytics and performance-management product. It helps you record trades, define strategies, capture evidence, review performance and analyze patterns. DnD is not a trading signal service, not investment advice, and does not guarantee any trading outcome or profit.

3. User Responsibilities
You are responsible for the accuracy of the data you enter and for maintaining the confidentiality of your account credentials. You agree not to misuse the service, attempt to access other users' data, or disrupt the service.

4. Acceptable Use
You agree to use DnD only for lawful purposes. You may not use the service to store illegal content, attempt to reverse-engineer or compromise the service, or use automated tools in a way that degrades performance for others.

5. Accounts and Security
You are responsible for all activity under your account. Notify us immediately if you suspect unauthorized access. We use hashed passwords and signed session cookies to protect authentication.

6. Data and Privacy
Your data is processed as described in our Privacy Policy. You may export or delete your data at any time from within the application.

7. Intellectual Property
DnD, its design, source code, and brand are owned by the operator. You retain ownership of the trading data and content you create.

8. Limitation of Liability
DnD is provided "as is" without warranties of any kind, express or implied. The operator is not liable for any trading losses, data loss, or indirect damages arising from use of the service.

9. Service Changes
We may modify, suspend, or discontinue features at any time. We will provide reasonable notice for material changes.

10. Term Changes
We may update these terms from time to time. When changes are material, we will seek renewed acceptance. Continued use after changes take effect constitutes acceptance of the updated terms.

11. Contact
For questions about these terms, contact the operator through the support channels available in the application.`,

  privacy: `Privacy Policy

Version ${CURRENT_VERSIONS.privacy}

This is a placeholder Privacy Policy for DnD. It should be reviewed by a legal professional before production use.

1. Data We Collect
We store the trades, strategies, reviews, media, settings and consent records you create. Authentication data (email, password hash) is stored to manage your account. Session data is managed via a signed cookie.

2. How We Use Data
To provide journaling, analytics, review and performance-management features. We do not sell your data. We do not use your trading data to train external models.

3. Data Security
We use bcrypt password hashing, signed session cookies (httpOnly, sameSite=lax), and per-user access controls. Privacy Mode encrypts sensitive fields client-side using AES-GCM with a passphrase only you hold.

4. Cookies and Local Storage
DnD uses essential cookies for authentication and local storage for preferences (theme, density). See our Cookie Policy for details. We do not use advertising or tracking cookies.

5. Data Retention
Your data is retained until you delete your account. You may export all data as JSON or CSV at any time from Settings.

6. Your Rights
You may access, export, correct, or delete your data at any time. Deleting your account permanently removes your data. Legal acceptance records are retained for compliance purposes.

7. Third-Party Services
DnD is self-contained. We do not integrate third-party analytics, advertising, or tracking services. No data is shared with external parties.

8. Children's Privacy
DnD is not intended for users under 18. We do not knowingly collect data from minors.

9. Changes
We may update this policy from time to time. Material changes will prompt renewed acknowledgement.

10. Contact
For privacy questions or data requests, contact the operator through the support channels available in the application.`,

  cookies: `Cookie Policy

Version ${CURRENT_VERSIONS.cookies}

This is a placeholder Cookie Policy for DnD. It should be reviewed by a legal professional before production use.

1. What DnD Uses
DnD uses cookies and similar technologies (local storage) for the following purposes:

Essential (always active):
- Session cookie ("dnd_session"): httpOnly, signed JWT used for authentication. Required to keep you signed in. Expires after 30 days.
- Sidebar state ("sidebar_state"): remembers whether your sidebar is collapsed or expanded. Expires after 7 days.

Preferences (stored in local storage, not cookies):
- Theme, density, text size, reduced motion — to remember your appearance choices.
- Onboarding progress — to avoid showing the walkthrough twice.
- Trade-form drafts and offline sync queue — to preserve unsaved work.

Non-essential (analytics, marketing, advertising):
- DnD does not currently use any analytics, advertising, or tracking cookies. If this changes, we will update this policy and seek your consent before enabling such technologies.

2. Your Choices
You can accept or reject non-essential cookies through the cookie consent banner on first visit, or change your preferences at any time in Settings → Legal → Cookie Settings.

Because DnD currently uses only essential cookies, rejecting non-essential cookies does not limit functionality.

3. Managing Cookies
You can clear cookies and local storage through your browser settings. Note that clearing the session cookie will sign you out. Clearing local storage will reset your theme and onboarding progress.

4. Consent Versioning
When this Cookie Policy changes materially, we will ask for your consent again. Your previous consent choice and timestamp are recorded for our records.

5. Changes
We may update this policy from time to time. The version and date above indicate the current version.`,
};
