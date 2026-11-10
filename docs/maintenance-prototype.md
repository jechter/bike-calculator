# Browser-only maintenance mode

> For shared server storage and preservation of existing local records, see
> [server setup and safe migration](maintenance-server-storage.md). This page
> describes the default mode when no server-storage URL is configured.

Open **Maintenance Log** and paste a personal API key from
[Intervals.icu Settings → Developer Settings](https://intervals.icu/settings).
No OAuth application, Supabase project, environment variable, or server is needed.
The key is a credential with potentially broad read/write access: only enter it
in a deployment you trust, never into a shared link, chat, or source file.

## Where data goes

- Connecting and **Refresh mileage** make two authenticated HTTPS GET requests
  directly from your browser to `intervals.icu`: profile and gear. They do not
  call gear recalculation or modify remote data. No activity files are requested.
- **Open Intervals.icu gear settings** opens
  `https://intervals.icu/settings/gear` in a separate tab, without passing the API
  key or any credentials. Use “Update from Strava” there, then “Refresh mileage”
  here. The experimental sync endpoints have been removed: the versioned URL
  was unavailable and the internal web endpoint was blocked by browser CORS.
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
  and are not automatically backed up. Use **Download records backup** to export
  them before clearing site data or migrating. A file-restore UI is not yet
  implemented; keep both the JSON export and the original browser copy.

## Behavior

Real bike distance values are taken from Intervals.icu gear totals in meters and
shown in kilometers. Refresh mileage only reloads the stored totals. The earlier
recalculation experiment was removed because its results were unsuitable; there
are no calls to `/gear/{gearId}/calc` and calculated values are never written
back. To fetch new Strava gear totals, follow the external gear-settings link,
trigger “Update from Strava” in Intervals.icu, then refresh this page's mileage.
Saved maintenance odometer readings remain unchanged. Refresh failures preserve
the existing garage, saved API key, and local records. Totals can differ from
Strava if gear edits didn't sync.
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
Each log item also shows the distance ridden between its recorded odometer and
its previous matching service task, or the latest replacement if that happened
in between. A replacement compares with the previous replacement. Matching uses
the same bike/component and case/whitespace-normalized task text; differently
worded tasks are not treated as equivalent. Calculations use all records, not
just the visible filter. With no baseline, the interval is omitted. Inconsistent
odometer readings show a warning instead of negative distance. Same-day records
are ordered by recorded mileage, with replacements before services when both
are identical. These are derived values, not changes to stored history. The log displays a
bike icon with the recorded mileage, then a component icon for distance since
replacement or a wrench for distance since matching service. Hover titles and
accessible labels explain the values and identify the baseline record.
Replacement titles are generated automatically. Edit modifies an existing local
record at its original date/mileage; Repeat opens a new draft at today's date and
current synced mileage for that entry's bike, including from the all-bikes view.
The form includes a bike selector, defaulting to the selected bike (or the first
bike when nothing is selected). Saving selects the saved record's bike and
component so the result remains visible. Saving, editing, and deleting only
change local storage.
A failed storage write reports an error and does not pretend the record was saved.

The demo uses sample data in memory and never persists records or makes requests.

## Layout

Primary actions live in the page title bar (the shared bottom toolbar on compact
screens). More contains the external gear-settings link, backup download,
disconnect, and browser-only deletion. The bike list and log have separate,
keyboard-focusable scroll views; their headings stay outside the scrolling
content. Wide screens show them side by side, while compact screens stack them.
Forms open inside the log's scroll view. Browser-backup downloads and pending
imports are available under More instead of printing a persistent notice.

## Shared storage

An optional shared Supabase backend is now implemented. It is enabled by
`VITE_MAINTENANCE_STORAGE_URL`; see the [setup guide](maintenance-server-storage.md).
It does not silently switch modes on failures. Keep the same frontend origin to
access existing localStorage records, and use the explicit import action. The
old Strava/Supabase function remains unused; its environment variable is not the
new storage endpoint. OAuth login and a file-restore UI remain future work.
