import { useEffect, useState } from 'react';
import { listVersions, removeVersion, snapshotNow, summary, type Version } from '../versions';
import { useStore } from '../store';

function when(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return 'сегодня ' + time;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ' ' + time;
}

export function VersionsDialog({ onClose }: { onClose: () => void }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [label, setLabel] = useState('');
  const restore = useStore((st) => st.restore);
  const flash = useStore((st) => st.flash);

  useEffect(() => {
    void listVersions().then(setVersions);
  }, []);

  const back = async (v: Version) => {
    await snapshotNow('Перед возвратом к «' + (v.label || when(v.at)) + '»', true);
    const assets = useStore.getState().scenario.assets;
    restore({ scenario: { ...v.scenario, assets }, layout: v.layout, notes: v.notes, facts: v.facts });
    flash('Вернул версию от ' + when(v.at) + '. Прежнее состояние тоже сохранено в списке.');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal versions" role="dialog" aria-label="Версии сценария" onClick={(e) => e.stopPropagation()}>
        <h2>Версии сценария</h2>
        <p className="hint">Редактор сам запоминает состояние сценария во время работы. Версии хранятся в этом браузере. Можно вернуться к любой, текущее состояние при этом тоже сохранится.</p>
        <div className="row">
          <input value={label} placeholder="Название версии, например «До правки концовки»" onChange={(e) => setLabel(e.target.value)} />
          <button
            className="auto primary"
            onClick={async () => {
              setVersions(await snapshotNow(label.trim() || 'Моя версия', false));
              setLabel('');
            }}
          >
            Запомнить сейчас
          </button>
        </div>
        <div className="version-list">
          {versions.length === 0 && <div className="hint">Пока пусто. Первая версия появится через несколько минут работы.</div>}
          {versions.map((v) => (
            <div className="version" key={v.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{v.label || (v.auto ? 'Автоматически' : 'Версия')}</b>
                <div className="hint">
                  {when(v.at)} · {summary(v)}
                </div>
              </div>
              <button className="small" onClick={() => void back(v)}>
                Вернуть
              </button>
              <button className="small ghost danger" title="Удалить из списка" onClick={async () => setVersions(await removeVersion(v.id))}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <span className="auto" />
          <button className="ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
