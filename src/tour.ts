export const TOUR_KEY = 'mse-tour';

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === 'done';
  } catch {
    return true;
  }
}
