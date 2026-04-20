-- ============================================================
-- DynastyJudge — Supabase Schema
-- Run this entire file in your Supabase SQL editor
-- Project: dynastyjudge
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron"; -- for scheduled jobs (enable in Supabase dashboard)

-- ============================================================
-- 1. USERS & PROFILES
-- ============================================================

-- Public profiles (extends Supabase auth.users)
create table public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  username      text unique,
  display_name  text,
  avatar_url    text,
  bio           text,
  twitter_handle text,
  website       text,

  -- Subscription tier
  tier          text not null default 'free' check (tier in ('free','pro','elite','creator','admin')),
  tier_expires_at timestamptz,

  -- Creator program
  is_creator        boolean default false,
  creator_weight    numeric(4,2) default 5.0,  -- weight in consensus (0-100)
  creator_fee_active boolean default false,
  creator_stripe_id  text,
  referral_code     text unique,
  referral_rate     numeric(4,2) default 0.25, -- 25% revenue share

  -- Stats
  rankings_count    int default 0,
  followers_count   int default 0,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Referral tracking
create table public.referrals (
  id              uuid default uuid_generate_v4() primary key,
  referrer_id     uuid references public.profiles(id),
  referred_id     uuid references public.profiles(id),
  converted_at    timestamptz,
  revenue_earned  numeric(10,2) default 0,
  created_at      timestamptz default now()
);

-- ============================================================
-- 2. PLAYERS (synced daily from Sleeper API)
-- ============================================================

