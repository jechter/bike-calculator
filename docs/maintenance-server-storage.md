> **Legacy documentation:** the current page uses independent garages and optional
> email sign-in. See [current setup and migration](maintenance-accounts.md).
> The integration described below is retained for recovery/reference only.

# Shared Supabase storage and browser-data migration

## What changes

There is **one Supabase project owned by the site operator**, not one per user.
When `VITE_MAINTENANCE_STORAGE_URL` is configured, the page verifies the user's
Intervals.icu API key through a Supabase Edge Function. The function gets the
athlete ID directly from Intervals.icu and creates an opaque seven-day session.
It never trusts a client-supplied athlete ID and does not persist the API key.

The browser keeps its existing saved Intervals.icu key, as requested. The storage
session token is only in memory; reloading reconnects using the saved key. The
key is sent over HTTPS to the operator's function for verification, in addition
to direct Intervals.icu mileage requests. This trust/privacy change is disclosed
on the connection screen. Only deploy to an origin you control and trust.

Maintenance records are stored in PostgreSQL, scoped to that verified athlete.
Other browsers/devices connecting to the same athlete see the same records.
The database tables have RLS enabled and no public policies. Anonymous and
Supabase-authenticated direct access is revoked. Every function query is scoped
to the session owner. Service-role credentials are available only in the function.
This does not use Supabase Auth or require a second user login. Later OAuth can
replace key verification while keeping the same Intervals.icu athlete identities.

Without the storage URL, the page stays in clearly labeled **browser-only mode**.
With it configured, cloud errors do **not** silently fall back to browser writes.
No live project has been provisioned or migration performed just by adding code.

## Operator setup

1. Create a Supabase project. Users need no Supabase accounts.
2. Apply `supabase/migrations/202611030003_intervals_storage.sql` once in the
   project's SQL editor. It creates only `icu_maintenance_*` tables and does not
   modify any existing browser data or the legacy Strava tables.
   Alternatively, use `supabase link --project-ref YOUR_PROJECT_REF` and
   `supabase db push`; this also applies earlier tracked migrations for the old,
   unused Strava scaffold. Do not run the same migration twice manually.
3. Set the Edge Function secret `MAINTENANCE_APP_ORIGIN` to the exact frontend
   origin, e.g. `https://rueckenwind.berlin` or `http://localhost:5173`. Include
   the port if any, but not the `/bikeworkshopcalc/` path. For workspace previews,
   use the browser's actual HTTPS preview origin, not its internal localhost URL.
   Hosted Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   Never expose the service-role key as a `VITE_*` variable.
4. Deploy the function with the Supabase CLI:
   ```sh
   supabase functions deploy maintenance-storage --no-verify-jwt
   ```
   `supabase/config.toml` declares this setting too. Gateway JWT verification is
   disabled because the handler validates its own opaque sessions; it does not
   mean that database access is public. Only `connect` is unauthenticated, and it
   verifies the user's credentials with Intervals.icu before issuing a session.
5. Add to an untracked `.env.local`, then restart Vite or rebuild the static app:
   ```dotenv
   VITE_MAINTENANCE_STORAGE_URL=https://YOUR_PROJECT.supabase.co/functions/v1/maintenance-storage
   ```
   The old `VITE_MAINTENANCE_API_URL` is not used by this integration.
6. Serve the updated page at its **existing frontend origin** so it can still
   read users' browser records. LocalStorage is origin-specific: moving to a
   different domain/port does not bring old records along. Don't move users to
   another origin or ask them to clear site data during migration.

The frontend remains a static deployment; deploy the function separately. No
production deployment is performed by the local implementation. The function
URL must use HTTPS except for localhost development.

## Safe migration for each user's existing browser

1. Before switching on server mode, use **More → Download records backup** in the
   existing browser. This exports records and athlete ID, **not the API key**.
   Keep the downloaded JSON somewhere safe. Server mode also offers a separate
   **More → Download browser backup** action for the original local copy.
2. Reconnect to the updated page. The main history now shows server records
   only; local records are not falsely displayed as already uploaded. The More
   menu shows the count of local IDs not yet on the server when applicable.
