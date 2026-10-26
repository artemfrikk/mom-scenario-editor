import { create } from 'zustand';

// Simple mode hides the fields a beginner does not need. Remembered per browser.
const KEY = 'mse-simple';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'full';
  } catch {
    return true;
  }
}

export const useSimple = create<{ simple: boolean; toggle: () => void }>((set, get) => ({
  simple: read(),
  toggle: () => {
    const simple = !get().simple;
    try {
      localStorage.setItem(KEY, simple ? 'simple' : 'full');
    } catch {
      // remembering is optional
    }
    set({ simple });
  },
}));
