// The boxes this person owns. Only their rooms, monsters and tokens are offered. Remembered per browser.

import { create } from 'zustand';
import catalog from '../content/catalog.json';

const KEY = 'mse-owned-packs';
export const ALL_PACKS = catalog.packs.map((p) => p.id);

function read(): string[] | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as string[]) : null;
  } catch {
    return null;
  }
}

interface Owned {
  packs: string[];
  asked: boolean; // the person has chosen at least once
  set: (packs: string[]) => void;
}

const saved = read();

export const useOwned = create<Owned>((set) => ({
  packs: saved ?? ALL_PACKS,
  asked: !!saved,
  set: (packs) => {
    const list = ['MoMBase', ...packs.filter((p) => p !== 'MoMBase')];
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // remembering is optional
    }
    set({ packs: list, asked: true });
  },
}));

export const ownsPack = (owned: string[], pack: string | undefined) => !pack || owned.includes(pack);
