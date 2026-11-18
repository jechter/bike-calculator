> **Legacy documentation:** the current page uses cloud-only garages with required
> email sign-in. See [current setup and migration](maintenance-accounts.md).
> The integration described below is retained for recovery/reference only.

# Historical scaffold: Strava + Supabase

> The current page uses the [Intervals.icu API-key prototype](maintenance-prototype.md).
> This document describes the earlier backend scaffold, which is no longer
> connected to the page. Do not configure it to enable the current prototype.

The page lives at `/maintenance-log/` under the existing installation directory.
Without backend configuration it offers a clearly labeled, in-memory demo.
Nothing is uploaded to Strava, and no activity-read/write permission is requested.

## Architecture

Strava is the **only** identity provider. Supabase Auth does not natively support
Strava, so this implementation uses custom opaque sessions in an Edge Function,
not `auth.users` or a second Supabase login. Athlete IDs are unique account keys;
we do not trust browser-supplied athlete IDs or email addresses.

- `begin`: browser generates a random verifier; the function stores its SHA-256
  challenge with a random state and a ten-minute expiration.
- Strava redirects to the maintenance page. The browser exchanges the code and
  state with its verifier. The function atomically consumes the matching,
  unexpired handshake before exchanging the code with Strava.
- The function returns a random seven-day session; only its hash is stored in
  PostgreSQL. The browser keeps the session in `sessionStorage` (closing the tab
  ends the browser session). OAuth codes are removed from the URL immediately.
- All database operations pass through this function. RLS is enabled and all
  direct access by `anon` / `authenticated` is revoked. Each authenticated query
  is explicitly scoped to the session's account; writes ignore client account IDs.
- Strava tokens are encrypted with AES-256-GCM before database storage. Only
  server-side secrets can decrypt them. Refresh tokens never reach the browser.
- Mileage is read from the athlete's bikes and detailed gear endpoint, in meters.
  Refresh is explicit, with a one-minute cooldown per account. Removed/retired
  bikes are retained at their last known mileage so their history is not lost.
- Jobs record the mileage **at service time**, independently of later Strava
  mileage changes. Backdated mileage is manual; this app cannot reconstruct it.
  The UI flags records that exceed a later, reduced odometer instead of showing
  negative kilometers. Distances are explicitly in kilometers in this first version.
- Each job has a component name and a work type (`replacement` or `service`).
  Component rows show distance since the latest event of **each type separately**;
  a replacement does not silently create a service record. Only components with
  entries appear in the overview. Missing replacements show “Not logged,” not
  zero; the service statistic is hidden until a service exists for that component.
  Clicking a component expands its full chronological log. Each entry has a
  Repeat action that opens an editable draft, preserving its component, work type,
  task, and notes but using today’s date and the bike’s exact last-synced mileage.
  Replacements have no Task field; their title is generated from the component.
  Services still require a task. Edit opens the existing record with its original
  date and mileage and updates it in place after saving.
  The original entry is unchanged; canceling the draft writes nothing.
  Common components remain suggested in the form, and custom names are supported.
  Names are grouped case-insensitively. Backdated entries do not override more
  recent events; for entries on the same day, the most recently created wins.

## 1. Create the services

