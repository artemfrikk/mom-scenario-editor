import { useEffect, useState } from 'react';
import { canPickFolder, IMPORT_PATH_HINT, pickFolder, useImages } from '../images';
import { useImagesDialog } from './imagesDialogStore';

// The toolbar button that shows the state of the pictures and reopens the dialog.
export function ImagesButton() {
  const status = useImages((s) => s.status);
  const count = useImages((s) => s.count);
  const found = useImages((s) => s.found);
  const show = useImagesDialog((s) => s.show);
  if (status === 'loading') return <button disabled>🖼 Копирую картинки… {found}</button>;
  if (status === 'ready') {
    return (
      <button className="ghost" onClick={show} title="Картинки игры подключены. Нажмите, чтобы выбрать другую папку.">
        🖼 Картинки: {count}
      </button>
    );
  }
  return (
    <button onClick={show} title="Тайлы, монстры и предметы будут выглядеть как в игре">
      🖼 Подключить картинки
    </button>
  );
}

// `auto` asks for the pictures on its own the first time the map is opened.
export function ImagesDialog({ auto }: { auto: boolean }) {
  const status = useImages((s) => s.status);
  const found = useImages((s) => s.found);
  const error = useImages((s) => s.error);
  const fromFiles = useImages((s) => s.fromFiles);
  const open = useImagesDialog((s) => s.open);
  const dismissed = useImagesDialog((s) => s.dismissed);
  const hide = useImagesDialog((s) => s.hide);
  const [copied, setCopied] = useState(false);
  const [otherChosen, setOther] = useState(false);
  const other = otherChosen || !canPickFolder() || !!error;

  const visible = open || (auto && status === 'none' && !dismissed);

  // Close by itself once the pictures are in.
  useEffect(() => {
    if (status === 'ready' && open) useImagesDialog.setState({ open: false });
  }, [status, open]);

  if (!visible) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(IMPORT_PATH_HINT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked; the path is on screen anyway
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-label="Подключение картинок игры">
        <h2>Подключите картинки игры</h2>
        <p>
          Чтобы тайлы, монстры и предметы выглядели как в игре, редактору нужны картинки из вашей Valkyrie. Они никуда не загружаются:
          браузер сохраняет копию у себя, и в следующий раз спрашивать не придётся.
        </p>
        <ol>
          <li>Нажмите «Выбрать папку с картинками».</li>
          <li>
            В окне выбора вставьте в адресную строку этот путь и нажмите Enter, затем «Выбор папки»:
            <div className="path">
              <code>{IMPORT_PATH_HINT}</code>
              <button className="small" onClick={copy}>
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            <div className="hint">Это та же папка, что C:\Users\ваше имя\AppData\Roaming\Valkyrie\MoM\import\img</div>
          </li>
        </ol>
        {status === 'loading' && <div className="hint">Копирую картинки… найдено {found}</div>}
        {error && <div className="error">{error}</div>}
        <div className="row" style={{ marginTop: 14 }}>
          {canPickFolder() && (
            <button className="primary" disabled={status === 'loading'} onClick={() => void pickFolder()}>
              Выбрать папку с картинками
            </button>
          )}
          <button className="auto ghost" onClick={hide}>
            Не сейчас
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          {!other ? (
            <button className="small ghost" onClick={() => setOther(true)}>
              Не получается? Выбрать другим способом
            </button>
          ) : (
            <label className="chip" style={{ padding: '6px 10px' }}>
              {canPickFolder() ? 'Выбрать другим способом (обычное окно загрузки)' : 'Выбрать папку с картинками'}
              <input
                type="file"
                multiple
                // @ts-expect-error non-standard but supported by every major browser
                webkitdirectory=""
                style={{ display: 'none' }}
                onChange={(e) => e.target.files && void fromFiles(e.target.files)}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
