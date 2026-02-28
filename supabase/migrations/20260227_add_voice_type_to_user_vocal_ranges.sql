-- Add optional voice type classification to user vocal ranges
alter table if exists public.user_vocal_ranges
add column if not exists voice_type text;

comment on column public.user_vocal_ranges.voice_type is
'User voice type label. May be auto-estimated from detected range or manually selected by user.';
