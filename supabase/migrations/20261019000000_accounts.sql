-- Jane accounts: profiles, synced progress, weekly leaderboard and friends.
-- Run once in the Supabase dashboard (SQL Editor) or with `supabase db push`.
-- Row Level Security is on for every table: a user reads and writes only their own rows;
-- leaderboards and friends go through the security-definer functions at the end, which return
-- names and XP only (never e-mail addresses).

-- Profiles ---------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  -- Shared with friends to be added; random, so profiles cannot be enumerated.
  friend_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  -- 'free' or 'premium'. Set by the server only (a future payment hook), never by the client.
  plan text not null default 'free' check (plan in ('free', 'premium')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- New Supabase projects may not grant table access by default. RLS still limits every
-- request to the signed-in user's rows; the client never inserts or deletes profiles.
grant select on public.profiles to authenticated;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- The client may change its name only: not the plan, the friend code or the dates.
revoke update on public.profiles from authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;

-- A profile for every new user. The name comes from the sign-up form or the identity provider
-- (Google, Yandex, VK); otherwise the part of the e-mail before "@".
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  name text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'learner'), '@', 1)
  );
begin
  if char_length(name) < 2 then name := name || '_' || substr(new.id::text, 1, 4); end if;
  insert into public.profiles (id, display_name) values (new.id, left(name, 30));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Progress ---------------------------------------------------------------------------------

-- The learner's whole local database as one JSON snapshot (src/core/storage/backup.ts). The app
-- merges it with the local data on every sync, so no device ever loses progress.
create table public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema integer not null,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

grant select, insert, update on public.progress to authenticated;

create policy "progress: read own" on public.progress
  for select using (auth.uid() = user_id);
create policy "progress: insert own" on public.progress
  for insert with check (auth.uid() = user_id);
create policy "progress: update own" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Stats for leaderboards -------------------------------------------------------------------

create table public.stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  week_xp integer not null default 0 check (week_xp >= 0),
  -- Monday of the week week_xp belongs to; an old week counts as 0.
  week_start date not null default (date_trunc('week', now()))::date,
  streak integer not null default 0 check (streak >= 0),
  updated_at timestamptz not null default now()
);

alter table public.stats enable row level security;

grant select, insert, update on public.stats to authenticated;

create policy "stats: read own" on public.stats
  for select using (auth.uid() = user_id);
create policy "stats: insert own" on public.stats
  for insert with check (auth.uid() = user_id);
create policy "stats: update own" on public.stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Friends ----------------------------------------------------------------------------------

create table public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friendships enable row level security;

grant select, delete on public.friendships to authenticated;

create policy "friendships: read own" on public.friendships
  for select using (auth.uid() = user_id);
create policy "friendships: delete own" on public.friendships
  for delete using (auth.uid() = user_id);
-- Friendships are created only by add_friend(), in both directions at once.

-- Functions --------------------------------------------------------------------------------

-- Adds the owner of a friend code as a friend (both ways). Returns their name, or null.
create function public.add_friend(code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other public.profiles;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into other from public.profiles where friend_code = upper(trim(code));
  if other.id is null or other.id = me then return null; end if;
  insert into public.friendships (user_id, friend_id) values (me, other.id), (other.id, me)
    on conflict do nothing;
  return other.display_name;
end;
$$;

-- Removes a friend (both ways).
create function public.remove_friend(friend uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships
  where (user_id = auth.uid() and friend_id = friend)
     or (user_id = friend and friend_id = auth.uid());
$$;

-- This week's XP: the stored value if it is for the current week, else 0.
create function public.current_week_xp(s public.stats) returns integer
language sql stable set search_path = '' as $$
  select case when s.week_start = (date_trunc('week', now()))::date then s.week_xp else 0 end;
$$;

-- The week's leaderboard among friends, the learner included.
create function public.friends_leaderboard()
returns table (user_id uuid, display_name text, week_xp integer, streak integer, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with people as (
    select auth.uid() as id
    union
    select friend_id from public.friendships where user_id = auth.uid()
  )
  select p.id, p.display_name, coalesce(public.current_week_xp(s), 0), coalesce(s.streak, 0),
         p.id = auth.uid()
  from people
  join public.profiles p on p.id = people.id
  left join public.stats s on s.user_id = p.id
  order by 3 desc, 2;
$$;

-- The week's top learners of everyone (names and XP only).
create function public.global_leaderboard(lim integer default 50)
returns table (display_name text, week_xp integer, is_me boolean)
language sql stable security definer set search_path = '' as $$
  select p.display_name, public.current_week_xp(s), p.id = auth.uid()
  from public.stats s
  join public.profiles p on p.id = s.user_id
  where public.current_week_xp(s) > 0
  order by 2 desc, 1
  limit least(greatest(lim, 1), 100);
$$;

-- Deletes the signed-in user's account and everything linked to it (Settings → delete account).
create function public.delete_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.add_friend(text), public.remove_friend(uuid),
  public.friends_leaderboard(), public.global_leaderboard(integer), public.delete_account()
  from public, anon;
grant execute on function public.add_friend(text), public.remove_friend(uuid),
  public.friends_leaderboard(), public.global_leaderboard(integer), public.delete_account()
  to authenticated;
