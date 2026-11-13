// Choosing a sound or a music track: one of the game's, or a file of the author's own.

import { useRef } from 'react';
import catalog from '../content/catalog.json';
import { useBuilder } from '../build/store';
import { Picker, type Option } from '../ui/widgets';
import { assetUrl } from './assetUrl';

const NOTE: Record<string, string> = {
  search: 'обыск',
  explore: 'дверь',
  attack: 'атака',
  horror: 'ужас',
  defeated: 'победа над монстром',
  newround: 'новый раунд',
};

// "AudioDoorCreak1" → "Door Creak 1"
const human = (id: string) =>
  id
    .replace(/^Audio/, '')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/(\d+)/, ' $1')
    .replace(/\s+/g, ' ')
    .trim();

const SOUNDS: Option[] = catalog.audio
  .filter((a) => !a.traits.includes('music') && !/Button|Click|Select|Deselect|UISlide|TestSound|SoftButton/.test(a.id))
  .map((a) => ({ value: a.id, label: human(a.id), note: a.traits.map((t) => NOTE[t]).find(Boolean) ?? 'звук игры' }));
const MUSIC: Option[] = catalog.audio.filter((a) => a.traits.includes('music')).map((a) => ({ value: a.id, label: human(a.id), note: 'музыка игры' }));

export function SoundPick({ value, onChange, music = false, label }: { value?: string; onChange: (v: string | undefined) => void; music?: boolean; label: string }) {
  const assets = useBuilder((s) => s.assets);
  const addAsset = useBuilder((s) => s.addAsset);
  const file = useRef<HTMLInputElement>(null);
  const own = value && assets[value] ? assetUrl(assets, value) : undefined;
  return (
    <div className="field sound-pick">
      <span className="hint">{label}</span>
      <div className="row">
        <Picker options={music ? MUSIC : SOUNDS} value={own ? '' : (value ?? '')} placeholder={own ? `Свой файл: ${value}` : music ? 'Музыка игры…' : 'Звук игры…'} onChange={(v) => onChange(v || undefined)} />
        <button className="auto" onClick={() => file.current?.click()} title="Свой файл .ogg, .mp3 или .wav">
          📁 Свой
        </button>
        {value && (
          <button className="auto ghost" title="Без звука" onClick={() => onChange(undefined)}>
            ✕
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept=".ogg,.wav,.mp3,audio/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onChange(addAsset(f.name, new Uint8Array(await f.arrayBuffer())));
          }}
        />
      </div>
      {own && <audio className="audio" controls src={own} />}
    </div>
  );
}
