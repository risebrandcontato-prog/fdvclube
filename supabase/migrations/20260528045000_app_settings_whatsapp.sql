-- App settings (single-row) for UI links like WhatsApp group
create table if not exists public.app_settings (
  id int primary key,
  whatsapp_group_url text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

alter table public.app_settings enable row level security;

-- Seed singleton row (safe if already exists)
insert into public.app_settings (id, whatsapp_group_url)
values (1, null)
on conflict (id) do nothing;

