// The atmosphere helper in the room panel and the "what happens" window:
// first lines that suit the place, the game's sounds for it, and a request for a chat assistant.

import { useState } from 'react';
import { helpPrompt, moodOf, parseVariants } from '../build/mood';
import type { Piece, Project } from '../build/project';
import { soundName } from './names';
import { Dialog } from './WhatHappens';

export function MoodIdeas({ tile, onPick }: { tile: string; onPick: (text: string) => void }) {
  const mood = moodOf(tile);
  return (
    <div className="mood-ideas">
      <span className="hint">✨ Идеи для места «{mood.name}»:</span>
      {mood.drafts.map((d) => (
        <button key={d} className="chip" title="Вставить" onClick={() => onPick(d)}>
          {d}
        </button>
      ))}
    </div>
  );
}

export function SoundIdeas({ tile, onSound, onMusic }: { tile: string; onSound: (id: string) => void; onMusic: (id: string) => void }) {
  const mood = moodOf(tile);
  return (
    <div className="mood-ideas row-wrap">
      <span className="hint">Подходит месту «{mood.name}»:</span>
      {mood.sounds.map((s) => (
        <button key={s} className="chip small" onClick={() => onSound(s)}>
          🔊 {soundName(s)}
        </button>
      ))}
      <button className="chip small" onClick={() => onMusic(mood.music)}>
        🎵 {soundName(mood.music)}
      </button>
    </div>
  );
}

// "Помочь с текстом": copy a request to ChatGPT or Claude, paste the answer, take a variant.
export function HelpWithText({ p, room, piece, current, onPick }: { p: Project; room?: string; piece?: Piece; current: string; onPick: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [copied, setCopied] = useState(false);
  const prompt = open ? helpPrompt(p, piece ? { kind: 'piece', piece } : { kind: 'room', room }, current) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const variants = answer.trim() ? parseVariants(answer) : [];
  return (
    <>
      <button className="link" onClick={() => setOpen(true)} title="Запрос для ChatGPT, Claude или другого чат-ассистента">
        🤖 Помочь с текстом
      </button>
      {open && (
        <Dialog title="Помочь с текстом" icon="🤖" onClose={() => setOpen(false)}>
          <p className="hint">Редактор готовит запрос со всем, что уже есть в сценарии. Вставьте его в ChatGPT, Claude или другой чат, а ответ скопируйте сюда. Ключи и сервер не нужны.</p>
          <label className="field">
            <span>1. Запрос</span>
            <textarea rows={8} readOnly value={prompt} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="row">
            <button className="auto primary" onClick={copy}>
              {copied ? '✓ Скопировано' : '📋 Скопировать запрос'}
            </button>
            <a className="auto" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
              Открыть ChatGPT
            </a>
            <a className="auto" href="https://claude.ai/new" target="_blank" rel="noreferrer">
              Открыть Claude
            </a>
          </div>
          <label className="field" style={{ marginTop: 12 }}>
            <span>2. Ответ ассистента</span>
            <textarea rows={5} value={answer} placeholder="Вставьте ответ целиком: «1. …», «2. …», «3. …»" onChange={(e) => setAnswer(e.target.value)} />
          </label>
          {variants.length > 0 && (
            <div className="field">
              <span>3. Выберите вариант</span>
              {variants.map((v, i) => (
                <div key={i} className="variant">
                  <div>{v}</div>
                  <button
                    className="auto small"
                    onClick={() => {
                      onPick(v);
                      setOpen(false);
                      setAnswer('');
                    }}
                  >
                    Взять
                  </button>
                </div>
              ))}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
