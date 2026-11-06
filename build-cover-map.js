// build-cover-map.js — GitHub Action builds cover-map.json from OCR on the covers images
const fs = require('fs');
const Tesseract = require('tesseract.js');

const COVERS_REPO = 'timmysmathwork/covers';
const UGS_REPO   = 'bubbls/ugs-singlefile';
const OUTPUT     = 'cover-map.json';
const LIMIT      = parseInt(process.env.LIMIT || '0') || Infinity;

async function jget(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'cover-matcher' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}
async function tryBranch(repo, branches = ['main', 'master']) {
  for (const b of branches) {
    try {
      const data = await jget(`https://api.github.com/repos/${repo}/git/trees/${b}?recursive=1`);
      if (data.tree) return { branch: b, tree: data.tree };
    } catch (e) {}
  }
  throw new Error(`No valid branch found for ${repo}`);
}
function prettyName(raw) {
  if (!raw) return 'Untitled';
  return raw
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ').trim();
}
function normalize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function trigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
  return set;
}
function similarity(ocrText, gameName) {
  const o = normalize(ocrText), g = normalize(gameName);
  if (!o || !g) return 0;
  if (o === g) return 1.0;
  if (o.includes(g) || g.includes(o)) return 0.9;
  const a = trigrams(o), b = trigrams(g);
  let overlap = 0;
  for (const t of a) if (b.has(t)) overlap++;
  return overlap / Math.max(a.size, b.size, 1);
}

async function main() {
  console.log('Fetching UGS game list…');
  const ugs = await tryBranch(UGS_REPO);
  const gameNames = ugs.tree
    .filter(i => i.type === 'blob')
    .map(i => i.path.split('/').pop())
    .filter(n => /^cl.*\.html$/i.test(n))
    .map(n => prettyName(n.replace(/^cl/i, '').replace(/\.html$/i, '')));
  console.log(`  → ${gameNames.length} games`);

  console.log('Fetching covers file list…');
  const cov = await tryBranch(COVERS_REPO);
  const coverFiles = cov.tree
    .filter(i => i.type === 'blob')
    .map(i => i.path)
    .filter(p => /\.(png|jpe?g|webp|gif)$/i.test(p))
    .slice(0, LIMIT);
  console.log(`  → ${coverFiles.length} covers (limit: ${LIMIT === Infinity ? 'none' : LIMIT})`);

  const gameIndex = gameNames.map(name => ({ name, norm: normalize(name) }));
  const map = {};
  let done = 0;

  for (const file of coverFiles) {
    done++;
    const url = `https://raw.githubusercontent.com/${COVERS_REPO}/${cov.branch}/${file}`;
    process.stdout.write(`[${done}/${coverFiles.length}] ${file} … `);
    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const { data: { text } } = await Tesseract.recognize(buf, 'eng', { logger: () => {} });
      const cleaned = text.replace(/\s+/g, ' ').trim();

      let bestGame = null, bestScore = 0;
      for (const g of gameIndex) {
        const s = similarity(cleaned, g.name);
        if (s > bestScore) { bestScore = s; bestGame = g.name; }
      }

      if (bestScore >= 0.55 && bestGame) {
        map[file] = { game: bestGame, score: +bestScore.toFixed(2) };
        console.log(`→ "${bestGame}" (${bestScore.toFixed(2)})`);
      } else {
        console.log(`— no match`);
      }
    } catch (e) {
      console.log(`— error: ${e.message}`);
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(map, null, 2));
  console.log(`\n✅ ${Object.keys(map).length} covers matched → ${OUTPUT}`);
}

main().catch(e => { console.error('❌', e); process.exit(1); });
