-- Additive FOX2 time model for UTC-RTC firmware.
--
-- Existing field devices and rows use device-local wall time encoded as UTC.
-- Those values are deliberately left untouched. New firmware may additionally
-- provide a true UTC instant, local calendar identity, and IANA time zone.

alter table if exists public.readings
  add column if not exists reading_utc_ts timestamptz null,
  add column if not exists local_date date null,
  add column if not exists local_minute smallint null check (local_minute between 0 and 1439),
  add column if not exists time_zone text null check (char_length(time_zone) between 1 and 64),
  add column if not exists time_basis text null check (
    time_basis in ('legacy_local_as_utc', 'utc_rtc_local_calendar_v1')
  );

alter table if exists public.daily_scores
  add column if not exists time_zone text null check (char_length(time_zone) between 1 and 64),
  add column if not exists time_basis text null check (
    time_basis in ('legacy_local_as_utc', 'utc_rtc_local_calendar_v1')
  );

alter table if exists public.devices
  add column if not exists time_zone text null check (char_length(time_zone) between 1 and 64),
  add column if not exists time_basis text null check (
    time_basis in ('legacy_local_as_utc', 'utc_rtc_local_calendar_v1')
  ),
  add column if not exists last_measurement_utc_at timestamptz null,
  add column if not exists current_utc_offset_minutes smallint null check (
    current_utc_offset_minutes between -840 and 840
  );

create index if not exists readings_device_utc_idx
  on public.readings (device_id, reading_utc_ts)
  where reading_utc_ts is not null;

comment on column public.readings.reading_ts is
  'Compatibility timestamp. Legacy rows contain device-local wall time represented with a UTC suffix.';
comment on column public.readings.reading_utc_ts is
  'True UTC measurement instant when supplied by UTC-RTC-aware firmware; null for legacy rows.';
comment on column public.readings.local_date is
  'Device-local calendar date used for daily grouping.';
comment on column public.readings.local_minute is
  'Minute of the device-local calendar day, 0 through 1439.';
comment on column public.readings.time_basis is
  'Explicit interpretation of this row time; null existing rows are legacy_local_as_utc.';
comment on column public.devices.time_zone is
  'IANA time-zone name supplied by compatible firmware, for example America/Los_Angeles.';
comment on column public.devices.last_measurement_utc_at is
  'True UTC time of the newest measurement when known; null for legacy payloads.';
