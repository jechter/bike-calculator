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
- The Intervals.icu key is held only in memory until disconnect/navigation/reload.
  Sync runs immediately on connect and every five minutes while the page is visible,
  not busy, and no bike or maintenance form is open. Refresh is also available manually.
  There is no server scheduler or closed-page background sync. Strava's own mileage
  refresh must still be performed in Intervals.icu. All upstream calls are GET requests.
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
