-- HCA NHL HEADSHOT IMPORT SETUP
-- Run once in Supabase SQL Editor.
-- The importer stores the NHL player ID and the headshot URL on the existing players table.

alter table public.players
  add column if not exists headshot_url text,
  add column if not exists nhl_player_id integer;

create index if not exists players_nhl_player_id_idx
  on public.players(nhl_player_id);

-- Optional but useful for checking imported records.
-- select player_name, nhl_player_id, headshot_url
-- from public.players
-- where headshot_url is not null
-- order by player_name;
