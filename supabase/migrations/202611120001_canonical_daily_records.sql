-- Additive canonical FOX2 daily-record metadata.
-- Existing AUC rows and legacy payload snapshots remain valid and unchanged.

alter table if exists public.daily_scores
  add column if not exists represented_duration_minutes smallint null check (
    represented_duration_minutes between 1 and 1440
  ),
  add column if not exists score_algorithm smallint null check (score_algorithm >= 0);

alter table if exists public.devices
  add column if not exists last_x_param text null,
  add column if not exists last_m_param text null,
  add column if not exists last_r_param text null;

comment on column public.daily_scores.auc_score is
  'Firmware-authoritative AUC. The historical column name is retained for compatibility.';
comment on column public.daily_scores.represented_duration_minutes is
  'Duration represented by auc_score; 1440 for a complete day.';
comment on column public.daily_scores.score_algorithm is
  'Version of the firmware AUC/Daily Average algorithm.';
comment on column public.devices.last_r_param is
  'Latest compact represented-duration field for restoring a v2 payload.';
