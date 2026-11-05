# Read-only Intervals.icu data probe

This is a personal-account feasibility test, not the application's multi-user
integration. It requires no Supabase project or OAuth app approval. Multi-user
integration should use OAuth, not collect users' personal API keys.

## Run

1. Sign in at <https://intervals.icu/settings>. Find **Developer Settings** near
   the bottom and generate a personal API key. It grants broad access: treat it
   like a password, and do not paste it into chat.
2. Put only the key in `.intervals-api-key.local` at the repository root (comment
   lines beginning with `#` are allowed). The file is ignored by git. For another
   location, set `INTERVALS_API_KEY_FILE` to that file's path; do not pass the key
   itself on the command line.
3. Run `npm run probe:intervals` from the repository root, using Node 18+.
4. Inspect `artifacts/intervals-probe.local.json`. This report is also ignored by
   git. It still contains personal data; don't publish it without reviewing it.
5. Remove the key file or regenerate the key in Intervals.icu after testing if
   you no longer want this workspace to have access.

The script only makes these three GET requests to `https://intervals.icu`:

- `/api/v1/athlete/0`: retain only athlete ID and name.
- `/api/v1/athlete/0/gear`: retain gear identity/type, usage totals, component
  links, retirement dates, and selected reminder counters.
- `/api/v1/athlete/0/activities`: request at most 30 activities in the last
  30 days, with distance, date, bike, source, and device fields only.

No uploads, edits, recalculation requests, or deletions are performed. Credentials
are sent only in the Authorization header. Redirects are not followed. Responses
are allowlisted before saving; raw profile/activity responses and upstream error
bodies are not saved or printed. API keys are never printed. The probe stops on
401 or 429 rather than repeatedly retrying. Successful empty responses and failed
requests are distinguished in the report's `endpoints` section.

## What to check

- Do bike names and IDs match the gear page? Are any retired bikes missing?
- What are the returned distance values? Compare a known bike's total with the
  Intervals.icu UI to verify units and completeness before mapping to kilometers.
- Are recent rides populated with distances and the correct bike IDs?
- Which sources are reported? Missing fields/stubs do not prove their source or
  reason for withholding. A 403 does not on its own establish a source restriction.
- Do returned aggregate totals include data whose downstream use is restricted?
  API accessibility alone does not answer that policy question. Confirm with
  Intervals.icu before using restricted-source totals in a public integration.

Documentation: [API reference](https://intervals.icu/api-docs.html),
[API access and source restrictions](https://forum.intervals.icu/t/api-access-to-intervals-icu/609),
[OAuth](https://forum.intervals.icu/t/intervals-icu-oauth-support/2759).

## Tests

`npx vitest run scripts/probe-intervals.test.mjs` tests the probe with synthetic
responses, including filtering, read-only requests, and sanitized failures. These
are not evidence of access to any real user's account.
