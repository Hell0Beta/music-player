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

  const out = template.replace(marker, 'const TRACKLIST = ' + json + ';');
  const outPath = path.resolve(typeof flags.out === 'string' && flags.out
    ? flags.out : path.join(__dirname, slugify(name) + '.html'));
  fs.writeFileSync(outPath, out);

  const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`✔ Created ${outPath} (${mb} MB)`);
  console.log(`  Track:   "${name}" — ${artist}`);
  if (backdropImage) console.log('  Backdrop: yes (gradient veil applied)');
  if (coverImage) console.log('  Cover art: yes (vignette shade applied)');
  console.log('  Open it in any browser — no server needed.');

  if (flags.open) openInBrowser(outPath);
}

main();
