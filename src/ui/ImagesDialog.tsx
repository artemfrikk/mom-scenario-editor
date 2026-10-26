import { useEffect, useRef, useState } from 'react';
import { canPickFolder, importPath, pickFolder, useImages, valkyrieRoot } from '../images';
import { useImagesDialog } from './imagesDialogStore';

const DEFAULT_PROGRAM = 'D:\\Valkyrie';
const programPath = (_root: string) => DEFAULT_PROGRAM + '\\Valkyrie_Data\\StreamingAssets\\content\\MoM';

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
  const hasTokens = useImages((s) => 'search_token' in s.urls);
  const open = useImagesDialog((s) => s.open);
  const dismissed = useImagesDialog((s) => s.dismissed);
  const hide = useImagesDialog((s) => s.hide);
  const show = useImagesDialog((s) => s.show);
  const before = useRef(status);
  const [copied, setCopied] = useState(false);
  const [root, setRoot] = useState(valkyrieRoot);
  const imgPath = importPath(root);
  const [otherChosen, setOther] = useState(false);
  const other = otherChosen || !canPickFolder() || !!error;

  const visible = open || (auto && status === 'none' && !dismissed);

  // Right after the import folder is read, offer the second step if the token icons are still missing.
  useEffect(() => {
    if (before.current === 'loading' && status === 'ready' && !hasTokens) show();
    before.current = status;
  }, [status, hasTokens, show]);

  // Close by itself once the pictures are in.
  useEffect(() => {
    if (status === 'ready' && hasTokens && open) useImagesDialog.setState({ open: false });
  }, [status, hasTokens, open]);

  if (!visible) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(imgPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be blocked; the path is on screen anyway
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-label="Подключение картинок игры">
        <h2>Подключите картинки и названия игры</h2>
        <p>
          Чтобы тайлы, монстры и предметы выглядели как в игре и назывались по-русски, редактору нужны картинки и тексты из вашей Valkyrie.
          Они никуда не загружаются: браузер сохраняет копию у себя, и в следующий раз спрашивать не придётся.
        </p>
        <ol>
          <li>Нажмите «Выбрать папку с картинками».</li>
          <li>
            В окне выбора вставьте в адресную строку путь к папке import и нажмите Enter, затем «Выбор папки». Папка Valkyrie
            может лежать в AppData (по умолчанию) или в той, которую вы выбрали сами, например D:\Valkyrie. Впишите сюда свою:
            <div className="path">
              <input value={root} onChange={(e) => setRoot(e.target.value)} aria-label="Папка Valkyrie" />
            </div>
            <div className="path">
              <code>{imgPath}</code>
              <button className="small" onClick={copy}>
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            <div className="hint">Нужна папка import внутри MoM: в ней лежат и картинки (img), и тексты (text). Можно выбрать и одну папку img: картинки загрузятся, но русских названий не будет.</div>
          </li>
        </ol>
        {status === 'ready' && !hasTokens && canPickFolder() && (
          <div className="hint" style={{ marginBottom: 10 }}>
            <b>Шаг 2: значки жетонов.</b> Они лежат не в import, а в самой программе Valkyrie. Нажмите кнопку ниже и выберите папку
            <code> {programPath(root)}</code> (если Valkyrie стоит не в {DEFAULT_PROGRAM}, найдите папку Valkyrie_Data\StreamingAssets\content\MoM
            там, где она установлена).
            <div className="row" style={{ marginTop: 8 }}>
              <button className="primary" onClick={() => void pickFolder('valkyrie-app')}>
                Выбрать папку со значками жетонов
              </button>
            </div>
          </div>
        )}
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
