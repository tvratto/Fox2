# FOX2 time model migration

## Compatibility rule

Unversioned field-device payloads remain `legacy_local_as_utc`. Their encoded
calendar values, database timestamps, and rendering are not reinterpreted or
rewritten.

The web app recognizes a future UTC-RTC-aware payload only when both conditions
are true:

- the payload schema is version 2 or newer; and
- `z=` contains a valid IANA time-zone name such as
  `America/Los_Angeles`.

Until then, the legacy path is used even if a numeric `tz=` offset is present.
A numeric offset describes only one instant and is not sufficient to apply
daylight-saving rules.

## Canonical meanings

| Value | Meaning |
| --- | --- |
| `reading_ts` | Compatibility local-wall-time-as-UTC value used by the existing web app. |
| `reading_utc_ts` | True UTC measurement instant when it can be derived safely. |
| `local_date` | Device-local calendar date used for daily grouping. |
| `local_minute` | Minute within the device-local day. |
| `day_date` | Canonical device-local date for a daily Fat Use Score. |
| `time_zone` | IANA time-zone rule set. |
| `time_basis` | Explicit interpretation of the row's time fields. |

Existing null `time_basis` values are treated as `legacy_local_as_utc`.

## Deployment order

1. Apply the additive Supabase migration.
2. Deploy the dual-path web app.
3. Verify unversioned field-device URLs still write and render normally.
4. Release UTC-RTC-aware firmware only to test devices.
5. Test spring-forward, fall-back, midnight finalization, NFC sync, and mixed
   legacy/new history before wider firmware rollout.

The database migration never updates or deletes existing rows. The web app
continues to populate the compatibility fields so older UI code and existing
devices are unaffected.

The `devices` snapshot preserves the IANA zone independently of the legacy
numeric offset. An ID-only restore or an already-open page can therefore
restore the zone that arrived in the newest compatible device sync.
