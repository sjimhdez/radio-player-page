# Dev fixtures

Seeds a fresh local WordPress install with a fully working example of Radio
Player Page: one radio station with every field filled in, 5 radio shows with
full content, uploaded artwork + intro audio, and a complete 7-day schedule
(including reruns and a slot that crosses midnight).

Use this to get a real end-to-end setup to click through or test against,
without filling in every field by hand each time you reset your local
environment.

## Requirements

- WP-CLI (`wp`) available and pointed at the target WordPress install.
- WordPress already installed.
- Radio Player Page installed **and activated** (`wp plugin activate radio-player-page`).

No network access or external streaming server is needed — the station's
"Streaming URL" points at the fixture's own uploaded mp3, so the player has
something real and local to play.

## Usage

From the plugin directory, via the wrapper in `scripts/`:

```bash
./scripts/seed-fixtures.sh
```

Any extra arguments are passed straight through to WP-CLI, e.g. if `wp` isn't
already scoped to the install:

```bash
./scripts/seed-fixtures.sh --path=/path/to/wordpress
```

Or run `wp eval-file` directly:

```bash
wp eval-file wp-content/plugins/radio-player-page/scripts/fixtures/seed.php
```

The script prints the player page URL and the station's edit link when done.

## What it creates

- 1 attachment: `assets/station-artwork.jpg` (reused as station background,
  station logo, and all 5 radio show logos).
- 1 attachment: `assets/intro.mp3` (used as both the intro audio *and* the
  stream URL, so playback works with zero external dependencies).
- 1 published WP page ("Fixture Radio Station"), assigned to the station.
- 1 `radplapag_station` post with every meta field set: stream URL, theme
  color, visualizer, background, logo, intro audio, assigned page, and a
  full weekly schedule.
- 5 `radplapag_program` posts, each with a name, short description and
  extended description: Morning Drive, Indie Waves, Late Night Jazz,
  Weekend Sports Hour, Sunday Chill.
- A schedule covering all 7 days, with:
  - Several rerun slots (`is_rerun: true`).
  - One slot crossing midnight: **Sunday 23:00 -> Monday 01:00** (Sunday
    Chill), which exercises the cross-day overlap check in
    `radplapag_sanitize_station_schedule()` without triggering it (Monday's
    first slot starts at 07:00, well after 01:00).

If the schedule fails validation for any reason, the script aborts via
`WP_CLI::error` and nothing partial is saved — see the error message printed,
it comes directly from the plugin's own validation.

## Re-running

The script is idempotent: every post and attachment it creates is tagged
with a private meta key (`_radplapag_fixture_batch`). Each run starts by
force-deleting everything tagged from a previous run, then recreates
everything from scratch. Running it repeatedly never accumulates duplicates,
and it never touches content you created by hand.

## Replacing the placeholder assets

`assets/station-artwork.jpg` and `assets/intro.mp3` are minimal generated
placeholders (a solid-color JPEG and a 3-second sine tone), just enough to
satisfy the plugin's upload validation (the intro audio must be a real
`audio/mpeg` file, checked via `get_post_mime_type()`). Swap either file for
something more realistic — same filenames, same directory — and the script
picks them up automatically on the next run.

## Customizing

All fixture content (show names/descriptions, theme color, visualizer,
schedule) is defined as plain PHP arrays near the top of `seed.php` — edit
them directly rather than adding CLI flags; this script is meant to be a
single, readable source of truth for "what a filled-in test station looks
like."
