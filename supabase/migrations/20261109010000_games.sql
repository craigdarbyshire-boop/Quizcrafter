-- Live games. Only the server (service role) touches these tables; phones talk to the API.
create table if not exists public.games (
  id uuid primary key,
  code text not null,
  host_player_id uuid not null,
  settings jsonb not null,
  phase text not null check (phase in ('lobby', 'generating', 'question', 'reveal', 'round_over', 'ended')),
  round int not null default 1,
  q_index int not null default 0,
  phase_started_at timestamptz not null default now(),
  team_categories jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists games_code_idx on public.games (code, created_at desc);

create table if not exists public.players (
  id uuid primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  name text not null,
  team int not null,
  token text not null,
  joined_at timestamptz not null default now()
);
create index if not exists players_game_idx on public.players (game_id);

create table if not exists public.game_questions (
  game_id uuid not null references public.games (id) on delete cascade,
  round int not null,
  idx int not null,
  team int not null,
  question jsonb not null,
  primary key (game_id, round, idx)
);

create table if not exists public.answers (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  round int not null,
  q_index int not null,
  player_id uuid not null references public.players (id) on delete cascade,
  team int not null,
  answer text not null,
  correct boolean not null,
  points int not null default 0,
  -- Silent mode: one answer per team. Fastest mode: only the first correct answer wins.
  team_lock int,
  win_lock int,
  created_at timestamptz not null default now(),
  unique (game_id, round, q_index, player_id),
  unique (game_id, round, q_index, team_lock),
  unique (game_id, round, q_index, win_lock)
);
create index if not exists answers_game_idx on public.answers (game_id, round);

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.game_questions enable row level security;
alter table public.answers enable row level security;
