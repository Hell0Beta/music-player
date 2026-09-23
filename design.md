# Design.md — Record Player

## Subject & brief
A single-track (or small-tracklist) audio player presented as a physical
object: a vinyl record on a turntable, not a media app. Like storytime's
book, the file should feel like a small artifact you "own" — the two
moments that carry the most weight are the **disc** (first impression)
and the **drop of the tonearm** (the interaction that has to feel
mechanical, not like a play button).

## Plan

### Color
| Token | Hex | Role |
|---|---|---|
| `--bg-1` / `--bg-2` | `#1B140F` / `#241B14` | Room background and plinth — warm near-black browns, like a dim listening room, not pure black |
| `--vinyl` / `--groove` | `#100D0A` / `#2A2119` | Disc surface and groove rings — built with a repeating radial gradient, no image assets |
| `--brass` / `--brass-light` | `#C79A4B` / `#E6C789` | Label, tonearm hardware, play button, scrubber fill — the only accent |
| `--cream` | `#F2E9D8` | Title text — warm off-white, matching aged paper tones |
| `--muted` | `#A9998C` | Artist, timecodes, hints — quiet secondary text |

One accent, spent on brass hardware. Deliberately avoided: neon-accent
dark-mode players and blue/purple gradient defaults — the warmth of the
palette is what makes it read as wood-and-brass rather than an app UI.

### Type
- **Fraunces** — the same display serif storytime uses for its cover and
  chapter headings, here for the track title. Keeps the two projects
  feeling like siblings from the same shelf.
- **Inter** — small UI text only (artist, timecodes, counter). Timecodes
  use `font-variant-numeric: tabular-nums` so they don't jitter.

### Layout
```
┌──────────────────────────┐
│      Midnight Drive      │
│      Unknown Artist      │
│                   ╭─┐    │
│        ◉◉◉        │ │    │  ← tonearm swings on when playing
│      ◉◉◉◉◉◉       ╰─┘    │
│        ◉◉◉               │
│  (▶)  ────●──────────    │
│  0:00            3:42    │
└──────────────────────────┘
```
- A single centered "plinth" object on a dark, out-of-focus background —
  same "one object, not a dashboard" principle as storytime's book.
- The disc carries the identity: grooves are pure CSS
  (`repeating-radial-gradient`), the label is a brass radial gradient,
  and album art (when provided) replaces the grooves and spins with the
  record.
- The tonearm sits **outside** the disc's bounding box (top-right,
  overflowing the card slightly) and rotates around its pivot
  (`transform-origin` at the counterweight end) from rest position
  (−22°) to playing position (2°) with a slow 0.7s ease — the mechanical
  gesture of the design.

### Principles
1. **The tonearm drop is the one bold interactive move.** Pressing play
   visibly *engages a mechanism* — the arm swings in, the disc starts
   spinning, and only then does sound begin. Pause lifts the needle.
2. **Spin state = playback state.** The disc never spins while paused,
   exactly like a real turntable. `prefers-reduced-motion` disables the
   spin and the arm transition entirely.
3. **No decoration that isn't hardware.** Every non-functional-looking
   element (label spindle hole, counterweight, brass bezel ring) is
   part of the turntable metaphor; there are no gradient blobs or
   glassmorphism cards.
4. **Quiet transport.** Prev/next buttons are outlined, smaller than
   play, and hidden entirely for a single track — the scrubber and play
   button stay dominant, matching how often each control is used.

### Imagery & the gradient rule
Mirrors storytime's cover approach: paste a base64 data URI into
`TRACKLIST[n].coverImage` and it becomes the disc face (round-cropped,
spinning with the record). Empty → the brass-label vinyl shows instead,
so the demo looks finished out of the box.

Two **gradient veils** keep any photography atmospheric instead of
distracting — the same "type/light does the work, not decoration"
stance as storytime:

- **Cover shade** (`.cover-shade`) — sits over album art on the disc:
  a faint diagonal sheen plus a dark rim vignette (`transparent 34% →
  rgba(16,13,10,0.88) 100%`), so a bright photo still reads as a record
  with depth. Strength: `--cover-shade`, default 0.55. The shade spins
  *with* the disc so the vignette never wobbles against the art.
- **Backdrop veil** (`.backdrop-veil`) — for a full-page background
  image (`TRACKLIST[n].backdropImage`): a brass-tinged radial tint plus
  a near-opaque warm-black linear wash, scaled by `--veil`
  (per-track `shade`, default 0.72). The image stays legible as a
  scene but never competes with the plinth, type, or controls.

Rule of thumb: **the player is the subject; imagery is the room.**
If you can hum the background photo, the veil is too light.

### Navigation UI
Play/pause is the only large control; scrubbing works by pointer events
with pointer capture (mouse + touch unified), and keyboard users get
`Space` for play/pause and `←`/`→` for ±5s seek. Prev/next appear only
when the tracklist has more than one entry, with a small `X / Y` counter
beneath — the same "present enough to discover, quiet enough to forget"
stance as storytime's page controls.

### The CLI as part of the design
`music-player.py` (mirroring storytime.py) and the optional `music-player-cli`
Node command exist so the artifact stays hand-made even when generated:
they only *fill in* the `TRACKLIST` data and optionally retheme the
`:root` palette tokens inside `template.html` — they never touch the
engine, the layout, or the type. One template, one marker
(`__TRACKLIST__`), so every generated file shares the exact same design
and any visual improvement lands in every future build at once.

Palettes cycle the same tokens storytime.py cycles: each is a complete
room — background browns/blues/greens/burgundies, brass hardware color,
cream text — never a single accent swap. The gradient veils (`--veil`,
`--cover-shade`) are palette tokens too, so imagery dimming is part of
the theme, not a per-file afterthought.
