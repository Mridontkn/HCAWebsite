# HCA NHL Headshot Importer

## 1. Run the SQL

Open Supabase -> SQL Editor and run `nhl_headshot_setup.sql` once.

## 2. Deploy the Edge Function

This importer intentionally does NOT call the NHL API from GitHub Pages. The browser calls a Supabase Edge Function, and the Edge Function calls the NHL API server-side.

From the HCAWebsite folder, with the Supabase CLI installed and linked to your project:

```bash
supabase login
supabase link --project-ref sheaqyejsvivslnmfiki
supabase functions deploy import-nhl-headshots
```

The function uses the Supabase project's built-in environment variables. Do not put the service-role key into the website JavaScript.

## 3. Use the importer

Admin -> Players -> Import Player Headshots.

Choose `ALL NHL TEAMS` or one NHL team and click `IMPORT HEADSHOTS`.

The function:

- verifies the signed-in user is an HCA admin;
- fetches NHL rosters server-side;
- reads the `forwards`, `defensemen`, and `goalies` arrays;
- matches against existing HCA `players.player_name` values;
- saves `nhl_player_id` and `headshot_url`;
- never creates a new HCA player.

## 4. NHL API source

The roster endpoint is:

`https://api-web.nhle.com/v1/roster/{TEAM}/current`

It exposes player IDs and headshot fields for current rosters.
