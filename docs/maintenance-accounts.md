# Cloud-only maintenance garages

## User experience

- Sign-in is required before viewing or editing your bikes and maintenance. The
  signed-out page shows a greyed, lightly blurred illustration of a bike list and
  service history, with a sign-in banner above it. Its sample records are static,
  non-interactive, hidden from assistive technology, and never loaded into account
  state or storage. There is no editable demo or browser-only garage. New records
  and edits are saved only to Supabase.
  Add a bike, set its current mileage in kilometers, and log services/replacements.
  Use the pencil after a bike's mileage to edit its name or update mileage, without
  expanding its components. Source-specific guidance (manual mileage or imported
  Intervals.icu sync behavior) appears only in this editor, not in the bike list.
  Current mileage cannot be lower than any saved service
  reading. The editor's **Delete bike** action requires confirmation and atomically
  removes that bike and all its maintenance entries from the cloud. Other bikes
  and their history are unchanged; a failed cloud write leaves the editor open.
  Deleting a synced bike does not delete upstream gear, so a later Intervals.icu
  sync can add that bike again (without restoring its deleted maintenance history).
- The sign-in banner offers **Continue with Intervals.icu** alongside email entry. **Send sign-in code** uses
  a Supabase Auth one-time email code.
  The first successful code creates a free account. No password, Intervals.icu account,
  or user-owned Supabase project is needed. Cloud garages are keyed to Auth user IDs.
  The pending email/code-entry step is kept in sessionStorage for up to one hour,
  so a same-tab reload when returning from Mail restores the form without resending
  an email. The code itself is never saved. Cancel, resend/change email, or successful
  login clears the pending step. This retention does not extend the server's OTP
  expiration; request a new code if it expires. Email autofill and one-time-code
  hints are explicit, but Safari controls its own password-manager suggestions.
- The former independent browser-garage import option has been removed. Old
  records are left untouched, but the app no longer reads or imports that garage.
  Browser storage is still used for remembered sign-in, not for maintenance data.
- Cloud writes are atomic revision-checked snapshots (5 MB maximum). Concurrent
  edits on another device produce a conflict, not silent lost updates. Export the
  current state and reload before retrying. Failed writes leave drafts open and never
  fall back to local writes. Reload to refresh the cloud garage and session.
- Sign-in is **tab-session-only by default**, using sessionStorage. The unchecked
  **Remember me for up to 180 days on this browser** checkbox explicitly enables
  localStorage persistence across tabs/browser restarts. The choice is used when
  verifying the email code (or completing OAuth) and is not saved with the pending-email step; a reload
  before verification resets it to unchecked. Browser session restoration may
  restore sessionStorage too, so sign out rather than relying on closing a tab
  on shared devices. Both modes have an absolute maximum 180-day acceptance window.
  Legacy automatically remembered logins (without an explicit `remember_me: true`)
  become tab-only when read; existing tab-only logins are never promoted.
  Access tokens remain short-lived: the app refreshes before expiry when accessing
  the cloud, and retries a rejected (401) request only once after refresh. Token
  rotation is serialized across tabs with Web Locks where supported. Refresh keeps
  the original storage mode and does not restart the 180-day window. Shorter Supabase
  policies or revocation can require earlier sign-in; server Auth settings are unchanged.
