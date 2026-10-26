import { useEffect, useState, type ReactNode } from 'react';
import { canSaveToFolder, chooseFolder, forgetFolder, savedFolder } from '../folderSave';
import { canPickFolder, pickFolder, useImages } from '../images';
import { useSimple } from '../mode';
import { useStore } from '../store';
import { LANGUAGE_LABEL } from './labels';
import { useImagesDialog } from './imagesDialogStore';

const PROGRAM_PATH = 'D:\\Valkyrie\\Valkyrie_Data\\StreamingAssets\\content\\MoM';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="set-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

// One setting: what it is called, what it does in plain words, and the control.
function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-text">
        <b>{label}</b>
        <div className="hint">{hint}</div>
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

// Everything that is set once and not per scenario: how the editor looks, pictures of the game, the folder for saving.
export function SettingsDialog({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  const simple = useSimple((s) => s.simple);
  const toggleSimple = useSimple((s) => s.toggle);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const texts = useStore((s) => s.scenario.texts);
  const languages = Object.keys(texts);
  const status = useImages((s) => s.status);
  const count = useImages((s) => s.count);
  const found = useImages((s) => s.found);
  const error = useImages((s) => s.error);
  const hasTokens = useImages((s) => 'search_token' in s.urls);
  const names = useImages((s) => s.names);
  const named = Object.keys(names).length;
  const forget = useImages((s) => s.forget);
  const showImages = useImagesDialog((s) => s.show);
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | undefined>();
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    void savedFolder().then(setFolder);
  }, []);

  const pickSaveFolder = async () => {
    setSaveError('');
    try {
      const chosen = await chooseFolder();
      if (chosen) setFolder(chosen);
    } catch (e) {
      setSaveError('Браузер не разрешил выбрать эту папку: ' + (e as Error).message);
    }
  };

  const loading = status === 'loading';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal settings" role="dialog" aria-label="Настройки" onClick={(e) => e.stopPropagation()}>
        <h2>⚙ Настройки</h2>
        <p className="hint">Здесь то, что настраивается один раз для всего редактора, а не для отдельного сценария. Всё хранится только в вашем браузере.</p>

        <Section title="Внешний вид">
          <Row label="Режим редактора" hint="Простой прячет редкие поля, которые нужны не каждому сценарию. Полный показывает всё, что умеет Valkyrie. Сценарий от режима не меняется.">
            <div className="set-btns">
              <button className={simple ? 'primary' : ''} onClick={() => !simple && toggleSimple()}>
                Простой
              </button>
              <button className={!simple ? 'primary' : ''} onClick={() => simple && toggleSimple()}>
                Полный
              </button>
            </div>
          </Row>
          {languages.length > 1 && (
            <Row label="Язык текстов" hint="На каком языке вы сейчас пишете тексты сценария. В игре покажется язык, который выберет игрок.">
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_LABEL[l] ?? l}
                  </option>
                ))}
              </select>
            </Row>
          )}
          <Row label="Знакомство с редактором" hint="Короткий тур по основным кнопкам. Можно пройти ещё раз.">
            <button
              onClick={() => {
                onClose();
                onTour();
              }}
            >
              Показать тур
            </button>
          </Row>
        </Section>

        <Section title="Картинки игры">
          <p className="hint">
            Картинки и значки принадлежат создателям игры, поэтому в редактор они не встроены. Браузер копирует их с вашего компьютера к себе
            и никуда не отправляет.
          </p>
          <Row
            label={`Тайлы, монстры и предметы: ${status === 'ready' ? `подключено ${count}` : loading ? `копирую… ${found}` : 'не подключено'}`}
            hint={`Картинки и русские названия из папки import внутри MoM у Valkyrie (по умолчанию %APPDATA%\\Valkyrie\\MoM\\import). ${named ? 'Названия найдены.' : status === 'ready' ? 'Названий нет: выбирайте папку import целиком.' : ''}`}
          >
            <button className="primary" disabled={loading} onClick={() => (canPickFolder() ? void pickFolder() : showImages())}>
              {status === 'ready' ? 'Выбрать папку заново' : 'Подключить папку'}
            </button>
          </Row>
          <Row
            label={`Значки жетонов: ${hasTokens ? 'подключены' : 'не подключены'}`}
            hint={`Иконки жетонов лежат не в import, а в самой программе Valkyrie, например ${PROGRAM_PATH}. Выберите эту папку, и жетоны на карте станут как в игре.`}
          >
            <button className={hasTokens ? '' : 'primary'} disabled={loading || !canPickFolder()} onClick={() => void pickFolder('valkyrie-app')}>
              {hasTokens ? 'Выбрать папку заново' : 'Подключить значки'}
            </button>
          </Row>
          {error && <div className="error">{error}</div>}
          <Row label="Забыть картинки" hint="Удаляет копии картинок из браузера. Файлы на вашем компьютере не трогаются. Потом можно подключить заново.">
            <button disabled={loading || status !== 'ready'} onClick={() => confirm('Удалить копии картинок из браузера?') && void forget()}>
              Забыть
            </button>
          </Row>
          {!canPickFolder() && <p className="hint">Ваш браузер не умеет выбирать папки. Откройте редактор в Chrome или Edge, либо подключайте картинки через окно «Подключить картинки» на карте.</p>}
        </Section>

        {canSaveToFolder() && (
          <Section title="Сохранение">
            <Row
              label={`Папка для сценариев: ${folder ? folder.name : 'не выбрана'}`}
              hint="Если выбрать папку Download внутри папки Valkyrie, кнопка «В папку Valkyrie» будет класть готовый файл прямо туда, и сценарий сразу появится в игре."
            >
              <div className="set-btns">
                <button className={folder ? '' : 'primary'} onClick={() => void pickSaveFolder()}>
                  {folder ? 'Другая папка' : 'Выбрать папку'}
                </button>
                {folder && (
                  <button
                    onClick={() => {
                      void forgetFolder();
                      setFolder(undefined);
                    }}
                  >
                    Забыть
                  </button>
                )}
              </div>
            </Row>
            {saveError && <div className="error">{saveError}</div>}
          </Section>
        )}

        <div className="row" style={{ marginTop: 14 }}>
          <span className="auto" />
          <button className="primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
