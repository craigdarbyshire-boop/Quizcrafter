-- Teams choose their own names.
alter table public.games add column if not exists team_names jsonb not null default '{}'::jsonb;