1. Create a Supabase project. Keep its database password and service-role key
   private. Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Create a [Strava API application](https://www.strava.com/settings/api).
   Set its Authorization Callback Domain to the site's hostname (no scheme/path),
   e.g. `rueckenwind.berlin`. Use a separate app/project for local development if
   necessary. Strava restricts how many athletes may authorize a new app; check
   its current developer program, review requirements, and rate limits before
   offering this publicly.
3. Review Strava's current API agreement, privacy/branding requirements, and
   provide an operator privacy policy/contact before inviting real users. This
   implementation is an initial integration, not a claim of Strava approval.

## 2. Apply the database migration

From the repository root, after logging in to the CLI:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, run both SQL files in `supabase/migrations/` in filename order
in the project's SQL editor **once**. Do not add public policies to these tables. Accounts
appear in the `maintenance_accounts` table, not Supabase's Auth user list.

### Upgrading an existing installation

Apply `202611030002_component_logs.sql` (or run `supabase db push`) **before**
deploying the updated function and frontend. It adds component and work-type
columns without deleting old records. Existing jobs are preserved as services
under **Unassigned**; task text is not used to guess components or replacements.
Use Edit on an unassigned job to set its component and work type without
recreating the record. Redeploy the function together with frontend changes so
the update action and task-free replacement validation are available.

## 3. Configure and deploy the Edge Function

Set these secrets using the Supabase dashboard's Edge Function secrets interface
(or CLI secrets loaded from an **untracked** file). Never use a `VITE_` prefix:

| Secret | Value |
|---|---|
| `STRAVA_CLIENT_ID` | Strava application's client ID |
| `STRAVA_CLIENT_SECRET` | Strava application's client secret |
| `MAINTENANCE_APP_URL` | Exact standalone page URL, e.g. `https://rueckenwind.berlin/bikeworkshopcalc/maintenance-log/` |
| `MAINTENANCE_TOKEN_KEY` | Random base64-encoded 32-byte AES key; generate with `openssl rand -base64 32` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically by hosted
Supabase Edge Functions. Back up the encryption key securely. Changing it without
migrating credentials requires affected users to reconnect with Strava.

```sh
supabase functions deploy maintenance --no-verify-jwt
```

`supabase/config.toml` also disables gateway JWT verification for this function.
This is intentional: the handler validates its own opaque sessions; only `begin`
and `exchange` are unauthenticated. CORS permits only `MAINTENANCE_APP_URL`'s
origin, but **CORS is not authentication**. Add gateway/platform rate limiting
for unauthenticated requests before opening this to the public; the built-in
per-account sync cooldown does not protect against distributed login abuse.
Supabase/Strava free quotas and app-wide rate limits still apply.

## 4. Configure the static frontend

Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_MAINTENANCE_API_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/maintenance
```

Restart the dev server, or rebuild the static site. This URL is public; no secret
belongs in frontend configuration. For local development set the function's
`MAINTENANCE_APP_URL` to `http://localhost:5173/maintenance-log/` and use that exact
origin (not `127.0.0.1`). The redirect URL is fixed server-side, never supplied by
the browser. For HTTPS previews, configure that exact preview URL instead.

Open the app **as a standalone page**, not an embedded WordPress/preview iframe,
for Strava authorization. Browsers and Strava may block authorization in frames.
OAuth needs a secure context (HTTPS or localhost) for Web Crypto.

No production deployment is performed by adding these files. The static build
still includes all calculator entry pages and the sitemap. Deploy the function
separately; do not put secrets or Supabase server files in `dist/`.

## Verification

```sh
npm run build
npm test
# On Node versions that expose incompatible native Web Storage globals:
NODE_OPTIONS=--no-experimental-webstorage npm test
# With Deno installed, independently check the Edge Function:
deno check supabase/functions/maintenance/index.ts
```

The mocked handler tests cover session expiry checks, account-scoped deletion and
inserts, bike ownership, mileage validation, origin restrictions, and OAuth
verifier/expiry checks. UI tests cover demo isolation, bike switching, and adding
and deleting a backdated entry. They do **not** replace a real deployment test.

Before launch, use two separate Strava accounts to verify:

1. Consent requests only `read,profile:read_all`; denial is recoverable.
2. First and returning sign-ins work without another login; bikes and distances
   match Strava (grant profile access when prompted).
3. Jobs persist through reload, preserve service mileage after a sync, and never
   create a Strava activity.
4. Each account cannot read/delete the other's records, even with a copied record
   ID, and direct table access using the anonymous key is denied.
5. Sign out invalidates the server session. “Disconnect & delete data” deletes
   the account, all sessions, bikes and entries, and attempts Strava revocation.
   If Strava is unavailable, local data is still deleted and the UI directs the
   user to revoke access in Strava settings.
6. Expired OAuth states and replayed callbacks fail; expired access tokens refresh;
   revoked Strava access and API rate limits produce recoverable errors.

Review logs without recording bearer tokens or OAuth codes. Expired session and
handshake rows are cleaned up on subsequent login starts and never authorize
requests after expiration. Configure backup retention/data-deletion practices in
Supabase; deleting live rows does not erase existing managed backups. Manual-only
accounts and automatic background synchronization are not implemented yet.