create table public.players (
  id              uuid default uuid_generate_v4() primary key,
  sleeper_id      text unique not null,
  name            text not null,
  first_name      text,
  last_name       text,
  position        text check (position in ('QB','RB','WR','TE','K','DEF','DL','LB','DB')),
  nfl_team        text,
  age             int,
  years_exp       int,
  college         text,
  height          text,
  weight          text,
  injury_status   text,
  status          text default 'Active',  -- Active, Inactive, IR, PUP, etc.
  is_active       boolean default true,

  -- Devy fields (college/HS prospects)
  is_devy         boolean default false,
  recruiting_class int,
  recruiting_rank  int,
  recruiting_stars int,
  high_school     text,
  devy_notes      text,

  -- Meta
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_players_position on public.players(position);
create index idx_players_sleeper_id on public.players(sleeper_id);
create index idx_players_is_active on public.players(is_active);
create index idx_players_is_devy on public.players(is_devy);

-- ============================================================
-- 3. RANKING BOARDS
-- ============================================================

create table public.ranking_boards (
  id              uuid default uuid_generate_v4() primary key,
  owner_id        uuid references public.profiles(id) on delete cascade,

  -- Board type
  type            text not null check (type in ('ai','editorial','community','creator','personal')),
  -- ai         = automated daily AI rankings
  -- editorial  = DynastyJudge staff rankings (admin only)
  -- community  = individual member's personal board (all tiers)
  -- creator    = verified creator board (featured in consensus)
  -- personal   = same as community but alias for clarity

  -- Format
  format          text not null check (format in ('1qb','sf','teprem','half_ppr','standard','devy')),

  -- Display
  display_name    text,
  description     text,
  is_public       boolean default true,
  is_featured     boolean default false,  -- pinned on rankings page
  is_active       boolean default true,

  -- Consensus participation
  in_consensus    boolean default true,
  consensus_weight numeric(5,2) default 1.0,  -- relative weight in consensus calc

  -- Publishing
  last_published_at timestamptz,
  player_count    int default 0,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_boards_type on public.ranking_boards(type);
create index idx_boards_owner on public.ranking_boards(owner_id);
create index idx_boards_format on public.ranking_boards(format);

-- ============================================================
-- 4. RANKING ENTRIES (the actual ranks)
-- ============================================================

create table public.ranking_entries (
  id          uuid default uuid_generate_v4() primary key,
  board_id    uuid references public.ranking_boards(id) on delete cascade not null,
  player_id   uuid references public.players(id) not null,
  rank        int not null,
  tier        int,       -- 1=Elite, 2=Tier1, 3=Tier2, etc.
  tier_label  text,      -- custom tier name
  note        text,      -- analyst note on this player
  trade_value int,       -- optional KTC-style value (0-9999)
  updated_at  timestamptz default now(),

  unique(board_id, player_id),
  unique(board_id, rank)
);

create index idx_entries_board on public.ranking_entries(board_id);
create index idx_entries_player on public.ranking_entries(player_id);
create index idx_entries_rank on public.ranking_entries(rank);

-- ============================================================
-- 5. CONSENSUS RANKINGS (materialized, auto-computed)
-- ============================================================

create table public.consensus_rankings (
  id              uuid default uuid_generate_v4() primary key,
  player_id       uuid references public.players(id) not null,
  format          text not null,

  -- Per-source ranks
  consensus_rank  numeric(8,2),  -- weighted average
  ai_rank         int,
  editorial_rank  int,
  community_rank  numeric(8,2),  -- avg of all community boards
  creator_rank    numeric(8,2),  -- avg of all creator boards (weighted)

  -- Trend tracking
  prev_consensus_rank numeric(8,2),
  rank_change     numeric(8,2),  -- positive = moved up

  -- Community data
  community_board_count int default 0,  -- how many members have ranked this player
  creator_board_count   int default 0,

  computed_at     timestamptz default now(),

  unique(player_id, format)
);

create index idx_consensus_format on public.consensus_rankings(format);
create index idx_consensus_rank on public.consensus_rankings(consensus_rank);

-- ============================================================
-- 6. CONSENSUS WEIGHTS (admin-configurable)
-- ============================================================

create table public.consensus_weights (
  id               uuid default uuid_generate_v4() primary key,
  format           text not null unique,
  ai_weight        numeric(5,2) default 10.0,
  editorial_weight numeric(5,2) default 30.0,
  community_weight numeric(5,2) default 40.0,
  creator_weight   numeric(5,2) default 20.0,
  updated_at       timestamptz default now(),
  updated_by       uuid references public.profiles(id)
);

-- Insert defaults for all formats
insert into public.consensus_weights (format, ai_weight, editorial_weight, community_weight, creator_weight) values
  ('1qb',      10, 30, 40, 20),
  ('sf',        10, 30, 40, 20),
  ('teprem',    10, 30, 40, 20),
  ('half_ppr',  10, 30, 40, 20),
  ('standard',  10, 30, 40, 20),
  ('devy',      5,  40, 30, 25);

-- ============================================================
-- 7. SUBSCRIPTIONS & PAYMENTS
-- ============================================================

create table public.subscriptions (
  id                uuid default uuid_generate_v4() primary key,
  user_id           uuid references public.profiles(id) not null,
  stripe_customer_id text,
  stripe_sub_id      text unique,
  plan              text check (plan in ('pro','elite','creator')),
  status            text check (status in ('active','canceled','past_due','trialing')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Creator subscription (paid to be featured)
create table public.creator_subscriptions (
  id              uuid default uuid_generate_v4() primary key,
  creator_id      uuid references public.profiles(id) not null,
  stripe_sub_id   text unique,
  monthly_fee     numeric(8,2) default 19.99,
  status          text check (status in ('active','canceled','past_due')),
  revenue_share   numeric(4,2) default 0.25,
  total_earned    numeric(10,2) default 0,
  created_at      timestamptz default now()
);

-- ============================================================
-- 8. CONTENT (articles / rulings)
-- ============================================================

create table public.articles (
  id          uuid default uuid_generate_v4() primary key,
  author_id   uuid references public.profiles(id),
  slug        text unique not null,
  title       text not null,
  subtitle    text,
  body        text,   -- markdown
  verdict     text check (verdict in ('BUY','SELL','HOLD','STASH')),
  player_id   uuid references public.players(id),
  tags        text[],
  is_premium  boolean default false,
  is_published boolean default false,
  published_at timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index idx_articles_slug on public.articles(slug);
create index idx_articles_published on public.articles(is_published, published_at desc);

-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.players           enable row level security;
alter table public.ranking_boards    enable row level security;
alter table public.ranking_entries   enable row level security;
alter table public.consensus_rankings enable row level security;
alter table public.consensus_weights enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.articles          enable row level security;

-- Profiles: users can read all, only edit their own
create policy "profiles_read_all"   on public.profiles for select using (true);
create policy "profiles_edit_own"   on public.profiles for update using (auth.uid() = id);

-- Players: everyone can read
create policy "players_read_all"    on public.players for select using (true);
create policy "players_admin_write" on public.players for all using (
  exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
);

-- Ranking boards: public boards readable by all, own boards editable
create policy "boards_read_public"  on public.ranking_boards for select using (is_public = true or owner_id = auth.uid());
create policy "boards_insert_own"   on public.ranking_boards for insert with check (owner_id = auth.uid());
create policy "boards_update_own"   on public.ranking_boards for update using (owner_id = auth.uid());
create policy "boards_delete_own"   on public.ranking_boards for delete using (owner_id = auth.uid());

-- Ranking entries: follow board visibility
create policy "entries_read"        on public.ranking_entries for select using (
  exists (select 1 from public.ranking_boards b where b.id = board_id and (b.is_public = true or b.owner_id = auth.uid()))
);
create policy "entries_write_own"   on public.ranking_entries for all using (
  exists (select 1 from public.ranking_boards b where b.id = board_id and b.owner_id = auth.uid())
);

-- Consensus: readable by all
create policy "consensus_read_all"  on public.consensus_rankings for select using (true);
create policy "weights_read_all"    on public.consensus_weights for select using (true);
create policy "weights_admin_write" on public.consensus_weights for all using (
  exists (select 1 from public.profiles where id = auth.uid() and tier = 'admin')
);

-- Articles: published articles public, drafts admin-only
create policy "articles_read_published" on public.articles for select using (
  is_published = true or author_id = auth.uid()
);
create policy "articles_write_admin" on public.articles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and tier in ('admin','creator'))
);

-- Subscriptions: users see own only
create policy "subs_own" on public.subscriptions for all using (user_id = auth.uid());

-- ============================================================
-- 10. FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, username, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '', 'g')) || '_' || substr(new.id::text, 1, 4),
    upper(substr(md5(new.id::text), 1, 8))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Recompute consensus when any ranking entry changes
create or replace function public.recompute_consensus(p_format text)
returns void as $$
declare
  w record;
begin
  -- Get weights for this format
  select * into w from public.consensus_weights where format = p_format;

  -- Upsert consensus for all players with at least one ranking
  insert into public.consensus_rankings (
    player_id, format,
    consensus_rank, ai_rank, editorial_rank, community_rank, creator_rank,
    community_board_count, creator_board_count,
    prev_consensus_rank, rank_change, computed_at
  )
  select
    p.id as player_id,
    p_format as format,

    -- Weighted consensus
    (
      coalesce(ai.rank * w.ai_weight, 0) +
      coalesce(ed.rank * w.editorial_weight, 0) +
      coalesce(comm.avg_rank * w.community_weight, 0) +
      coalesce(cre.avg_rank * w.creator_weight, 0)
    ) / nullif(
      (case when ai.rank is not null then w.ai_weight else 0 end) +
      (case when ed.rank is not null then w.editorial_weight else 0 end) +
      (case when comm.avg_rank is not null then w.community_weight else 0 end) +
      (case when cre.avg_rank is not null then w.creator_weight else 0 end)
    , 0) as consensus_rank,

    ai.rank as ai_rank,
    ed.rank as editorial_rank,
    comm.avg_rank as community_rank,
    cre.avg_rank as creator_rank,
    comm.board_count as community_board_count,
    cre.board_count as creator_board_count,

    -- Store previous rank for trend
    (select consensus_rank from public.consensus_rankings cr2
     where cr2.player_id = p.id and cr2.format = p_format) as prev_consensus_rank,
    0 as rank_change,
    now()

  from public.players p

  -- AI board rank
  left join lateral (
    select re.rank from public.ranking_entries re
    join public.ranking_boards rb on rb.id = re.board_id
    where rb.type = 'ai' and rb.format = p_format and re.player_id = p.id and rb.is_active = true
    limit 1
  ) ai on true

  -- Editorial board rank
  left join lateral (
    select re.rank from public.ranking_entries re
    join public.ranking_boards rb on rb.id = re.board_id
    where rb.type = 'editorial' and rb.format = p_format and re.player_id = p.id and rb.is_active = true
    limit 1
  ) ed on true

  -- Community average
  left join lateral (
    select avg(re.rank) as avg_rank, count(distinct rb.id) as board_count
    from public.ranking_entries re
    join public.ranking_boards rb on rb.id = re.board_id
    where rb.type in ('community','personal') and rb.format = p_format
      and re.player_id = p.id and rb.in_consensus = true and rb.is_active = true
  ) comm on true

  -- Creator weighted average
  left join lateral (
    select
      sum(re.rank * rb.consensus_weight) / nullif(sum(rb.consensus_weight), 0) as avg_rank,
      count(distinct rb.id) as board_count
    from public.ranking_entries re
    join public.ranking_boards rb on rb.id = re.board_id
    where rb.type = 'creator' and rb.format = p_format
      and re.player_id = p.id and rb.in_consensus = true and rb.is_active = true
  ) cre on true

  where (ai.rank is not null or ed.rank is not null or comm.avg_rank is not null or cre.avg_rank is not null)

  on conflict (player_id, format) do update set
    prev_consensus_rank = consensus_rankings.consensus_rank,
    consensus_rank      = excluded.consensus_rank,
    ai_rank             = excluded.ai_rank,
    editorial_rank      = excluded.editorial_rank,
    community_rank      = excluded.community_rank,
    creator_rank        = excluded.creator_rank,
    rank_change         = consensus_rankings.consensus_rank - excluded.consensus_rank,
    community_board_count = excluded.community_board_count,
    creator_board_count   = excluded.creator_board_count,
    computed_at         = now();

end;
$$ language plpgsql security definer;

-- Trigger: recompute consensus when ranking entry changes
create or replace function public.trigger_consensus_recompute()
returns trigger as $$
declare
  board_format text;
begin
  select format into board_format from public.ranking_boards
  where id = coalesce(new.board_id, old.board_id);

  perform public.recompute_consensus(board_format);
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger on_ranking_entry_change
  after insert or update or delete on public.ranking_entries
  for each row execute procedure public.trigger_consensus_recompute();

-- Trigger: update profile rankings_count
create or replace function public.update_rankings_count()
returns trigger as $$
begin
  update public.profiles
  set rankings_count = (
    select count(*) from public.ranking_boards
    where owner_id = coalesce(new.owner_id, old.owner_id) and is_active = true
  )
  where id = coalesce(new.owner_id, old.owner_id);
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger on_board_change
  after insert or update or delete on public.ranking_boards
  for each row execute procedure public.update_rankings_count();

-- ============================================================
-- 11. HELPFUL VIEWS
-- ============================================================

-- Full consensus with player info (what the rankings page queries)
create view public.v_consensus_rankings as
select
  cr.*,
  p.name,
  p.position,
  p.nfl_team,
  p.age,
  p.injury_status,
  p.status as player_status,
  case
    when cr.rank_change > 0 then 'up'
    when cr.rank_change < 0 then 'down'
    else 'hold'
  end as trend
from public.consensus_rankings cr
join public.players p on p.id = cr.player_id
where p.is_active = true;

-- Creator leaderboard
create view public.v_creator_leaderboard as
select
  pr.id,
  pr.display_name,
  pr.username,
  pr.avatar_url,
  pr.bio,
  pr.twitter_handle,
  pr.creator_weight,
  pr.followers_count,
  cs.total_earned,
  cs.status as subscription_status,
  count(rb.id) as board_count
from public.profiles pr
join public.creator_subscriptions cs on cs.creator_id = pr.id
left join public.ranking_boards rb on rb.owner_id = pr.id and rb.is_active = true
where pr.is_creator = true
group by pr.id, pr.display_name, pr.username, pr.avatar_url, pr.bio,
         pr.twitter_handle, pr.creator_weight, pr.followers_count,
         cs.total_earned, cs.status;

-- ============================================================
-- 12. REALTIME (enable for live rankings updates)
-- ============================================================

-- Enable realtime on these tables in Supabase dashboard:
-- consensus_rankings, ranking_entries, ranking_boards

-- Run in Supabase SQL editor to enable realtime:
alter publication supabase_realtime add table public.consensus_rankings;
alter publication supabase_realtime add table public.ranking_entries;

-- ============================================================
-- DONE. Next steps:
-- 1. Add your first admin user:
--    update public.profiles set tier = 'admin' where id = 'YOUR-USER-UUID';
-- 2. Run the player sync job to populate the players table
-- 3. Create the editorial ranking board:
--    insert into public.ranking_boards (type, format, display_name, in_consensus, consensus_weight)
--    values ('editorial', '1qb', 'DynastyJudge Staff Rankings', true, 1.0);
-- ============================================================
