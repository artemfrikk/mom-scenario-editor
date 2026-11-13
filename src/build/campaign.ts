// A campaign: several chapters in one .valkyrie file. The first chapter is the scenario Valkyrie lists;
// every other chapter lies in its own folder (ch2/quest.ini...) and is opened by the button at the end of
// the chapter before (Valkyrie's StartQuestEvent: an event named after a file in the package). Variables
// starting with % live on from chapter to chapter, so the campaign marks are kept in them.

import { scenarioToFiles } from '../format/valkyrie';
import type { Scenario } from '../format/scenario';
import { compile } from './compile';
import { PROJECT_FILE, newProject, type Assets, type Project } from './project';

// Files a chapter uses: its pictures, sounds and puzzle pictures.
export function usedAssets(p: Project): Set<string> {
  return new Set(
    [p.cover, p.prologue.image, p.prologue.music, ...p.pieces.map((x) => x.outcome.sound ?? ''), ...p.pieces.map((x) => x.outcome.puzzle?.image ?? '')].filter(Boolean),
  );
}

const pick = (assets: Assets, names: Set<string>): Assets => Object.fromEntries(Object.entries(assets).filter(([k]) => names.has(k)));

export function compileCampaign(chapters: Project[], assets: Assets): Scenario {
  const [first, ...rest] = chapters;
  // a scenario made elsewhere keeps every file it came with
  const all = first.raw ? assets : pick(assets, new Set(chapters.flatMap((c) => [...usedAssets(c)])));
  const root = compile({ ...first, chapter: rest.length ? 'ch1' : first.chapter, campaign: rest.length ? rest : undefined }, all);
  for (const c of rest) {
    const files = scenarioToFiles(compile({ ...c, campaign: undefined }, pick(assets, usedAssets(c))));
    delete files[PROJECT_FILE];
    for (const [name, data] of Object.entries(files)) root.assets[`${c.chapter}/${name}`] = data;
  }
  return root;
}

// The chapters kept in a saved project, first one first.
export function chaptersOf(p: Project): Project[] {
  const { campaign, ...first } = p;
  return [{ ...first, chapter: first.chapter ?? 'ch1' }, ...(campaign ?? []).map((c) => ({ ...newProject(), ...c }))];
}

// A new chapter: an empty scenario with the next free id.
export function newChapter(chapters: Project[]): Project {
  const n = Math.max(1, ...chapters.map((c) => Number((c.chapter ?? 'ch1').slice(2)) || 1)) + 1;
  return { ...newProject(), chapter: 'ch' + n, chapterTitle: `Глава ${chapters.length + 1}`, title: chapters[0]?.title ?? '' };
}
