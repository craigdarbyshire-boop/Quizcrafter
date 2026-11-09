-- Every question Quizcrafter has asked, so the AI never repeats one.
create table if not exists public.question_history (
  id bigint generated always as identity primary key,
  category text not null,
  category_key text not null,
  question text not null,
  answer text not null,
  type text not null check (type in ('multiple_choice', 'true_false', 'typed')),
  asked_at timestamptz not null default now()
);

create index if not exists question_history_category_idx
  on public.question_history (category_key, asked_at desc);

-- Only the server (service role) reads and writes history; browsers get nothing.
alter table public.question_history enable row level security;
