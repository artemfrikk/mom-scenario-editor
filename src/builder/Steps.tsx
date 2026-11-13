// The steps around the map: the scenario card, the prologue, the endings, the check and the play-through.

import { useEffect, useMemo, useRef } from 'react';
import catalog from '../content/catalog.json';
import type { Problem } from '../build/check';
import { useProblems } from './problems';
import { compile, LANG, usedPacks } from '../build/compile';
import { ALL_PACKS, useOwned } from '../build/owned';
import type { Project } from '../build/project';
import { useBuilder, type Step } from '../build/store';
import { useStore } from '../store';
import { GameView } from '../ui/GameView';
import { packName } from '../ui/options';
import { Picker } from '../ui/widgets';
import { Dialog } from './WhatHappens';
import { NextChapter } from './Chapters';
import { assetUrl } from './assetUrl';

function FileButton({ accept, label, onFile }: { accept: string; label: string; onFile: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const addAsset = useBuilder((s) => s.addAsset);
  return (
    <>
      <button onClick={() => ref.current?.click()}>{label}</button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          onFile(addAsset(f.name, new Uint8Array(await f.arrayBuffer())));
        }}
      />
    </>
  );
}

const set = (patch: Partial<Project>, key?: string) => useBuilder.getState().change((p) => ({ ...p, ...patch }), key);

export function CoverStep() {
  const p = useBuilder((s) => s.project);
  const assets = useBuilder((s) => s.assets);
  const cover = assetUrl(assets, p.cover);
  const packs = usedPacks(p);
  const chapters = useBuilder((s) => s.chapters.length);
  const here = useBuilder((s) => s.chapter);
  if (here > 0)
    return (
      <div className="page step-page">
        <h1>Глава {here + 1}</h1>
        <div className="lead">
          Следующая глава кампании. В списке Valkyrie её не видно: игроки попадают сюда кнопкой «Следующая глава» в финале прошлой главы. Сыщики, предметы и
          отметки «📜 Запомнить» переходят вместе с ними.
        </div>
        <label className="field">
          <span>Название главы</span>
          <input value={p.chapterTitle ?? ''} placeholder={`Глава ${here + 1}`} onChange={(e) => set({ chapterTitle: e.target.value }, 'chtitle')} autoFocus />
        </label>
        <div className="hint">Нужные коробки: {['Базовая игра', ...packs.map((x) => packName[x] ?? x)].join(', ')}.</div>
        <NextButton to="prologue" label="Дальше: вступление →" />
      </div>
    );
  return (
    <div className="page step-page">
      <h1>Обложка</h1>
      <div className="lead">Так сценарий будет выглядеть в списке Valkyrie.</div>
      {chapters > 1 && (
        <label className="field">
          <span>Название первой главы</span>
          <input value={p.chapterTitle ?? ''} placeholder="Глава 1" onChange={(e) => set({ chapterTitle: e.target.value }, 'chtitle')} />
        </label>
      )}
      <div className="cover-grid">
        <div>
          <label className="field">
            <span>Название</span>
            <input value={p.title} placeholder="Тени Инсмута" onChange={(e) => set({ title: e.target.value }, 'title')} autoFocus={!p.title} />
          </label>
          <label className="field">
            <span>Описание для списка сценариев</span>
            <textarea rows={4} value={p.description} placeholder="Пара фраз, которые заинтригуют игроков." onChange={(e) => set({ description: e.target.value }, 'desc')} />
          </label>
          <label className="field">
            <span>Автор</span>
            <input value={p.authors} onChange={(e) => set({ authors: e.target.value }, 'authors')} />
          </label>
          <div className="row">
            <label className="field">
              <span>Сыщиков: от</span>
              <input type="number" min={1} max={6} value={p.minHero} onChange={(e) => set({ minHero: Math.max(1, Math.min(p.maxHero, Number(e.target.value) || 1)) })} />
            </label>
            <label className="field">
              <span>до</span>
              <input type="number" min={1} max={6} value={p.maxHero} onChange={(e) => set({ maxHero: Math.max(p.minHero, Math.min(6, Number(e.target.value) || 5)) })} />
            </label>
            <label className="field">
              <span>Длительность, мин: от</span>
              <input type="number" min={15} step={15} value={p.lengthMin} onChange={(e) => set({ lengthMin: Math.max(15, Number(e.target.value) || 60) })} />
            </label>
            <label className="field">
              <span>до</span>
              <input type="number" min={15} step={15} value={p.lengthMax} onChange={(e) => set({ lengthMax: Math.max(p.lengthMin, Number(e.target.value) || 120) })} />
            </label>
          </div>
          <label className="field">
            <span>Сложность: {p.difficulty < 0.34 ? 'лёгкий' : p.difficulty < 0.67 ? 'средний' : 'тяжёлый'}</span>
            <input type="range" min={0.1} max={1} step={0.1} value={p.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) }, 'diff')} />
          </label>
          <div className="hint">
            Нужные коробки: {['Базовая игра', ...packs.map((x) => packName[x] ?? x)].join(', ')}. Редактор считает их сам по комнатам и монстрам на карте.
          </div>
        </div>
        <div className="cover-pic">
          {cover ? <img src={cover} alt="" /> : <div className="cover-empty">Картинка обложки</div>}
          <div className="row">
            <FileButton accept="image/png,image/jpeg" label={cover ? 'Заменить картинку' : 'Выбрать картинку'} onFile={(name) => set({ cover: name })} />
            {cover && (
              <button className="auto ghost" onClick={() => set({ cover: '' })}>
                ✕
              </button>
            )}
          </div>
          <div className="hint">PNG или JPG, лучше квадратная.</div>
        </div>
      </div>
      <NextButton to="prologue" label="Дальше: вступление →" />
    </div>
  );
}

