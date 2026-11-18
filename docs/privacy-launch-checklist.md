# Privacy notice launch checklist (Germany)

The application links to `public/privacy/index.html`, copied by Vite to
`dist/privacy/index.html`. It is standalone HTML, works without JavaScript, and
is not a calculator route. Links use the explicit `privacy/index.html` URL so
Vite does not fall back to the calculator SPA for the directory URL in development.
At the operator’s request, its effective date is November 16, 2026 and public
confirmation placeholders and the draft banner have been removed. It remains
noindex. This editorial cleanup does not verify the unresolved checks below
or establish legal readiness to launch public accounts.

Before publication:

- Resolve the remaining provider, retention, transfer, and operational checks
  below and ensure the public notice accurately reflects the verified setup.
  No provider settings or contracts were changed by removing placeholders.
  Use a language readily understood by the intended audience; provide a German
  version if appropriate.
- Controller and privacy contact supplied by the operator are included in the
  notice. Email and postal details are assembled from shifted character codes
  in JavaScript, like the component-proposal mailbox. This deters only simple
  source scanners, not crawlers that run JavaScript. The text notice remains
  readable without JavaScript, but displaying contact details requires it.
  WordPress compliance is handled separately by the operator.
- In Supabase Dashboard, open the configured project, then Project Settings →
  General / Infrastructure (labels may change), and locate Region. Database
  connection details can corroborate it. The locally linked pooler hostname
  includes `eu-west-1`. The operator also confirmed the dashboard reports
  “Primary Database: West EU - eu-west-1” (Ireland). This does not establish
  every service's location. Confirm that the production `VITE_SUPABASE_URL`
  points to the same project.
- The operator confirmed the Supabase DPA applies:
  https://supabase.com/legal/customer-resources/data-processing-addendum.
  The notice now links it and states that it covers the service. Still review
  contracting entity, subprocessors, support access, Auth/log/backup locations,
  and international-transfer safeguards.
- The operator confirmed STRATO's AVV applies to SMTP:
  https://www.strato.de/agb/avv/. Reviewed the attached German and English copy,
  version 3.5, March 18, 2024. It identifies STRATO GmbH as processor. German
  clause 4.3 provides EU/EEA processing unless third-country transfer is necessary
  for the service, subject to Articles 44 onward GDPR. Clause 5.7 provides
  deletion/return at the end of processing, subject to legal retention; this is
  not a per-email or SMTP-log retention deadline. Clause 8 covers security and
  regular effectiveness checks; TOM descriptions are linked separately at
  https://www.strato.de/agb/tom/ and were not reviewed here. Clause 10 allows
  subprocessors, with notification/objection arrangements. Its appendix includes
  mail-specific services (e.g., spam filtering, OX mailboxes) and other services
  such as optional mail archiving; some third-country entries specify SCCs.
  Do not assume optional archiving, all listed subprocessors, or all listed
  countries apply to our SMTP configuration. Still verify the actual SMTP log,
  queue, and backup retention, applicable subprocessors/locations, and any
  transfer safeguards for the selected product. No fixed retention interval
  or guaranteed recovery capability is established by this AVV.
- Hosting is confirmed to be on rueckenwind.berlin. Reviewed the operator's
  supplied section 2 (Hosting) of its privacy notice: IONOS SE, Elgendorfer
  Str. 57, 56410 Montabaur, Germany; server logfiles include IP addresses;
  hosting relies on Article 6(1)(f) GDPR for reliable delivery. The notice includes
  those facts and links https://www.ionos.de/terms-gtc/terms-privacy.
  Also reviewed the attached IONOS “Privacy Notice for Websitevisitors and
  Customers.” It confirms IONOS's identity and distinguishes its controller
  processing from processor services governed by a separate processing agreement.
  Section 3 lists technical data including IP, browser type/version, OS, and
  device information. Section 11 gives general examples: logs/temporary data often
  a few days to a maximum of 60–90 days, security/fraud data usually up to six
  months with possible extensions. These are not confirmed retention settings
  for the rueckenwind.berlin hosting contract; do not copy them as a definite
  deletion promise. Section 9 allows non-EEA transfers with safeguards but does
  not identify this hosting service's actual locations or mechanisms.
  Still confirm IONOS AVV applicability, hosting-specific log fields/retention,
  recipients, processing/access locations, and transfer arrangements. Do not
  import IONOS's own-site advertising, AI training, or customer marketing into
  our calculator's description without evidence that those apply to hosted data.
  No scripts from the attachment were embedded. The main site's older TTDSG
  terminology was not copied; our notice uses the current TDDDG name.