3. Choose **More → Import browser records**. Nothing uploads automatically.
4. Records keep their original IDs, bike IDs, component names, tasks, notes,
   dates, and odometer values. Imports run in batches of 50; old/retired bike
   records can be imported even if the current gear list no longer contains the
   bike. No mileage is inferred from current odometers.
5. Each batch uses `ON CONFLICT (athlete_id,id) DO NOTHING`. Retrying after an
   interruption cannot duplicate already imported records or overwrite existing
   server edits. If another device already has the same ID, its server version
   wins; the differing local version remains available in the browser backup.
6. After the upload, the client reloads **all pages** and checks that every
   source ID is represented on the server. Only then does it report completion,
   distinguishing newly inserted from existing records. Verification is of IDs,
   not a claim that existing server versions were overwritten to match the backup.
7. **The original browser records are never deleted or rewritten by import or
   later server edits.** The backup download remains in More, and the import
   action disappears when no local IDs are missing remotely. No persistent
   backup/status banner is printed in the main page.
8. Verify the records in another browser/device using the same existing
   Intervals.icu key. Do not generate a new key just to migrate; that may revoke
   the one in other browsers.

The local copy becomes a point-in-time backup, not a second synchronized source.
Deleting a server entry does not delete the retained browser copy. As a result,
a later manual import can restore a deleted entry with that ID; do not reimport
old backups if those deletions were intentional. This conservative behavior
avoids silently losing browser records. There is no automatic backup erasure.

If a source entry is invalid, the function rejects that batch and the client
reports an error. Other completed batches remain on the server, and local data
is untouched. Export the backup before correcting invalid data; retries are safe.

## Backups, failure handling, and production checks

- **More → Download records backup** exports the currently loaded records (server
  records in server mode, browser records in browser-only mode). It does not
  include credentials. A file-restore/import UI is not implemented yet; the safe
  migration path currently reads the original localStorage copy.
- A failed cloud write keeps the draft open. Draft IDs are stable across retries
  so an ambiguous create failure cannot silently produce a new duplicate ID on
  each retry. A server duplicate response asks the user to reload.
- Refresh reloads cloud records as well as mileage. Sessions expire after seven
  days; reloading reconnects with the existing saved key. Disconnect forgets the
  browser key and attempts server-session logout; it never deletes server records
  or local backups. If logout cannot reach the server, the token still expires.
- There is no destructive bulk-delete server button. Per-entry deletes are
  session-scoped. Import never uses an unscoped replace-all operation.
- Configure managed database backups/retention and user privacy/contact policies.
  The free tier's current limits, pauses, backup capabilities, and costs must be
  checked before relying on it for durable storage. Deleting live rows does not
  erase older managed backups.
- Before public launch, add gateway/platform rate limiting, particularly for
  `connect`, which calls Intervals.icu. CORS is not rate limiting or authentication.
  Do not log API keys, session tokens, or request bodies. The application itself
  does not persist keys on the server; review infrastructure logging settings too.
- Verify on a real project that two users cannot read/update/delete/import into
  each other's accounts, direct table access with an anonymous key is denied,
  import retry works, and a separate browser sees the saved history.
- The unit/integration-style tests use mocked HTTP/database behavior, and the
  Edge Function is separately type-checked. During the initial hosted setup,
  live checks also verified sign-in, session invalidation, idempotent import,
  account isolation, and cross-account update/delete protection using temporary
  synthetic records. Those fixtures were removed; no browser history was
  imported. Docker is unavailable in this workspace, so a local full Supabase
  stack has not been exercised here.

Do not simply unset the server URL as a way to handle an outage: browser backups
may now be older than server records. If rolling back intentionally, export the
latest cloud records first and keep both versions; there is no automatic merge
back into localStorage.

## Checks

```sh
npm run build
NODE_OPTIONS=--no-experimental-webstorage npm test
npx deno check --node-modules-dir=none --no-lock supabase/functions/maintenance-storage/index.ts
```
