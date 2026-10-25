// Builds src/content/catalog.json (ids of MoM tiles, monsters, items, tokens, audio)
// from a Valkyrie checkout: node scripts/build-catalog.mjs <path-to-valkyrie>
// Only ids and traits are taken; images belong to FFG and are not copied.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('usage: node scripts/build-catalog.mjs <path-to-valkyrie>');
const dir = join(root, 'unity/Assets/StreamingAssets/content/MoM');

const PACKS = {
  base: 'Базовая игра (Mansions of Madness 2nd ed.)',
  btt: 'Beyond the Threshold',
  hj: 'Horrific Journeys',
  pots: 'Path of the Serpent',
  soa: 'Streets of Arkham',
  sot: 'Sanctum of Twilight',
  rn: 'Recurring Nightmares',
  sm: 'Suppressed Memories',
  ck: 'Conversion Kit',
};

function parseIni(text) {
  const out = {};
  let cur = null;
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l[0] === ';' || l[0] === '#') continue;
    if (l[0] === '[') { cur = out[l.slice(1, -1)] = {}; continue; }
    if (!cur) continue;
    const i = l.indexOf('=');
    if (i === -1) cur[l] = ''; else cur[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return out;
}

function prettyName(id, name, prefixes) {
  const m = /\{ffg:([A-Z0-9_]+)\}/.exec(name ?? '');
  let s = m ? m[1] : id;
  if (m) {
    s = s.replace(/_MAD\d+$/, '');
    for (const p of prefixes) if (s.startsWith(p)) s = s.slice(p.length);
    return s.split('_').filter(Boolean).map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
  }
  for (const p of prefixes) if (s.startsWith(p)) s = s.slice(p.length);
  return s.replace(/([a-z])([A-Z0-9])/g, '$1 $2');
}

const traits = (t) => (t ?? '').split(/\s+/).filter(Boolean);
const catalog = { packs: [], tiles: [], monsters: [], items: [], tokens: [], audio: [] };

for (const pack of readdirSync(dir)) {
  const p = join(dir, pack);
  if (!existsSync(join(p, 'content_pack.ini'))) continue;
  const cp = parseIni(readFileSync(join(p, 'content_pack.ini'), 'utf8')).ContentPack ?? {};
  catalog.packs.push({ id: cp.id ?? pack, folder: pack, name: PACKS[pack] ?? pack, kind: cp.type ?? 'box' });
  const read = (f) => (existsSync(join(p, f)) ? parseIni(readFileSync(join(p, f), 'utf8')) : {});
  const packId = cp.id ?? pack;

  for (const [id, d] of Object.entries(read('tiles.ini'))) {
    catalog.tiles.push({
      id, pack: packId, name: prettyName(id, d.name, ['TILE_', 'TileSide']), traits: traits(d.traits),
      reverse: d.reverse || undefined, image: d.image?.replace('{import}/', '') || undefined,
    });
  }
  for (const [id, d] of Object.entries(read('monsters.ini'))) {
    catalog.monsters.push({
      id, pack: packId, name: prettyName(id, d.name, ['MONSTER_', 'Monster']), traits: traits(d.traits),
      health: Number(d.health ?? 0), healthperhero: Number(d.healthperhero ?? 0),
    });
  }
  for (const [id, d] of Object.entries(read('items.ini'))) {
    catalog.items.push({
      id, pack: packId, name: prettyName(id, d.name, ['COMMON_ITEM_', 'UNIQUE_ITEM_', 'SPELL_', 'ItemCommon', 'ItemUnique', 'ItemSpell', 'Item']),
      traits: traits(d.traits),
    });
  }
  for (const [id] of Object.entries(read('tokens.ini'))) {
    catalog.tokens.push({ id, pack: packId, name: prettyName(id, '', ['Token']) });
  }
  for (const [id, d] of Object.entries(read('audio.ini'))) {
    catalog.audio.push({ id, traits: traits(d.traits) });
  }
}

writeFileSync(new URL('../src/content/catalog.json', import.meta.url), JSON.stringify(catalog, null, 1) + '\n');
console.log(Object.fromEntries(Object.entries(catalog).map(([k, v]) => [k, v.length])));