- Direct retrieval of the Supabase DPA, STRATO AVV, and full hosting notice
  failed from this workspace (proxy tunnel returned 502). The attached STRATO
  AVV and supplied hosting excerpt have since been reviewed; the Supabase DPA
  and full hosting notice have not. Contract applicability is recorded from the
  operator's confirmation. The links do not, by themselves, settle all transfers
  or provider retention.
- Self-service deletion is implemented in More → Delete account. Apply
  `supabase/migrations/202611160001_delete_maintenance_account.sql` before
  deploying the frontend; test with two real users and run the rollback-only
  SQL regression in `supabase/tests/account_deletion.sql` on a disposable test
  project. No live migration or SQL regression was executed in this workspace.
  Maintain contact-based handling for legacy records and other rights requests.
  The operator reports no fixed account expiration and no operator-managed logs
  or backups. This does not establish provider retention. Define a purpose-based
  dormant-account review, deletion handling, provider logs/backups, and
  legacy-record retention. Deleting Auth users cascades to the current garage
  but not necessarily legacy tables/backups. No automatic account-deletion
  schedule or backup process has been implemented by these changes.
- Reviewed the operator's attached HTML copy of the Intervals.icu privacy policy,
  effective November 10, 2026, at https://www.intervals.icu/privacy-policy/.
  Identifies Intervals.icu Ltd., 71-75 Shelton Street, Covent Garden, London
  WC2H 9JQ; describes itself as controller. It states Germany/Finland processing,
  cloud storage in EU regions (Google, Backblaze, Wasabi, Scaleway), Sentry in
  Germany, and additional providers for its own analytics/notifications/payments.
  It provides Settings → Delete Account and states removal of deleted data from
  backups within 30 days, with legal-retention exceptions. Its representative
  portal is https://app.prighter.com/portal/intervals-icu. The notice attributes
  these statements to that policy; they are not verified infrastructure facts
  or retention promises about our Supabase data.
  Still assess integration/API terms and transfer safeguards, including UK
  controller access and relevant onward access. EU storage alone does not settle
  those issues. Do not assume every provider in its policy receives data through
  our API-only integration. No attached scripts or tracking were copied into the app.
- Document §25 TDDDG assessments for browser storage. Speed-unit persistence
  now writes only on explicit selection, not on mount. Sign-in is tab-only by
  default; an unchecked “Remember me” checkbox explicitly requests persistence
  for up to 180 days. Legacy automatic persistence becomes tab-only. Document
  why each storage operation is necessary for the expressly requested feature;
  the checkbox does not authorize unrelated tracking. A passive banner does
  not solve nonessential storage.
- Inspect the real deployed site's cookies, storage and network requests in a
  clean browser, both signed out and signed in, plus any WordPress parent/embed.
  Source inspection found no app cookie writes or analytics/ad scripts; it cannot
  establish what production hosting, WordPress, plugins or proxies add.
- Test real-project authorization with two users, rate limits, admin access,
  logging redaction, backup restoration, and deletion. Automated tests mock Auth.

No consent popup was added. Speed-unit storage persists only explicit
selections; persistent sign-in now requires an explicit remember-me selection.
No deployment was performed.
