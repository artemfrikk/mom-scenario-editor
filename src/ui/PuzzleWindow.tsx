import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { assetUrl } from '../assets';
import type { QComponent, Scenario } from '../format/scenario';
import { buttonLabel, buttonsOf } from '../model/ops';
import {
  codeFeedback,
  codeGuess,
  imageSwap,
  puzzleMoves,
  puzzleSolved,
  RINGS,
  slideMove,
  slideRange,
  towerMove,
  type CodeState,
  type ImageState,
  type PuzzleState,
  type SlideState,
  type TowerState,
} from '../model/puzzles';
import { plainText, previewHtml } from './options';

const SYMBOLS = ['▲', '●', '■', '◆', '★', '✚', '☾', '☀', '♣', '♥'];
const COLORS = ['#e0b04a', '#7fc4d6', '#d6735b', '#8fd68b', '#c59be0', '#e8dcc0', '#d6c35b', '#6fa0e0', '#9bd6b4', '#e07fa6'];

interface Props {
  s: Scenario;
  lang: string;
  puzzle: PuzzleState;
  component: QComponent;
  start: number; // moves already made when the window was opened
  onSet: (p: PuzzleState) => void;
  onClose: () => void;
  onFinish: () => void;
  onSolve: () => void;
}

// A puzzle table: the puzzle on the left, skill and move counters on the right, "Close" and the story's button below.
export function PuzzleWindow({ s, lang, puzzle, component, start, onSet, onClose, onFinish, onSolve }: Props) {
  const solved = puzzleSolved(puzzle);
  const button = buttonsOf(component)[0];
  const label = (button && plainText(buttonLabel(s, lang, button), 40)) || 'Готово';
  const total = puzzleMoves(puzzle);
  const title = { slide: 'Головоломка: выведите красный брусок', code: 'Головоломка: подберите код', image: 'Головоломка: соберите картинку', tower: 'Головоломка: башня' }[puzzle.kind];
  return (
    <div className="game-window puzzle-window" role="dialog" aria-label="Головоломка">
      <div className="game-title" title={component.name}>
        🧩 {title}
      </div>
      <div className="puzzle-body">
        <div className="puzzle-table">
          {puzzle.kind === 'slide' && <SlideBoard st={puzzle} onSet={onSet} />}
          {puzzle.kind === 'code' && <CodeBoard st={puzzle} onSet={onSet} />}
          {puzzle.kind === 'image' && <ImageBoard st={puzzle} onSet={onSet} src={assetUrl(s, component.data.image ?? '')} />}
          {puzzle.kind === 'tower' && <TowerBoard st={puzzle} onSet={onSet} />}
        </div>
        <div className="puzzle-side">
          <div className="hint">Проверка</div>
          <div className="puzzle-stat" dangerouslySetInnerHTML={{ __html: previewHtml(component.data.skill ?? '{observation}') }} />
          <div className="hint">{puzzle.kind === 'code' ? 'Попыток сейчас' : 'Ходов сейчас'}</div>
          <div className="puzzle-stat">{total - start}</div>
          <div className="hint">{puzzle.kind === 'code' ? 'Попыток всего' : 'Ходов всего'}</div>
          <div className="puzzle-stat">{total}</div>
        </div>
      </div>
      <div className="play-buttons">
        <button disabled={solved} title={solved ? 'Решённую головоломку закрыть нельзя, нажмите кнопку справа' : 'Отложить головоломку, её можно открыть снова'} onClick={onClose}>
          Закрыть
        </button>
        <button className="primary" disabled={!solved} title={solved ? '' : 'Кнопка станет активной, когда головоломка решена'} onClick={onFinish}>
          {label}
        </button>
        <button className="small ghost" onClick={onSolve} title="Для автора: пропустить игру и взять решённую головоломку">
          Решить за игроков
        </button>
      </div>
    </div>
  );
}

// --- slide ---------------------------------------------------------------------------------------

function SlideBoard({ st, onSet }: { st: SlideState; onSet: (p: PuzzleState) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ i: number; from: number; at: number; start: number } | null>(null);
  const toUnits = (e: RPointerEvent) => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  };
  const down = (e: RPointerEvent, i: number) => {
    const b = st.blocks[i];
    const u = toUnits(e);
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ i, from: b.rot ? b.y : b.x, at: b.rot ? b.y : b.x, start: b.rot ? u.y : u.x });
  };
  const move = (e: RPointerEvent) => {
    if (!drag) return;
    const u = toUnits(e);
    const { min, max } = slideRange(st.blocks, drag.i);
    const b = st.blocks[drag.i];
    const delta = (b.rot ? u.y : u.x) - drag.start;
    setDrag({ ...drag, at: Math.max(min, Math.min(max, Math.round(drag.from + delta))) });
  };
  const up = () => {
    if (drag) onSet(slideMove(st, drag.i, drag.at));
    setDrag(null);
  };
  return (
    <svg ref={svg} className="slide-board" viewBox="-0.3 -0.3 8.6 6.6" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <rect x={0} y={0} width={6} height={6} fill="#1b1612" stroke="#7a5c2c" strokeWidth={0.12} />
      <rect x={6} y={2} width={2} height={1} fill="#2a2216" stroke="#7a5c2c" strokeWidth={0.05} strokeDasharray="0.2" />
      <text x={7} y={2.62} textAnchor="middle" fontSize={0.5} fill="#7a5c2c">
        выход
      </text>
      {st.blocks.map((b, i) => {
        const at = drag?.i === i ? drag.at : b.rot ? b.y : b.x;
        const x = b.rot ? b.x : at;
        const y = b.rot ? at : b.y;
        return (
          <rect
            key={i}
            className={'slide-block' + (b.target ? ' target' : '')}
            x={x + 0.06}
            y={y + 0.06}
            width={b.xlen + 1 - 0.12}
            height={b.ylen + 1 - 0.12}
            rx={0.12}
            onPointerDown={(e) => down(e, i)}
          />
        );
      })}
    </svg>
  );
}

