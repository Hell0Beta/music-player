#!/usr/bin/env node
/*
  music-player CLI

  Builds a self-contained record-player HTML file from media files.

  Usage:
    music-player-cli --name "Song" --artist "Artist" --audio song.mp3 \
                     [--img background.png] [--cover cover.jpg] \
                     [--shade 0.6] [--out player.html]

  All options:
    --name    Track title (required)
    --artist  Artist name            (default: "Unknown Artist")
    --audio   Audio file, m4a|mp3|wav|ogg  (required)
    --img     Full-page background image; a dimming gradient veil is
              laid over it so it doesn't distract (optional)
    --cover   Album art for the spinning disc (optional)
    --shade   Backdrop dimming, 0..1 (default 0.72)
    --palette Palette index 0..3 (default 0):
                0 brass & mahogany · 1 blue hour
                2 emerald lounge  · 3 burgundy booth
    --out     Output HTML path (default: <music-player folder>/<slug>.html)
    --open    Open the generated file in the default browser

  Install as a global command:  npm link   (run inside the music-player folder)
*/

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const DEFAULT_SHADE = 0.72;

// Same palettes as music-player.py: each sets the :root tokens in
// template.html (room background, groove/brass hardware, text colors,
// and the gradient veil strengths) so imagery dimming themes with it.
const PALETTES = [
  {  // 0: brass & mahogany (default)
    '--bg-1': '#1b140f',
    '--bg-2': '#241b14',
    '--vinyl': '#100d0a',
    '--groove': '#2a2119',
    '--brass': '#c79a4b',
    '--brass-light': '#e6c789',
    '--cream': '#f2e9d8',
    '--muted': '#a9998c',
    '--veil': '0.72',
    '--cover-shade': '0.55'
  },
  {  // 1: blue hour
    '--bg-1': '#10141f',
    '--bg-2': '#161c2c',
    '--vinyl': '#0a0d16',
    '--groove': '#1c2438',
    '--brass': '#5b84c4',
    '--brass-light': '#9db8e2',
    '--cream': '#e8ecf5',
    '--muted': '#8b96ad',
    '--veil': '0.72',
    '--cover-shade': '0.55'
  },
  {  // 2: emerald lounge
    '--bg-1': '#0f1712',
    '--bg-2': '#15211a',
    '--vinyl': '#0a100c',
    '--groove': '#1e2c22',
    '--brass': '#4fa07a',
    '--brass-light': '#93c9ab',
    '--cream': '#e9f2ec',
    '--muted': '#8aa394',
    '--veil': '0.72',
    '--cover-shade': '0.55'
  },
  {  // 3: burgundy booth
    '--bg-1': '#1c1013',
    '--bg-2': '#26181c',
    '--vinyl': '#120a0d',
    '--groove': '#2c1d22',
    '--brass': '#c4576a',
    '--brass-light': '#e29aa6',
    '--cream': '#f5eaec',
    '--muted': '#ad8d94',
    '--veil': '0.72',
    '--cover-shade': '0.55'
  }
];

const MIME = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.aac': 'audio/aac',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon'
};

const AUDIOS = Object.keys(MIME).filter(k => MIME[k].startsWith('audio/'));

function die(msg) {
  console.error('music-player: ' + msg);
  process.exit(1);
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) die(`unexpected argument "${a}"`);
    const eq = a.indexOf('=');
    let key, val;
    if (eq !== -1) { key = a.slice(2, eq); val = a.slice(eq + 1); }
    else {
      key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { val = next; i++; }
      else val = true;
    }
    flags[key] = val;
  }
  return flags;
}

function readB64(file, label) {
  if (!file || file === true) die(`${label} requires a file path`);
  const p = path.resolve(file);
  if (!fs.existsSync(p)) die(`${label} file not found: ${p}`);
  const ext = path.extname(p).toLowerCase();
  const mime = MIME[ext];
  if (!mime) die(`unsupported ${label} extension "${ext}" for ${p}`);
  const data = fs.readFileSync(p).toString('base64');
  return `data:${mime};base64,${data}`;
}