const MUSIC = catalog.audio.filter((a) => a.traits.includes('music')).map((a) => ({ value: a.id, label: a.id.replace(/^Audio/, '').replace(/(\d+)/, ' $1'), note: 'музыка игры' }));

export function PrologueStep() {
  const p = useBuilder((s) => s.project);
  const assets = useBuilder((s) => s.assets);
  const foreign = !!p.raw;
  const img = assetUrl(assets, p.prologue.image);
  const own = assets[p.prologue.music] ? assetUrl(assets, p.prologue.music) : undefined;
  const setPro = (patch: Partial<Project['prologue']>, key?: string) => useBuilder.getState().change((q) => ({ ...q, prologue: { ...q.prologue, ...patch } }), key);
  if (foreign) {
    return (
      <div className="page step-page">
        <h1>Вступление</h1>
        <div className="lead">У этого сценария своё вступление, сделанное в другом редакторе. Оно сохранится без изменений.</div>
        <NextButton to="map" label="Дальше: карта →" />
      </div>
    );
  }
  return (
    <div className="page step-page">
      <h1>Вступление</h1>
      <div className="lead">С этого текста начинается игра. Расскажите, куда и зачем пришли сыщики.</div>
      <div className="cover-grid">
        <div>
          <label className="field">
            <span>Текст вступления</span>
            <textarea
              rows={10}
              value={p.prologue.text}
              placeholder="Сыщики оказываются на покосившемся причале. Воздух густ от тумана…"
              onChange={(e) => setPro({ text: e.target.value }, 'pro')}
            />
          </label>
          <label className="field">
            <span>Цель сыщиков (отдельный экран после вступления)</span>
            <textarea rows={3} value={p.goal} placeholder="Найдите пропавшего профессора и выясните, что случилось в доме." onChange={(e) => set({ goal: e.target.value }, 'goal')} />
          </label>
          <label className="field">
            <span>Музыка во время игры</span>
            <div className="row">
              <Picker options={MUSIC} value={own ? '' : p.prologue.music} placeholder={own ? `Своя: ${p.prologue.music}` : 'Музыка игры…'} onChange={(v) => setPro({ music: v })} />
              <FileButton accept=".ogg,.wav,.mp3,audio/*" label="Своя мелодия…" onFile={(name) => setPro({ music: name })} />
              {p.prologue.music && (
                <button className="auto ghost" onClick={() => setPro({ music: '' })}>
                  ✕
                </button>
              )}
            </div>
            {own && <audio src={own} controls className="audio" />}
            <div className="hint">Своя мелодия попадёт внутрь файла сценария. Valkyrie надёжнее всего играет .ogg.</div>
          </label>
        </div>
        <div className="cover-pic">
          {img ? <img src={img} alt="" /> : <div className="cover-empty">Картинка вступления</div>}
          <div className="row">
            <FileButton accept="image/png,image/jpeg" label={img ? 'Заменить' : 'Добавить картинку'} onFile={(name) => setPro({ image: name })} />
            {img && (
              <button className="auto ghost" onClick={() => setPro({ image: '' })}>
                ✕
              </button>
            )}
          </div>
          <div className="hint">С картинкой вступление покажется на отдельном экране: картинка слева, текст справа.</div>
        </div>
      </div>
      <NextButton to="map" label="Дальше: карта →" />
    </div>
  );
}