// --- code ----------------------------------------------------------------------------------------

function Sym({ n }: { n: number }) {
  return <span style={{ color: n > 0 ? COLORS[(n - 1) % COLORS.length] : '#8a7a60', fontSize: 22 }}>{n > 0 ? SYMBOLS[(n - 1) % SYMBOLS.length] : '?'}</span>;
}

function CodeBoard({ st, onSet }: { st: CodeState; onSet: (p: PuzzleState) => void }) {
  const [cur, setCur] = useState<number[]>(() => st.answer.map(() => 0));
  const ready = cur.every((n) => n > 0);
  return (
    <div className="code-board">
      <div className="code-rows">
        {st.guesses.map((g, k) => {
          const f = codeFeedback(st.answer, g);
          return (
            <div className="code-row" key={k}>
              {g.map((n, i) => (
                <Sym key={i} n={n} />
              ))}
              <span className="hint" title="● символ на своём месте, ○ символ есть, но не на своём месте">
                {'●'.repeat(f.spot)}
                {'○'.repeat(f.type)}
                {!f.spot && !f.type ? '—' : ''}
              </span>
            </div>
          );
        })}
        {!st.guesses.length && <div className="hint">Выберите символы и нажмите «Проверить». ● значит символ на своём месте, ○ значит символ есть, но не на своём месте.</div>}
      </div>
      <div className="code-row code-input">
        {cur.map((n, i) => (
          <button key={i} className="code-slot" onClick={() => setCur(cur.map((x, k) => (k === i ? (x % st.options) + 1 : x)))} title="Нажмите, чтобы сменить символ">
            <Sym n={n} />
          </button>
        ))}
        <button className="primary" disabled={!ready} onClick={() => onSet(codeGuess(st, cur))}>
          Проверить
        </button>
      </div>
    </div>
  );
}

// --- image ---------------------------------------------------------------------------------------

function ImageBoard({ st, onSet, src }: { st: ImageState; onSet: (p: PuzzleState) => void; src: string | undefined }) {
  const [picked, setPicked] = useState<number | null>(null);
  const click = (cell: number) => {
    if (picked === null) return setPicked(cell);
    if (picked !== cell) onSet(imageSwap(st, picked, cell));
    setPicked(null);
  };
  return (
    <div className="image-board" style={{ gridTemplateColumns: `repeat(${st.cols}, 1fr)`, aspectRatio: `${st.cols} / ${st.rows}` }}>
      {st.piece.map((p, cell) => {
        const col = p % st.cols;
        const row = Math.floor(p / st.cols);
        const style = src
          ? { backgroundImage: `url(${src})`, backgroundSize: `${st.cols * 100}% ${st.rows * 100}%`, backgroundPosition: `${st.cols > 1 ? (col / (st.cols - 1)) * 100 : 0}% ${st.rows > 1 ? (row / (st.rows - 1)) * 100 : 0}%` }
          : undefined;
        return (
          <button key={cell} className={'image-cell' + (picked === cell ? ' picked' : '') + (p === cell ? ' right' : '')} style={style} onClick={() => click(cell)} title="Нажмите на два кусочка, чтобы поменять их местами">
            {!src && p + 1}
          </button>
        );
      })}
    </div>
  );
}

// --- tower ---------------------------------------------------------------------------------------

function TowerBoard({ st, onSet }: { st: TowerState; onSet: (p: PuzzleState) => void }) {
  const [from, setFrom] = useState<number | null>(null);
  const click = (i: number) => {
    if (from === null) {
      if (st.towers[i].length) setFrom(i);
      return;
    }
    if (from !== i) onSet(towerMove(st, from, i));
    setFrom(null);
  };
  return (
    <div className="tower-board">
      {st.towers.map((t, i) => (
        <button key={i} className={'tower' + (from === i ? ' picked' : '')} onClick={() => click(i)} title="Нажмите на башню, чтобы взять верхнее кольцо, потом на другую, чтобы положить">
          <div className="tower-pole" />
          <div className="tower-rings">
            {[...t].reverse().map((size, k) => (
              <div key={k} className="ring" style={{ width: `${30 + (size / (RINGS - 1)) * 70}%`, background: COLORS[size % COLORS.length] }} />
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