function slugify(name) {
  return String(name).toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'track';
}

function applyPalette(html, palette) {
  for (const key of Object.keys(palette)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(' + escaped + '):\\s*[^;]+;');
    html = html.replace(re, (m, k) => k + ': ' + palette[key] + ';');
  }
  return html;
}

function openInBrowser(file) {
  const p = path.resolve(file);
  const cmdLine = process.platform === 'win32' ? 'cmd.exe'
    : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', p] : [p];
  execFile(cmdLine, args, () => {});
}

function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help || flags.h) {
    console.log(fs.readFileSync(path.join(__dirname, 'cli-usage.txt'), 'utf8'));
    return;
  }

  if (flags.version || flags.v) {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    console.log('music-player-cli ' + pkg.version);
    return;
  }

  const name = typeof flags.name === 'string' ? flags.name.trim() : '';
  if (!name) die('missing required --name "Track title"');
  const audio = typeof flags.audio === 'string' ? flags.audio : '';
  if (!audio) die('missing required --audio <file>');

  const artist = typeof flags.artist === 'string' ? flags.artist : 'Unknown Artist';
  const shadeRaw = flags.shade;
  let shade = DEFAULT_SHADE;
  if (typeof shadeRaw === 'string' && shadeRaw !== '') {
    shade = Number(shadeRaw);
    if (!isFinite(shade) || shade < 0 || shade > 1) {
      die('--shade must be a number between 0 and 1');
    }
  } else if (shadeRaw === true) {
    die('--shade requires a number between 0 and 1');
  }

  const paletteRaw = flags.palette;
  let paletteIndex = 0;
  if (paletteRaw !== undefined && paletteRaw !== true && paletteRaw !== '') {
    paletteIndex = Number(paletteRaw);
    if (!Number.isInteger(paletteIndex) || paletteIndex < 0 || paletteIndex >= PALETTES.length) {
      die(`--palette must be an integer between 0 and ${PALETTES.length - 1}`);
    }
  } else if (paletteRaw === true || paletteRaw === '') {
    die(`--palette requires a number between 0 and ${PALETTES.length - 1}`);
  }
  const palette = PALETTES[paletteIndex];

  const audioSrc = readB64(audio, '--audio');
  const coverImage = flags.cover ? readB64(flags.cover, '--cover') : '';

  // --img is the full-page backdrop (dimmed by a gradient veil)
  const backdropImage = flags.img ? readB64(flags.img, '--img') : '';
  if (flags.img === true) die('--img requires a file path');
  if (flags.cover === true) die('--cover requires a file path');

  const tracks = [{
    title: name,
    artist,
    audioSrc,
    coverImage,
    backdropImage,
    shade
  }];

  const marker = '/* __TRACKLIST__ */';
  let template;
  try {
    template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  } catch (e) {
    die(`template.html not found next to cli.js (${TEMPLATE_PATH})`);
  }
  if (!template.includes(marker)) die('template.html is missing the __TRACKLIST__ marker');

  const json = JSON.stringify(tracks, null, 2)
    .split('\n')
    .map((line, idx) => (idx === 0 ? line : '  ' + line))
    .join('\n');

  const out = applyPalette(template.replace(marker, 'const TRACKLIST = ' + json + ';'), palette);
  const outPath = path.resolve(typeof flags.out === 'string' && flags.out
    ? flags.out : path.join(__dirname, slugify(name) + '.html'));
  fs.writeFileSync(outPath, out);

  const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`✔ Created ${outPath} (${mb} MB)`);
  console.log(`  Track:   "${name}" — ${artist}`);
  if (backdropImage) console.log('  Backdrop: yes (gradient veil applied)');
  if (coverImage) console.log('  Cover art: yes (vignette shade applied)');
  console.log(`  Palette:  ${paletteIndex} (${['brass & mahogany', 'blue hour', 'emerald lounge', 'burgundy booth'][paletteIndex]})`);
  console.log('  Open it in any browser — no server needed.');

  if (flags.open) openInBrowser(outPath);
}

main();
