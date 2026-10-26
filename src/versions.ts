// A history of earlier states of the scenario, kept in the browser (IndexedDB).
// Automatic snapshots are taken now and then while the person works; they can also name one by hand.

import { get, set } from 'idb-keyval';
import type { Scenario } from './format/scenario';
import { useStore, type Layout } from './store';

export interface Version {
  id: string;
  at: number;
  label: string;
  auto: boolean;
  scenario: Scenario; // without assets: restoring keeps the current ones
  layout: Layout;
  notes: string;
  facts: Record<string, string>;
}

const KEY = 'mse-versions';
const MAX_AUTO = 40;
const MAX_ALL = 70;

export async function listVersions(): Promise<Version[]> {
  try {
    return (await get<Version[]>(KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function addVersion(snap: Omit<Version, 'id' | 'at' | 'auto' | 'label'>, label: string, auto: boolean): Promise<Version[]> {
  const all = await listVersions();
  const v: Version = { ...snap, scenario: { ...snap.scenario, assets: {} }, id: String(Date.now()) + Math.random().toString(36).slice(2, 6), at: Date.now(), label, auto };
  let next = [v, ...all];
  // Old automatic snapshots go first when the list is full; named ones stay.
  let autos = next.filter((x) => x.auto);
  while (autos.length > MAX_AUTO || next.length > MAX_ALL) {
    const oldest = autos[autos.length - 1];
    if (!oldest) break;
    next = next.filter((x) => x.id !== oldest.id);
    autos = autos.slice(0, -1);
  }
  try {
    await set(KEY, next);
  } catch {
    // storage full or blocked: history is a convenience
  }
  return next;
}

export async function removeVersion(id: string): Promise<Version[]> {
  const next = (await listVersions()).filter((v) => v.id !== id);
  await set(KEY, next).catch(() => {});
  return next;
}

export function summary(v: Pick<Version, 'scenario'>): string {
  const c = v.scenario.components;
  const n = (t: string) => c.filter((x) => x.type === t).length;
  return `событий ${n('Event')}, комнат ${n('Tile')}, жетонов ${n('Token')}, монстров ${n('Spawn')}`;
}

export function snapshotNow(label: string, auto: boolean) {
  const { scenario, layout, notes, facts } = useStore.getState();
  return addVersion({ scenario, layout, notes, facts }, label, auto);
}
