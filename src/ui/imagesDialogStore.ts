import { create } from 'zustand';

interface DialogState {
  open: boolean;
  dismissed: boolean; // closed by the person once; do not pop up again on its own
  show: () => void;
  hide: () => void;
}

export const useImagesDialog = create<DialogState>((set) => ({
  open: false,
  dismissed: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false, dismissed: true }),
}));

