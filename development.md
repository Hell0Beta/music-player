# Development.md — Audio-to-Record Player

## Intent

Turn an audio file into something that *feels* like playing a record:
a turntable object, a tonearm that swings on, a disc that spins only
while sound plays — all in a single portable HTML file, no build step,
no server, no dependencies beyond two Google Fonts.

The target output is a **demo** you can open directly in a browser
(`index.html`), which you then adapt with your own audio and, if you
have one, cover art.

## What's in this repo

| File | Purpose |
|---|---|
| `template.html` | The engine: markup, styles, and playback/scrubbing logic, with a `__TRACKLIST__` marker where track data goes. The single source of truth for the design. |
| `cli.js` | The `music-player-cli` Node command (optional alternative to the Python generator). Base64-encodes your media, fills the marker in `template.html`, writes a finished HTML file. |
| `package.json` | Exposes `cli.js` as the `music-player-cli` bin, with `music-player` as an alias (install with `npm link`). |
| `cli-usage.txt` | Help text shown by `music-player-cli --help`. |
| `index.html` | A generated player (built by the CLI from the template) — currently contains the demo track, viewable immediately. |
| `music-player.py` | The Python generator (mirrors storytime.py: argparse, palettes, slug-named output in the project folder). |
| `design.md` | Design rationale — palette, type, layout, gradient veils, and why. |
| `development.md` | This file. |

## How the player works

### 1. Data model
All record content lives in one JS array near the top of the `<script>`
tag:

```js
const TRACKLIST = [
  {
    title: "Midnight Drive",
    artist: "Unknown Artist",
    audioSrc: "",        // required base64 audio data URI
    coverImage: "",      // optional base64 image — album art on the disc
    backdropImage: "",   // optional base64 image — full-page background
    shade: 0.72          // optional backdrop dimming, 0..1
  },
  // ...more tracks
];
```

One entry per track. With a single entry the transport shows only
play/pause + scrubber; with two or more, prev/next buttons and an
`X / Y` counter appear, and `ended` auto-advances to the next track.

### 2. Audio embedding
A single HTML file can't reference an external audio file and stay
self-contained, so audio uses a **base64 data URI** pasted directly into
`audioSrc` — same approach storytime uses for cover photos. This keeps
audio + UI in one file you can email, host as a single static file, or
drop into any CMS text field.

Encoding from a terminal:

```bash
# macOS / Linux
base64 -w0 song.mp3 > song.b64        # -w0 disables line wrapping
base64 -i song.mp3 | pbcopy           # macOS: straight to clipboard

# Windows
certutil -encode song.mp3 song.txt    # delete the BEGIN/END lines first
```

Then paste as `audioSrc: "data:audio/mpeg;base64,<BASE64_STRING>"`.
Use the right MIME prefix for your format: `audio/mpeg` (mp3),
`audio/ogg` (ogg), `audio/wav` (wav), `audio/aac` (m4a).

**Size caveat:** base64 inflates files by ~33%, and browsers hold the
whole data URI in memory. Expect encoded file sizes over ~15–20 MB to
load slowly; for long-form audio, consider trimming or re-encoding to
mono/64–96 kbps first.

### 3. Imagery (cover art + backdrop)
Identical mechanics to storytime's `BOOK.coverImage`: base64-encode an
image and paste the data URI into `coverImage`. When set, the art is
round-cropped onto the disc and spins with it, under a **vignette
shade** (`.cover-shade`) that keeps bright photos from looking flat;
when empty, the CSS-only brass-label vinyl is shown.

`backdropImage` works the same way but renders as a full-page
background behind the player, dimmed by a **gradient veil**
(`.backdrop-veil`) whose strength is the track's `shade` value
(0 = clear, 1 = fully dark; default 0.72). This keeps any background
photo atmospheric instead of distracting.

### 4. Playback & scrubbing
- One `Audio` element created in JS; `preload="metadata"` so the
  duration is known before playback starts.
- The spinning disc, the tonearm angle, and the play/pause icon are all
  driven by a single `.is-playing` class toggled from the audio
  element's own `play` / `pause` / `ended` events — so the visuals can
  never drift out of sync with the sound, even after scrubbing or
  track changes.
- Scrubbing uses **pointer events with pointer capture**
  (`setPointerCapture`), which unifies mouse, touch, and pen and keeps
  the drag working when the cursor leaves the scrubber — replacing the
  separate mousemove/touchmove listeners of the original template.
- Keyboard: `Space` toggles play/pause, `←` / `→` seek ±5s.

## Generating a player from the terminal

Two equivalent generators exist, matching the storytime setup
(storytime has `storytime.py`; this project has both):

### Python (recommended, mirrors storytime.py)

```bash
python music-player.py \
  -a "C:/Users/User/Music/song.m4a" \
  -n "All I Want for Christmas Is You" \
  -A "Mariah Carey" \
  -i "background.png" \
  -c "cover.jpg" \
  -s 0.6 \
  -p 0 \
  --open
```

- `-a` (required): audio file, .m4a .mp3 .wav .ogg .aac
- `-n` / `-A`: title and artist; the title defaults to the filename
- `-i`: full-page background image — the gradient veil is applied
  automatically, dimmed by `-s` (0..1, default 0.72)
- `-c`: cover art for the spinning disc (vignette shade applied)
- `-p`: palette index 0–3 (brass/mahogany, blue hour, emerald lounge,
  burgundy booth)
- `--open`: opens the result in the browser

Output defaults to `<slug>.html` inside the music-player folder, same
convention as storytime.py. Only dependency: Python 3 itself.

### Node (zero-dependency alternative)

```bash
npm link   # one-time, inside the music-player folder
music-player-cli --name "Song" --artist "Artist" --audio song.mp3 \
             --img background.png --cover cover.jpg --shade 0.6 --out player.html
```

Both generators do exactly the same thing: base64-encode your media,
fill the `__TRACKLIST__` marker in `template.html`, and write a
finished single-file HTML player. Neither touches the engine, so the
design has exactly one source of truth.

## Adapting this for your real audio

**Via the CLI (recommended):** run the command above with your own
files — done.

**By hand:** open `template.html`, fill the `TRACKLIST` entries
(encode media to base64 yourself), and save the result as a new file.

More than one track? Add entries to `TRACKLIST` — prev/next controls
appear automatically. Open the file in a browser — no build tools
needed.

## Known limitations / things to improve next

- **No persistence**: playback always starts at track 1, position 0.
  `localStorage` could remember the last track/position, like storytime
  lists as a next step for a real deployment.
- **Data-URI size ceiling** (see above) — a future version could accept
  a plain URL in `audioSrc` as well, trading portability for size.
- **No volume control**: playback volume follows the system/browser
  volume; a small brass slider could be added to the transport row.
- **No continuous/loop mode**: `ended` advances to the next track and
  stops after the last one; a loop toggle would be a natural addition.
