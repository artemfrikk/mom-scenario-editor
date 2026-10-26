import { useEffect, useState } from 'react';
import { canSaveToFolder, chooseFolder, forgetFolder, savedFolder, writeToFolder } from '../folderSave';

// "Save to the Valkyrie folder": the first click asks for the folder, later clicks just save.
export function FolderSave({ getBlob, fileName, onDone }: { getBlob: () => Promise<Blob>; fileName: string; onDone: (message: string) => void }) {
  const [dir, setDir] = useState<FileSystemDirectoryHandle | undefined>();
  const [explain, setExplain] = useState(false);
  useEffect(() => {
    void savedFolder().then(setDir);
  }, []);
  if (!canSaveToFolder()) return null;

  const run = async (change: boolean) => {
    try {
      let target = change ? undefined : dir;
      setExplain(false);
      if (!target) {
        const chosen = await chooseFolder();
        if (!chosen) return;
        target = chosen;
        setDir(chosen);
      }
      const ok = await writeToFolder(target, fileName, await getBlob());
      onDone(ok ? `Сохранено в папку «${target.name}»: ${fileName}` : 'Браузер не разрешил запись в эту папку.');
    } catch (e) {
      await forgetFolder();
      setDir(undefined);
      onDone('Не удалось записать в папку: ' + (e as Error).message + '. Нажмите «Сохранить .valkyrie» и положите файл в папку Download вручную.');
    }
  };

  return (
    <>
      <button
        onClick={() => (dir ? void run(false) : setExplain(true))}
        title={dir ? `Сохранить файл прямо в папку «${dir.name}»` : 'Выберите папку один раз, дальше файл будет сохраняться в неё сам'}
      >
        📁 {dir ? `В «${dir.name}»` : 'В папку Valkyrie…'}
      </button>
      {dir && (
        <button className="ghost" onClick={() => run(true)} title="Выбрать другую папку">
          ⋯
        </button>
      )}
      {explain && (
        <div className="modal-backdrop" onClick={() => setExplain(false)}>
          <div className="modal" role="dialog" aria-label="Папка для сценариев" onClick={(e) => e.stopPropagation()}>
            <h2>Куда сохранять сценарии</h2>
            <p>
              Valkyrie сама подхватывает файлы .valkyrie из папки <b>Download</b> внутри своей папки с данными. Обычно это:
            </p>
            <div className="path">
              <code>C:\Users\ваше имя\AppData\Roaming\Valkyrie\Download</code>
            </div>
            <p className="hint">
              Выберите эту папку один раз, дальше кнопка будет сохранять файл прямо туда. После сохранения перезайдите в список сценариев
              Valkyrie. Если браузер не пускает в папку AppData, пользуйтесь кнопкой «Сохранить .valkyrie» и кладите файл в Download вручную.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="primary" onClick={() => void run(false)}>
                Выбрать папку
              </button>
              <button className="ghost auto" onClick={() => setExplain(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
