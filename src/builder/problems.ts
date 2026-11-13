import { useMemo } from 'react';
import { checkCampaign, checkProject, type Problem } from '../build/check';
import { useBuilder } from '../build/store';
import { tileTitle } from './names';

// What to fix in the chapter being edited, including what spans the campaign.
export function useProblems(): Problem[] {
  const p = useBuilder((s) => s.project);
  const chapters = useBuilder((s) => s.chapters);
  const here = useBuilder((s) => s.chapter);
  return useMemo(() => {
    const all = chapters.map((c, i) => (i === here ? p : c));
    return [...checkProject(p, tileTitle), ...checkCampaign(all, here)];
  }, [p, chapters, here]);
}
