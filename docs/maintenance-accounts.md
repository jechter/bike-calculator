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
- The sign-in banner opens directly to the email field. **Send sign-in code** uses
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
  verifying the email code and is not saved with the pending-email step; a reload
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

## Intervals.icu OAuth

- Public client **2006**, with **Require PKCE** enabled. Register this exact redirect:
  `https://rueckenwind.berlin/bikeworkshopcalc/maintenance-log/` (trailing slash included).
- Authorization: `https://intervals.icu/oauth/authorize`; token exchange:
  `https://intervals.icu/api/oauth/token`. Only `SETTINGS:READ` is requested for
  profile/gear, not activity access or write permission. No client secret is used.
- A random state and S256 verifier are stored in tab sessionStorage for up to ten
  minutes, bound to the Maintenance Log user ID and exact redirect URI. Successful
  callbacks require matching state, owner, origin/path, and verifier. Callback query
  credentials are scrubbed immediately. A documented state-less denial can only
  cancel; it cannot authorize anything. Exchanges are single-flight for StrictMode.
- Supabase email sign-in remains separate. The returning user must be signed in to
  the same garage account before the token exchange/import can run. An expired
  garage session can be reauthenticated; a different account cannot import the grant.
- After OAuth, the browser sends the token once over HTTPS to the authenticated
  `intervals-connection` Edge Function. It validates the token with Intervals.icu,
  stores it encrypted in Supabase Vault, and returns only whitelisted bike/profile
  metadata. It never returns a saved token to a browser. Credentials never enter
  garage JSON, localStorage, sessionStorage, or downloadable backups.
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

### Persistent-connection backend rollout (required)

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
