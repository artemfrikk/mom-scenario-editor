import { useEffect, useState } from 'react';
import { canSaveToFolder, chooseFolder, forgetFolder, savedFolder, writeToFolder } from '../folderSave';

// "Save to the Valkyrie folder": the first click asks for the folder, later clicks just save.
export function FolderSave({ getBlob, fileName, onDone }: { getBlob: () => Promise<Blob>; fileName: string; onDone: (message: string) => void }) {
  const [dir, setDir] = useState<FileSystemDirectoryHandle | undefined>();
  useEffect(() => {
    void savedFolder().then(setDir);
  }, []);
  if (!canSaveToFolder()) return null;

  const run = async (change: boolean) => {
    try {
      let target = change ? undefined : dir;
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
      onDone('Не удалось записать в папку: ' + (e as Error).message + '. Выберите её заново.');
    }
  };

  return (
    <>
      <button
        onClick={() => run(false)}
        title={dir ? `Сохранить файл прямо в папку «${dir.name}»` : 'Выберите папку один раз, дальше файл будет сохраняться в неё сам'}
      >
        📁 {dir ? `В «${dir.name}»` : 'В папку Valkyrie…'}
      </button>
      {dir && (
        <button className="ghost" onClick={() => run(true)} title="Выбрать другую папку">
          ⋯
        </button>
      )}
    </>
  );
}
