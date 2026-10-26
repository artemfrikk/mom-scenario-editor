import { assetUrl } from '../assets';
import { hasIntro, readIntro, removeIntro, setIntro, startEvent } from '../model/intro';
import { getText } from '../model/ops';
import { useStore } from '../store';
import { Field } from './widgets';

// The opening screen of the scenario in three fields: a picture, the story and the button's name.
export function IntroCard() {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const change = useStore((st) => st.change);
  const flash = useStore((st) => st.flash);
  const on = hasIntro(s);
  const intro = readIntro(s, lang);
  const url = assetUrl(s, intro.image);

  if (!startEvent(s)) return null;
  if (!on) {
    return (
      <div className="card">
        <b>📜 Вступление</b>
        <div className="hint" style={{ margin: '6px 0 10px' }}>
          Экран перед началом игры: картинка, история и кнопка «Продолжить». Так выглядят вступления в настоящих сценариях.
        </div>
        <button className="primary" onClick={() => change((sc) => setIntro(sc, lang, { text: getText(sc, lang, 'quest.description'), button: 'Продолжить', image: '' }))}>
          Создать вступление
        </button>
      </div>
    );
  }

  const set = (patch: Partial<typeof intro>, key: string) => change((sc) => setIntro(sc, lang, { ...readIntro(sc, lang), ...patch }), key);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    const name = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const bytes = new Uint8Array(await file.arrayBuffer());
    change((sc) => setIntro({ ...sc, assets: { ...sc.assets, [name]: bytes } }, lang, { ...readIntro(sc, lang), image: name }));
    flash('Картинка добавлена. Она сохранится внутри файла сценария.');
  };

  return (
    <div className="card">
      <b>📜 Вступление</b>
      <Field label="История" hint="Это прочтут игроки до начала игры.">
        <textarea rows={8} value={intro.text} onChange={(e) => set({ text: e.target.value }, 'intro:text')} />
      </Field>
      <Field label="Надпись на кнопке">
        <input value={intro.button} onChange={(e) => set({ button: e.target.value }, 'intro:button')} />
      </Field>
      <Field label="Картинка" hint="Она встанет слева от текста.">
        {url && <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: 140, display: 'block', marginBottom: 6, borderRadius: 6 }} />}
        <div className="row">
          <label className="btn-label">
            {intro.image ? 'Заменить картинку…' : 'Выбрать картинку…'}
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {intro.image && (
            <button className="ghost" onClick={() => set({ image: '' }, 'intro:image')}>
              Убрать
            </button>
          )}
        </div>
      </Field>
      <button className="small ghost danger" onClick={() => change((sc) => removeIntro(sc))}>
        Удалить вступление
      </button>
    </div>
  );
}
