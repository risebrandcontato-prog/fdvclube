
-- Enums
create type public.player_position as enum ('goleiro', 'defensor', 'meio', 'atacante');
create type public.invite_status as enum ('pending', 'used', 'blocked', 'revoked');
create type public.game_status as enum ('scheduled', 'cancelled', 'done');
create type public.confirmation_status as enum ('confirmed', 'cancelled');
create type public.payment_status as enum ('paid', 'pending', 'late', 'exempt');

-- Invite codes
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status public.invite_status not null default 'pending',
  created_by uuid,
  used_by uuid,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Players
create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  position public.player_position not null,
  invite_code_id uuid references public.invite_codes(id) on delete set null,
  is_admin boolean not null default false,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.invite_codes
  add constraint invite_codes_used_by_fk foreign key (used_by) references public.players(id) on delete set null;
alter table public.invite_codes
  add constraint invite_codes_created_by_fk foreign key (created_by) references public.players(id) on delete set null;

-- Device sessions (custom token-based auth)
create table public.player_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index player_sessions_token_idx on public.player_sessions(token);

-- Locations
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  maps_url text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- Games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  time time not null,
  location_id uuid references public.locations(id) on delete set null,
  status public.game_status not null default 'scheduled',
  max_players int not null default 14,
  contribution_amount numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index games_date_idx on public.games(date desc);

-- Confirmations
create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status public.confirmation_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);

-- Payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, player_id)
);

-- RLS: enable on all tables. Access is mediated through server functions using service role.
alter table public.invite_codes enable row level security;
alter table public.players enable row level security;
alter table public.player_sessions enable row level security;
alter table public.locations enable row level security;
alter table public.games enable row level security;
alter table public.confirmations enable row level security;
alter table public.payments enable row level security;

-- No public policies. All access flows through server functions with supabaseAdmin.
-- Realtime needs the table in the publication; access is still gated server-side.
-- For realtime to deliver row data to clients, we add narrow read policies for
-- non-sensitive tables.

create policy "Public read games" on public.games for select using (true);
create policy "Public read locations" on public.locations for select using (true);
create policy "Public read players non-sensitive" on public.players for select using (true);
create policy "Public read confirmations" on public.confirmations for select using (true);
create policy "Public read payments" on public.payments for select using (true);

-- Realtime
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.confirmations;
alter publication supabase_realtime add table public.payments;

-- Updated_at triggers
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_confirmations before update on public.confirmations
  for each row execute function public.touch_updated_at();
create trigger touch_payments before update on public.payments
  for each row execute function public.touch_updated_at();

-- Seed admin invite code
insert into public.invite_codes (code, status, is_admin)
values ('FDV-ADMIN-2026', 'pending', true);

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('fields', 'fields', true)
on conflict (id) do nothing;

create policy "Public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "Anyone can upload avatars" on storage.objects for insert
  with check (bucket_id = 'avatars');
create policy "Anyone can update avatars" on storage.objects for update
  using (bucket_id = 'avatars');

create policy "Public read fields" on storage.objects for select
  using (bucket_id = 'fields');
create policy "Anyone can upload fields" on storage.objects for insert
  with check (bucket_id = 'fields');
create policy "Anyone can update fields" on storage.objects for update
  using (bucket_id = 'fields');
