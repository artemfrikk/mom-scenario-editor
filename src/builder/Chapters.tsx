// A campaign's chapters: switching between them, and where each chapter's endings lead.

import { useBuilder } from '../build/store';
import type { Project } from '../build/project';

const chapterName = (c: Project, i: number) => c.chapterTitle?.trim() || `Глава ${i + 1}`;

// Above the steps: the chapters of the campaign, or the button that makes one.
export function ChapterBar() {
  const chapters = useBuilder((s) => s.chapters);
  const here = useBuilder((s) => s.chapter);
  const project = useBuilder((s) => s.project);
  const { goChapter, addChapter, removeChapter } = useBuilder.getState();
  if (chapters.length < 2)
    return (
      <button className="chapter-add ghost" onClick={addChapter} title="Кампания: несколько сценариев подряд. Предметы и решения переходят в следующую главу.">
        📚 <span className="lbl">Добавить главу</span>
      </button>
    );
  return (
    <div className="chapters">
      <span className="hint lbl">Кампания</span>
      {chapters.map((c, i) => (
        <button key={c.chapter ?? i} className={'chapter' + (i === here ? ' active' : '')} onClick={() => goChapter(i)} title={chapterName(i === here ? project : c, i)}>
          <span className="step-num">{i + 1}</span>
          <span className="lbl">{chapterName(i === here ? project : c, i)}</span>
        </button>
      ))}
      <div className="row">
        <button className="ghost" onClick={addChapter} title="Новая глава">
          + <span className="lbl">глава</span>
        </button>
        {here > 0 && (
          <button
            className="ghost danger auto"
            title="Удалить эту главу"
            onClick={() => confirm(`Удалить «${chapterName(project, here)}»? Всё в этой главе пропадёт.`) && removeChapter(here)}
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

// In the endings step: what comes after this chapter ends in a win or a loss.
export function NextChapter({ how }: { how: 'win' | 'lose' }) {
  const chapters = useBuilder((s) => s.chapters);
  const here = useBuilder((s) => s.chapter);
  const p = useBuilder((s) => s.project);
  if (chapters.length < 2) return null;
  const value = p.next?.[how] ?? '';
  return (
    <label className="field next-chapter">
      <span className="hint">{how === 'win' ? 'После победы' : 'После поражения'}</span>
      <select
        value={value}
        onChange={(e) => useBuilder.getState().change((q) => ({ ...q, next: { ...q.next, [how]: e.target.value || undefined } }))}
      >
        <option value="">конец кампании</option>
        {chapters.map((c, i) =>
          i === here ? null : (
            <option key={c.chapter} value={c.chapter}>
              → {chapterName(c, i)}
            </option>
          ),
        )}
      </select>
    </label>
  );
}
