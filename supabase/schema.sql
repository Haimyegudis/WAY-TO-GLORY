-- Road to Glory: cloud saves and a shared leaderboard.
--
-- The game is local-first; this schema only mirrors saves for sync between devices
-- and exposes a leaderboard of finished (and in-progress) careers. Every row is
-- owned by exactly one signed-in user and is unreadable by anyone else.

create table if not exists public.careers (
  user_id uuid not null references auth.users (id) on delete cascade,
  career_seed bigint not null,
  player_name text not null,
  age int not null,
  club_name text not null default '',
  ovr int not null default 0,
  season int not null default 0,
  career_score int not null default 0,
  retired boolean not null default false,
  save text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, career_seed)
);

alter table public.careers enable row level security;

drop policy if exists "own careers: select" on public.careers;
create policy "own careers: select"
  on public.careers for select
  using (auth.uid() = user_id);

drop policy if exists "own careers: insert" on public.careers;
create policy "own careers: insert"
  on public.careers for insert
  with check (auth.uid() = user_id);

drop policy if exists "own careers: update" on public.careers;
create policy "own careers: update"
  on public.careers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own careers: delete" on public.careers;
create policy "own careers: delete"
  on public.careers for delete
  using (auth.uid() = user_id);

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists careers_touch_updated_at on public.careers;
create trigger careers_touch_updated_at
  before update on public.careers
  for each row execute function public.touch_updated_at();

-- The leaderboard exposes the summary of every career but never the save blob.
-- security_invoker stays off so the view can read across users, and the columns it
-- selects are the only thing anyone else can see.
drop view if exists public.leaderboard;
create view public.leaderboard
with (security_invoker = off) as
select
  player_name,
  club_name,
  ovr,
  season,
  career_score,
  retired,
  updated_at
from public.careers
order by career_score desc, ovr desc
limit 200;

grant select on public.leaderboard to anon, authenticated;
