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
- Cloud sign-in is remembered in localStorage for **up to 30 days from sign-in**,
  including after closing tabs or restarting the browser. Existing tab-only sessions
  migrate automatically on reload; the email-code pending step stays tab-only.
  Access tokens remain short-lived: the app refreshes before expiry when accessing
  the cloud, and retries a rejected (401) request only once after refresh. Token
  rotation is serialized across tabs with Web Locks where supported. Refresh does
  not restart the 30-day window. Shorter Supabase session policies or revocation can
  require an earlier sign-in; this feature does not change server Auth settings.
- Remembered access/refresh tokens are readable by same-origin scripts and anyone
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
3. Configure **Authentication → Email Templates → Magic Link** to display the
   one-time code, not just a confirmation URL. For example:
   ```html
   <h2>Your Maintenance Log sign-in code</h2>
   <p>{{ .Token }}</p>
   <p>If you did not request this code, ignore this email.</p>
   ```
   The frontend uses `/auth/v1/otp` with account creation allowed, then
   `/auth/v1/verify` with `type: email`. No redirect/callback URL is consumed.
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
8. Enable managed backups/retention and document privacy/account deletion policies.
   Deleting an Auth user cascades to the new garage, but not legacy ICU history or
   managed database backups. The UI does not yet offer account deletion or email change.

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
requests, remembered-session migration/expiration, automatic token refresh,
logout/refresh races, revision conflicts, ignored legacy browser-garage data, validated backup-file imports,
signed-out/configuration gates, and failed cloud drafts. Auth/REST requests are mocked; no production migration, SMTP setup,
live RLS verification, or deployment is implied by these tests.