export function EndingsStep() {
  const p = useBuilder((s) => s.project);
  return (
    <div className="page step-page">
      <h1>Финалы</h1>
      <div className="lead">Победа наступает после того, что вы отметили значком 🏆. Поражение, когда все сыщики выбыли или вышло время (шаг «Угроза»).</div>
      <label className="field">
        <span>🏆 Победа</span>
        <textarea rows={4} value={p.winText} onChange={(e) => set({ winText: e.target.value }, 'win')} />
      </label>
      <NextChapter how="win" />
      <label className="field">
        <span>💀 Поражение</span>
        <textarea rows={4} value={p.loseText} onChange={(e) => set({ loseText: e.target.value }, 'lose')} />
      </label>
      <NextChapter how="lose" />
      <Problems />
      <NextButton to="play" label="Сыграть пробную партию →" />
    </div>
  );
}

export function Problems({ compact = false }: { compact?: boolean }) {
  const list = useProblems();
  const go = (pr: Problem) => {
    const st = useBuilder.getState();
    if (pr.step) st.setStep(pr.step);
    if (pr.piece) st.select({ kind: 'piece', id: pr.piece });
    else if (pr.room) st.select({ kind: 'room', id: pr.room });
  };
  if (!list.length) return compact ? null : <div className="card ok-card">✔ Всё в порядке: сценарий можно играть.</div>;
  return (
    <div className={'card problems' + (compact ? ' compact' : '')}>
      <b>{list.some((x) => x.level === 'error') ? 'Что мешает игре' : 'Стоит поправить'}</b>
      {list.map((pr, i) => (
        <button key={i} className={'problem ' + pr.level} onClick={() => go(pr)}>
          {pr.level === 'error' ? '⛔' : '⚠'} {pr.text}
        </button>
      ))}
    </div>
  );
}

export function PlayStep() {
  const p = useBuilder((s) => s.project);
  const assets = useBuilder((s) => s.assets);
  const scenario = useMemo(() => compile(p, assets), [p, assets]);
  const current = useStore((s) => s.scenario);
  // the play-through reads the compiled scenario from the game's store
  useEffect(() => {
    useStore.setState({ scenario, lang: LANG });
  }, [scenario]);
  return current === scenario ? <GameView /> : null;
}

export function OwnedDialog({ onClose }: { onClose: () => void }) {
  const packs = useOwned((s) => s.packs);
  const setPacks = useOwned((s) => s.set);
  return (
    <Dialog
      title="Мои коробки"
      icon="📦"
      onClose={() => {
        setPacks(packs); // closing counts as an answer, so the question is not asked again
        onClose();
      }}
    >
      <p className="hint">Отметьте, что у вас есть. В палитре останутся только эти комнаты, монстры и жетоны.</p>
      {catalog.packs.map((pk) => (
        <label key={pk.id} className="check">
          <input
            type="checkbox"
            disabled={pk.id === 'MoMBase'}
            checked={packs.includes(pk.id)}
            onChange={(e) => setPacks(e.target.checked ? [...packs, pk.id] : packs.filter((x) => x !== pk.id))}
          />
          {pk.name}
        </label>
      ))}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="auto" onClick={() => setPacks(ALL_PACKS)}>
          Отметить все
        </button>
      </div>
    </Dialog>
  );
}

function NextButton({ to, label }: { to: Step; label: string }) {
  const setStep = useBuilder((s) => s.setStep);
  return (
    <div className="next-row">
      <button className="primary" onClick={() => setStep(to)}>
        {label}
      </button>
    </div>
  );
}
