-- FASE 0 - Schema adicional (referência para execução manual no Supabase SQL Editor)
-- Esta migração foi escrita para ser aditiva e evitar quebra do schema atual.

-- Extensão para gen_random_uuid (normalmente já existe no Supabase)
create extension if not exists pgcrypto;

-- ==========================================
-- A) ESTATISTICAS POR JOGADOR POR JOGO
-- ==========================================
create table if not exists public.game_player_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  own_goals integer not null default 0 check (own_goals >= 0),
  yellow_cards integer not null default 0 check (yellow_cards >= 0),
  red_cards integer not null default 0 check (red_cards >= 0),
  rating integer check (rating between 1 and 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);

create index if not exists idx_game_player_stats_game_id
  on public.game_player_stats(game_id);

create index if not exists idx_game_player_stats_player_id
  on public.game_player_stats(player_id);

-- ==========================================
-- B) TIMES / SORTEIO
-- ==========================================
-- Observacao: a tabela public.game_teams ja existe no schema atual, com formato antigo.
-- Aqui adicionamos os campos/constraints necessarios para o novo formato.
alter table public.game_teams
  add column if not exists color text;

alter table public.game_teams
  alter column team_name drop default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'game_teams_game_id_team_name_key'
      and conrelid = 'public.game_teams'::regclass
  ) then
    alter table public.game_teams
      add constraint game_teams_game_id_team_name_key unique (game_id, team_name);
  end if;
end $$;

create table if not exists public.game_team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.game_teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, player_id)
);

create index if not exists idx_game_team_players_team_id
  on public.game_team_players(team_id);

create index if not exists idx_game_team_players_player_id
  on public.game_team_players(player_id);

-- ==========================================
-- C) HISTORICO / RESUMO DO JOGO
-- ==========================================
create table if not exists public.game_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique references public.games(id) on delete cascade,
  team_a_id uuid references public.game_teams(id) on delete set null,
  team_b_id uuid references public.game_teams(id) on delete set null,
  score_a integer not null default 0 check (score_a >= 0),
  score_b integer not null default 0 check (score_b >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'finished', 'cancelled')),
  mvp_player_id uuid references public.players(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_results_status
  on public.game_results(status);

-- ==========================================
-- D) PERFIL EXPANDIDO (players)
-- ==========================================
alter table public.players
  add column if not exists phone text,
  add column if not exists nickname text,
  add column if not exists birth_date date,
  add column if not exists preferred_position text,
  add column if not exists secondary_position text,
  add column if not exists strong_foot text,
  add column if not exists player_code text,
  add column if not exists is_active boolean not null default true,
  add column if not exists blocked_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'players_strong_foot_check'
      and conrelid = 'public.players'::regclass
  ) then
    alter table public.players
      add constraint players_strong_foot_check
      check (strong_foot is null or strong_foot in ('left', 'right', 'both'));
  end if;
end $$;

create unique index if not exists idx_players_player_code_unique
  on public.players(player_code)
  where player_code is not null;
