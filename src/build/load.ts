// A .valkyrie file -> the constructor's project.
// A file the constructor saved carries its project in editor.json. A scenario made elsewhere is taken in
// as far as the constructor understands it (the card, the tiles); everything else is kept as it was
// and written back unchanged, so nothing is lost.

import type { Scenario } from '../format/scenario';
import { getText } from '../model/ops';
import { LANG } from './compile';
import { newProject, PROJECT_FILE, PROJECT_FORMAT, type Assets, type Project } from './project';

// card texts the constructor writes itself
const OWN_TEXTS = ['quest.name', 'quest.description', 'quest.authors', 'quest.synopsys'];
const GENERATED_EXTRA = [/^mse-/, /^editor\.json$/];

export function projectFromScenario(s: Scenario): { project: Project; assets: Assets; foreign: boolean } {
  const assets: Assets = {};
  for (const [k, v] of Object.entries(s.assets)) if (!GENERATED_EXTRA.some((re) => re.test(k))) assets[k] = v;
  const saved = s.assets[PROJECT_FILE];
  if (saved) {
    try {
      const project = { ...newProject(), ...JSON.parse(new TextDecoder().decode(saved)) } as Project;
      if (project.format <= PROJECT_FORMAT) return { project, assets, foreign: false };
    } catch {
      // a broken editor.json: read the scenario itself
    }
  }
  return { project: fromForeign(s), assets, foreign: true };
}

function fromForeign(s: Scenario): Project {
  const lang = texts(s);
  const t = (key: string) => getText(s, lang, key);
  // the scenario keeps its own rounds and mythos as they were
  const p: Project = { ...newProject(), mythos: undefined, timeline: [] };
  const q = s.quest;
  const rooms = s.components
    .filter((c) => c.type === 'Tile' && c.name.startsWith('Tile') && c.name.length > 4)
    .map((c) => ({
      id: c.name.slice(4),
      tile: c.data.side ?? '',
      x: Number(c.data.xposition ?? 0) || 0,
      y: Number(c.data.yposition ?? 0) || 0,
      rot: Number(c.data.rotation ?? 0) || 0,
      enterText: '',
    }));
  const kept = new Set(rooms.map((r) => 'Tile' + r.id));
  const quest = { ...q };
  for (const k of ['format', 'hidden', 'type', 'defaultmusicon', 'minhero', 'maxhero', 'difficulty', 'lengthmin', 'lengthmax', 'image']) delete quest[k];
  const rawTexts: Record<string, Record<string, string>> = {};
  for (const [l, entries] of Object.entries(s.texts)) {
    rawTexts[l] = {};
    for (const [k, v] of Object.entries(entries)) if (l !== LANG || !OWN_TEXTS.includes(k)) rawTexts[l][k] = v;
  }
  return {
    ...p,
    title: t('quest.name'),
    description: t('quest.description'),
    authors: t('quest.authors'),
    minHero: Number(q.minhero ?? 1) || 1,
    maxHero: Number(q.maxhero ?? 5) || 5,
    difficulty: Number(q.difficulty ?? 0.5) || 0.5,
    lengthMin: Number(q.lengthmin ?? 60) || 60,
    lengthMax: Number(q.lengthmax ?? 120) || 120,
    cover: q.image ?? '',
    rooms,
    raw: { components: s.components.filter((c) => !kept.has(c.name)), texts: rawTexts, quest },
  };
}

// The language to read the card in: Russian when there is one.
function texts(s: Scenario): string {
  if (s.texts[LANG]) return LANG;
  return s.quest.defaultlanguage || Object.keys(s.texts)[0] || LANG;
}
