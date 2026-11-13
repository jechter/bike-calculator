# Independent maintenance garages

## User experience

- **Open my browser garage** needs no account. Add a bike, set its current mileage
  in kilometers, and log services/replacements. Expand a bike to edit its name or
  update mileage. Current mileage cannot be lower than any saved service reading.
- Browser data is device/origin-specific, not an authenticated account. Other users
  of the same browser can access it. Download garage backups regularly; clearing
  site data deletes it. Closing the garage does not delete it.
- **Sign in / create account with email** uses a Supabase Auth one-time email code.
  The first successful code creates the account. No password, Intervals.icu account,
  or user-owned Supabase project is needed. Cloud garages are keyed to Auth user IDs.
  The pending email/code-entry step is kept in sessionStorage for up to one hour,
  so a same-tab reload when returning from Mail restores the form without resending
  an email. The code itself is never saved. Cancel, resend/change email, or successful
  login clears the pending step. This retention does not extend the server's OTP
  expiration; request a new code if it expires. Email autofill and one-time-code
  hints are explicit, but Safari controls its own password-manager suggestions.
- Cloud and browser garages remain separate. **More → Import browser garage** copies
  missing bike/entry IDs into the cloud only after confirmation, keeps existing cloud
  IDs, and leaves the local copy untouched. Download a backup of each before merging.
- Cloud writes are atomic revision-checked snapshots (5 MB maximum). Concurrent
  edits on another device produce a conflict, not silent lost updates. Export the
  current state and reload before retrying. Failed writes leave drafts open and never
  fall back to local writes. Reload to refresh the cloud garage and session.
- Cloud sessions are stored in sessionStorage, not localStorage; closing the tab
  normally ends persistence. Tokens are readable by same-origin scripts: deploy only
  to a trusted origin. Reload refreshes the session; an expired/revoked session asks
  the user to sign in again. Sign-out clears local tokens even if revocation fails.
- **More → Connect Intervals.icu (optional)** reads bikes and total mileage. It keeps
  manual bikes and retired/missing upstream bikes, never changes maintenance readings,
  and namespaces IDs by provider/athlete. A second athlete cannot overwrite the first.
  Syncing replaces the upstream bike's current name/mileage, including manual edits.
  Reconnect to a different athlete only when intentionally adding that athlete's bikes.
- The Intervals.icu key is held only in memory until disconnect/navigation/reload.
  Sync runs immediately on connect and every five minutes while the page is visible,
  not busy, and no bike or maintenance form is open. Refresh is also available manually.
  There is no server scheduler or closed-page background sync. Strava's own mileage
  refresh must still be performed in Intervals.icu. All upstream calls are GET requests.
- Garage backups contain bikes and maintenance, not API keys or auth tokens. JSON
  file restoration is not yet implemented; preserve the downloaded files for recovery.

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
   Without both variables the page explicitly offers browser storage, not cloud login.
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

## Existing records and keys

No automatic identity linking occurs. An Intervals.icu athlete ID is not a Supabase
Auth user ID, and an email address does not prove ownership of an old athlete account.
Legacy records and keys are left untouched; keys are no longer automatically used.

1. Open a browser garage or sign into the intended new cloud account first.
2. Open optional Intervals.icu sync with the same athlete key. It offers an explicit
   import of old browser records, retaining the original localStorage copy. IDs are
   migrated consistently as `icu:<athleteId>:<oldId>` for both bikes and entries.
3. If the legacy storage endpoint remains configured, **Recover legacy cloud records**
   in the sync form verifies ownership through that service and offers import into
   the currently open garage. Only this explicit action sends the key to the legacy
   service. Temporary legacy sessions are logged out after reading. Both source
   cloud records and browser backups remain unchanged. Existing destination IDs win.
4. Missing/retired bikes get a placeholder and a total based on the highest imported
   service reading, not a guessed lifetime total. Edit its name/current mileage after
   recovery. Legacy imports never infer a replacement or alter service dates/readings.
5. Verify the imported history and export a complete garage backup before retiring
   the old function/tables. Use **Forget legacy saved key** in the sync form to remove
   the old unencrypted key without deleting records. Existing standalone exports
   and server backup procedures remain useful recovery paths.

Keeping the legacy recovery service does not make Intervals.icu the new auth
mechanism: it verifies access only to the legacy dataset being copied. Disable it
once users have migrated according to the operator's retention plan.

## Validation

`npm run build` and `NODE_OPTIONS=--no-experimental-webstorage npm test` cover
manual bikes, mileage validation, optional sync, namespace merging, email-code
requests, session refresh, revision conflicts, browser-to-cloud imports, and failed
cloud drafts. Auth/REST requests are mocked; no production migration, SMTP setup,
live RLS verification, or deployment is implied by these tests.