- Saved access/refresh tokens in either storage mode are readable by same-origin scripts and anyone
  using this browser profile. Deploy only to a trusted origin and sign out on shared
  devices. Sign-out removes both persistent and old tab-only credentials immediately,
  even offline, and attempts to revoke this session (not other devices' sessions).
  Other open tabs hide the garage on sign-out/account changes. Clearing site data,
  private browsing, or Safari storage eviction can also require signing in again.
  Temporary network errors keep the saved session for retry; revoked/invalid refresh
  credentials are removed. A concurrent refresh cannot undo a sign-out.
- **More → Connect Intervals.icu (sync bikes and mileage)** reads bikes and total mileage. It keeps
  manual bikes and retired/missing upstream bikes, never changes maintenance readings,
  and namespaces IDs by provider/athlete. A second athlete cannot overwrite the first.
  Syncing replaces the upstream bike's current name/mileage, including manual edits.
  Reconnect to a different athlete only when intentionally adding that athlete's bikes.
- Intervals.icu uses public-client OAuth with S256 PKCE, not personal API keys.
  The connection is encrypted in Supabase Vault, scoped to the cloud account, and
  restored on page load/sign-in, including later days and other devices.
  Sync runs immediately on connect/reload and every five minutes while the page is visible,
  not busy, and no bike or maintenance form is open. Refresh is also available manually.
  There is no server scheduler or closed-page background sync. Strava's own mileage
  refresh must still be performed in Intervals.icu. Bike/mileage requests are GETs;
  OAuth exchanges use POST and explicit grant revocation uses DELETE.
- **More → Download garage backup** exports bikes and maintenance, not credentials.
  **More → Import garage backup** accepts a version 1 JSON garage backup (up to 20 MB
  on disk). It validates fields, calendar dates, mileage, unique IDs, and bike
  references, then previews added/existing/conflicting counts before confirmation.
  Confirming merges missing bike/entry IDs into the signed-in cloud account in one
  revision-checked write. Existing IDs always keep their cloud values, even when a
  backup differs. Garage metadata is not replaced, and importing again is idempotent.
  The merged garage must fit the database's 5 MB limit. Invalid files never write;
  failed/conflicted cloud writes keep the review open and never fall back locally.
  A backup can restore deleted bikes/entries; review before importing an old file.
  This is an additive restore, not a replace-all or overwrite-existing operation.
  Legacy browser-record exports (`bike-maintenance-backup`) are a different format
  and are not accepted by this file importer.

## Unified Intervals.icu connection

- There is one user-visible connection, enabling **sign-in and automatic mileage
  sync together**. Signed-out **Continue with Intervals.icu** and signed-in
  **More → Connect Intervals.icu** use the same server-held OAuth PKCE handshake.
  More shows only Connect or Disconnect, never independent login/sync toggles.
  There is no partial-setup migration or special completion UI.
- Email-code access remains available, opening the same UUID/garage. Disconnect
  asks the user to confirm they can receive email codes, removes the login mapping
  and Vault credential together, and attempts provider revocation. Bikes, history,
  email access, and already-issued Supabase sessions remain. Sign-out keeps the
  connection; account deletion cascades both mapping and encrypted credential.
- `intervals-login` owns the S256 verifier, exchanges the code for public client
  2006, and fetches `/api/v1/athlete/0`. Browser-supplied tokens, email, athlete IDs,
  and target UUIDs are never login/link evidence. The old browser-token `connect`
  action and separate `unlink` action are rejected by the handlers.
- A private browser proof lives in tab storage. The backend stores hashed state
  and proof, a Vault-encrypted verifier, exact redirect, purpose, authenticated
  owner for explicit connection, immutable remember-me choice, and salted IP hash.
  Returns require matching proof/state/context; transactions expire after ten
  minutes, are consumed once, and delete the verifier. Later starts prune expired
  requests. Pending-request limits reduce abuse. Callbacks are scrubbed and
  single-flight; session acceptance rejects account changes and remember mismatch.
- The protected athlete-to-UUID mapping takes precedence over later provider
  email changes, including unverified changes. For an unmapped athlete only,
  `icu_email_verified === true` may match an already-confirmed Supabase email.
  Matching is case-insensitive without dot/plus normalization; ambiguous,
  unconfirmed, or conflicting identities fail closed. Fresh verified emails may
  create an email-capable confirmed Auth user, respecting disabled signups.
  Explicit authenticated connection proves both identities without requiring
  matching provider/account emails. Banned accounts cannot connect.
- `connect_maintenance_intervals_account` resolves the identity and stores the
  credential atomically. Either both succeed or both roll back. The account and
  credential locks also protect `disconnect_maintenance_intervals_account`, whose
  connection-version check prevents a stale disconnect from deleting a newer
  credential or identity. A failed provider refresh retains the connection; a
  rejected credential is removed, while the stable identity is retained for safe
  fresh OAuth reconnection rather than rerouting by a changed email.
- Login sessions remain ordinary Supabase sessions: Admin `generateLink` creates a
  one-use magic-link token without sending email, then an isolated Auth client
  verifies it and checks the subject UUID. Never sign in on the shared service-role
  client. RLS still uses `auth.uid()`. Provider credentials never enter browser
  storage, session responses, garage JSON, or backups.
- After OAuth, or on later email sign-in/reload, the browser fetches mileage from
  `intervals-connection`. A transient gear/API failure does not discard a successful
  connection or prevent email access. Manual bikes/history are preserved. There
  is no background scheduler when the page is closed.

### Unified-connection rollout (not yet deployed)

1. Validate `supabase/tests/intervals_account.sql` in a disposable Supabase database.
   Docker is unavailable here; this SQL regression is not part of the mocked tests.
2. Apply only `202611260002_unified_intervals_connection.sql` transactionally to the
   current project. Earlier login/Vault migrations are already deployed; do not
   replay historical migrations or reset data. The new file adds two private RPCs
   without rewriting any garage or automatically connecting any account.
3. Redeploy **both** `intervals-login` and `intervals-connection` with
   `--no-verify-jwt --remote --yes`. Existing origin, client ID, and exact
   production/preview redirect settings remain unchanged.
4. Publish the frontend only after the backend. Verify OAuth sign-in and signed-in
   connection both enable sync, disconnect removes both capabilities, email opens
   the same garage, and sign-out keeps the connection. No provider token should be
   exposed to the browser. Use isolated test identities; preserve real garage data.

### Historical optional-login rollout verification (before unification)

The optional-login implementation (`baea55e`, branch `feature/maintenance-log`)
was published with explicit operator authorization. Only the additive
`202611260001_intervals_login.sql` file was applied, transactionally; both Edge
Functions were deployed and production/preview redirects configured before the
frontend was uploaded. Existing garage count and the full garage-content/revision
fingerprint were unchanged afterward.

- All 753 automated tests passed. The real frontend and handler also passed a
  mocked-provider browser flow covering automatic matching, remembered login,
  email fallback, changed/unverified email stability, and explicit unlink/relink.
- Live checks used isolated temporary Auth users and synthetic credentials only.
  They verified actual SQL resolution, verified/unconfirmed-email rules, stable
  mappings, conflicts, concurrent linking, browser-role denial, cross-account RLS,
  encrypted one-use transactions, callback-owner guards, independent mileage/login
  state, and account-deletion/Vault cleanup. All temporary users and their records
  were removed. Native Auth Admin token generation and OTP verification opened the
  same temporary garage without sending an email or rewriting its contents.
- All 16 deployed pages/assets, including the sitemap and privacy page, matched
  the local build byte-for-byte. A fresh browser exercised the deployed mobile UI,
  actual backend start, and declined callback without contacting a provider account.
- Docker remained unavailable: the standalone disposable-database SQL regression
  script was not run. Live isolated checks are not a claim that it was executed.
  Final successful OAuth consent/code exchange with a real Intervals.icu account
  remains an operator/user acceptance check; no real provider grant was used here.
- Deployment warnings were the existing large JavaScript bundle and the host's
  lack of post-quantum SSH key exchange. The script's image-reference warnings are
  due to its JS/CSS-only reference matcher; both image files were verified directly.

## Intervals.icu OAuth for mileage

- Public client **2006**, with **Require PKCE** enabled. Register this exact redirect:
  `https://rueckenwind.berlin/bikeworkshopcalc/maintenance-log/` (trailing slash included).
- Authorization: `https://intervals.icu/oauth/authorize`; token exchange:
  `https://intervals.icu/api/oauth/token`. Only `SETTINGS:READ` is requested for
  profile/gear, not activity access or write permission. No client secret is used.
- The backend holds the S256 verifier and encrypted provider credential. The
  browser stores only the short-lived private proof/state/context described above;
  it neither exchanges provider codes nor receives provider access tokens.
- Both Connect and provider sign-in establish the combined connection. Email
  sign-in restores any saved connection without another provider approval.
- Subsequent status/sync/disconnect calls authenticate with the Maintenance Log
  account's Supabase access token. The Edge Function verifies it with Auth `getUser`,
  derives the owner server-side, and ignores caller-provided owner/athlete IDs.
  Browser roles cannot read the connection table or call credential RPCs. All reads
  from Intervals.icu now run on the backend; no maintenance records are sent there.
- Every page load/sign-in checks the saved connection and fetches current mileage.
  Five-minute refresh continues only while connected, visible, and idle; there is
  no closed-page scheduler. Manual bikes, existing entries, and missing upstream
  bikes are preserved. A temporary provider/network failure retains the grant;
  a rejected/revoked grant is erased and asks for reconnection (HTTP 409, not a
  Supabase-session 401). There is no browser-only credential fallback.
- Explicit **Disconnect Intervals.icu** revokes the grant using
  `DELETE https://intervals.icu/api/v1/disconnect-app`, then erases the encrypted
  secret even if upstream revocation is unavailable. That case asks the user to
  revoke access manually in Intervals.icu Settings → Apps. Version checks prevent
  an old in-flight request from erasing a newer connection. Bikes/history remain.
- Signing out or leaving the page keeps the server-side connection for next time.
  Account deletion attempts disconnect first; the Auth-user cascade also deletes
  the connection and its Vault secret even when the function is unavailable.
  A failed provider revoke is reported, not treated as deletion of the Intervals.icu
  account. Provider logs/backups remain subject to their own retention policies.
- Optional public build settings: `VITE_INTERVALS_CLIENT_ID` and
  `VITE_INTERVALS_REDIRECT_URI`. Production defaults are the values above. For
  preview/local testing, first register the exact preview/local redirect in
  Intervals.icu, then set the redirect variable and restart Vite. Starting OAuth
  from an unregistered origin/path is blocked rather than sending the user to a
  different origin that cannot read the tab's PKCE state. Never add a client secret
  to a `VITE_` variable.
- Provider documentation: [Intervals.icu OAuth support](https://forum.intervals.icu/t/intervals-icu-oauth-support/2759).

### Historical persistent-connection backend rollout

Before publishing this frontend:

1. In a project with accurate CLI migration tracking, review
   `supabase db push --remote --dry-run` before applying pending migrations.
   **The existing BikeMaintenanceDatabase project was provisioned outside CLI
   migration history.** A blind push would replay existing tables and install
   retired scaffolds that were never deployed. For this project, apply only
   `202611240001_persistent_intervals_oauth.sql` through the SQL editor or Management
   API in one transaction; do not reset the database, replay historical migrations,
   or mark absent schemas as applied. This migration enables managed Supabase Vault
   and creates only the new connection table/RPCs/cleanup trigger, without rewriting
   garage records or legacy data. The initial rollout applied this file directly.
2. Deploy `supabase functions deploy intervals-connection --no-verify-jwt --remote --yes`
   (the explicit remote target/confirmation flags apply to the installed v3 CLI).
   The handler validates bearer identities itself with Supabase Auth, supporting
   the project's publishable API key. `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are platform-provided server-only settings; never
   copy the service-role key into frontend variables or browser storage.
3. Set `MAINTENANCE_APP_ORIGINS` to a comma-separated list of permitted extra
   browser origins, including the current preview origin for testing. Production
   `https://rueckenwind.berlin` is always allowed. The existing single
   `MAINTENANCE_APP_ORIGIN` is also accepted when the plural setting is absent.
   Origins contain no paths; the OAuth redirect registration still needs the
   complete exact Maintenance Log URL. CORS is not the authentication boundary.
4. Check the SQL regression script `supabase/tests/intervals_connection.sql` in a
   disposable Supabase database, not production. It rolls back fixtures and checks
   Vault encryption, denied browser access, replacement/version guards, and
   per-user deletion cleanup. Handler tests use a stateful DB double, not Vault.
   The initial rollout also verified the live endpoint with isolated temporary
   Auth identities and synthetic credentials: encryption/roundtrip, cross-user
   isolation, denied browser token/table access, invalid-grant handling, disconnect,
   and Auth-user/Vault cleanup. Those identities were deleted afterward and the
   existing garage-data fingerprint was unchanged. No real OAuth credential was
   inspected or used for this verification.
5. On the preview, reconnect Intervals.icu once to save the previously memory-only
   grant, then reload and verify mileage refresh without new authorization. Check
   another account cannot see/use it, and disconnect erases it without deleting
   bikes. Existing users need this one-time reconnect after rollout.

## Operator setup (not performed automatically)

1. Use the operator's shared Supabase project and apply
   `supabase/migrations/202611120001_independent_maintenance.sql` using the SQL editor,
   or apply pending migrations with `supabase db push`. Do not reapply an already
   applied migration. This creates `maintenance_user_garages`; it does not drop or
   rewrite legacy tables. This flow requires no Edge Function deployment.
2. Enable the **Email** Auth provider and email signups in Supabase.
3. Configure **both** **Authentication → Email Templates → Confirm signup** and
   **Magic Link** to use the subject **Your sign-in code** and display the one-time
   code, not a confirmation URL. Supabase uses **Confirm signup** for a new email
   address and **Magic Link** for an existing account. Configuring only Magic Link
   makes new users receive a separate confirmation-link email first. Use the same
   code-only content for both templates, for example:
   ```html
   <h2>Your Maintenance Log sign-in code</h2>
   <p>{{ .Token }}</p>
   <p>If you did not request this code, ignore this email.</p>
   ```
   Keep **Confirm email** enabled: entering the emailed code verifies ownership
   and signs the user in, including on their first signup. Do not enable automatic
   email confirmation to bypass the confirmation-link email.
   The frontend uses `/auth/v1/otp` with account creation allowed, then
   `/auth/v1/verify` with `type: email`. No redirect/callback URL is consumed.
   Verify the first-signup path with a new email address as well as the existing
   account path; both should receive a code immediately without a separate link.
4. Configure a production SMTP provider, sender identity, delivery monitoring,
   OTP expiration, and Auth rate limits. Supabase's default email service is limited
   and may restrict recipients; it is not a production mail delivery solution.
5. Set only these **public** frontend variables and rebuild/restart Vite:
   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   ```
   Never put a service-role key in the frontend. HTTPS is required except localhost.
   Without both variables the page shows a configuration notice and cannot be used.
   There is no local-storage fallback.
   `VITE_MAINTENANCE_STORAGE_URL` alone no longer enables current account sign-in.
6. Deploy all of `dist/` at the existing calculator origin/path; do not overwrite
   WordPress. Preserve the origin so old localStorage remains accessible.
7. Verify email delivery, code rejection/expiry, new account creation, existing
   account login, logout, reload, and cross-device updates on a real project.
   Use two real Auth users to verify read/update/insert isolation, and confirm
   anonymous REST requests cannot access `maintenance_user_garages`. RLS enforces
   `auth.uid() = user_id`; browser-provided IDs alone do not authorize access.
8. Apply `supabase/migrations/202611160001_delete_maintenance_account.sql`
   before shipping the self-service **More → Delete account** menu action.
   This narrowly scoped SECURITY DEFINER RPC accepts no user ID: it deletes only
   `auth.uid()` from Auth. Anonymous/PUBLIC execution is revoked; authenticated
   users may call it. The current garage and Auth-owned sessions/identities cascade
   in the same transaction. No service-role credential is sent to the browser.
   Verify in staging with two users and run
   `supabase/tests/account_deletion.sql` as an administrator in a disposable test
   project (it rolls its fixtures back). Anonymous deletion must be rejected and
   deleting one user must leave the other untouched. This migration has not been
   applied automatically. Without it, the UI reports an error, not fake success.
9. Configure appropriate recovery/backup measures and document retention and
   deletion policies. Self-service deletion does not erase independent legacy ICU
   history, provider logs/backups, downloaded files, or upstream Intervals.icu data.
   Handle remaining privacy requests through the operator contact. Already issued
   access JWTs can remain valid until expiry, but the deleted user has no garage
   and cannot recreate one because of its Auth foreign key. Other devices must
   reauthenticate; the current browser's remembered credentials are removed and
   same-origin tabs hide the garage on the storage change. The UI does not offer
   email change.

## Retired legacy storage

The Intervals.icu connection only reads upstream bike names and current mileage.
It does not import old browser maintenance records, recover legacy cloud records,
or manage old saved API keys. Maintenance history remains in the signed-in cloud
account, and JSON garage backups can be imported separately from the More menu.

Legacy browser data, saved keys, and server tables are left untouched; removing
these controls does not erase them. Old server scaffolds and legacy documentation
remain for operator reference, but the current page no longer uses the legacy
storage endpoint or sends API keys to it. Operators can retire that service under
their retention policy without changing current Supabase Auth garage storage.

## Validation

`npm run build` and `NODE_OPTIONS=--no-experimental-webstorage npm test` cover
manual bikes, mileage validation, optional sync, namespace merging, email-code
requests, explicit remember-me opt-in, default tab-only storage, legacy-session downgrade/expiration, automatic token refresh,
logout/refresh races, revision conflicts, ignored legacy browser-garage data, validated backup-file imports,
signed-out/configuration gates, and failed cloud drafts. Auth/REST requests are mocked; no production migration, SMTP setup,
live RLS verification, or deployment is implied by these tests.
