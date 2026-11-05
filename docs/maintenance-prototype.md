# Intervals.icu maintenance design prototype

Open **Maintenance Log** and paste a personal API key from
[Intervals.icu Settings → Developer Settings](https://intervals.icu/settings).
No OAuth application, Supabase project, environment variable, or server is needed.
The key is a credential with potentially broad read/write access: only enter it
in a deployment you trust, never into a shared link, chat, or source file.

## Where data goes

- The page makes two authenticated HTTPS GET requests directly from your browser
  to `intervals.icu`: your profile (for account ID/name) and gear list. It never
  writes to Intervals.icu or requests activity files.
- After a successful connection, the key is stored **unencrypted in localStorage**
  under `maintenance-intervals-api-key-v1`. The page reconnects automatically on
  reload. Anyone with access to this browser, or scripts on the same origin, can
  read it; do not use this on shared/untrusted browsers. It is not placed in a
  URL or sent to our server. The Intervals.icu API permits cross-origin requests
  with the Authorization header. Invalid keys are not newly saved. Temporary
  reconnection errors leave the saved key available for retry; use “Forget saved
  API key” on the connection screen to remove it.
- Maintenance records are local JSON in browser localStorage, partitioned by the
  authenticated Intervals.icu athlete ID. This is convenience separation, **not
  server-enforced authorization or encryption**. Other scripts or people with
  access to this browser/origin can read local records. Use a dedicated origin
  and do not treat this prototype as secure multi-user cloud storage.
- Disconnect removes the saved key and keeps maintenance records. “Delete local records” removes records for
  the current athlete from this browser only. Neither action revokes the API key
  or changes your Intervals.icu account. Revoke/regenerate keys in Intervals.icu.
- Clearing site data removes records. They do not sync across browsers/devices,
  and there is currently no export/backup feature. Keep important records
  elsewhere while evaluating the prototype.

## Behavior

Real bike distance values are taken from Intervals.icu gear totals in meters and
shown in kilometers. Refresh mileage performs another read; it never rewrites
saved service mileages. Totals can differ from Strava if gear edits didn't sync.
Retired bikes returned by the API are retained so they can still have a log.

The top list is a bike/component tree. Clicking either the bike row or its arrow
opens and selects that bike, filtering the log to its records. Only one bike can
be open at a time. Folding it clears bike and component selection, showing all
maintenance again. Selecting a component filters further; selecting that same
component again returns to the open bike's full log. Switching bikes also clears
the component filter. There are no separate reset buttons. Initially all bikes
are folded and all records are shown, newest first. Each log item identifies its
bike and component.
Component suggestions, relevant service suggestions, and icon IDs come from
`src/data/maintenance-components.json`. The form updates service suggestions as
the component changes without overwriting typed task text. Custom components
use a generic icon and generic suggestions; free-text tasks remain supported.
Only components with records appear. Missing service counters stay hidden.
The latest service task is shown below its distance counter. On wide screens,
the bike/component tree and maintenance log sit side by side; narrow screens
keep the stacked layout.
Replacement titles are generated automatically. Edit modifies an existing local
record at its original date/mileage; Repeat opens a new draft at today's date and
current synced mileage for that entry's bike, including from the all-bikes view.
The form includes a bike selector, defaulting to the selected bike (or the first
bike when nothing is selected). Saving selects the saved record's bike and
component so the result remains visible. Saving, editing, and deleting only
change local storage.
A failed storage write reports an error and does not pretend the record was saved.

The demo uses sample data in memory and never persists records or makes requests.

## Production later

The original Strava/Supabase scaffold remains for reference, but the current UI
no longer calls it or uses `VITE_MAINTENANCE_API_URL`. OAuth application approval,
server-side sessions, durable private storage, source-permission review, backups,
and suitable rate limiting remain work for a production integration. API keys
are intentionally only a temporary design/testing path.
