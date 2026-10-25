import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import catalog from '../content/catalog.json';
import type { QComponent } from '../format/scenario';
import { addComponent, fmt, position, setText, SNAP_TILE, SNAP_TOKEN, SQUARE, updateData } from '../model/ops';
import { useStore } from '../store';
import { TILE_OPTIONS } from './options';
import { tokenIcon } from './labels';
import { Picker } from './widgets';

const tileById = new Map(catalog.tiles.map((t) => [t.id, t]));
const PX_PER_UNIT = 1024 / SQUARE; // Valkyrie MoM tile images: 1024 px per 3.5 units

interface View {
  x: number; // world coordinate at the left edge
  y: number; // world coordinate (screen-down) at the top edge
  scale: number; // pixels per world unit
}

function imageKey(path: string | undefined): string {
  return (path ?? '').split('/').pop()!.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

function fallbackSize(traits: string[]): [number, number] {
  if (traits.includes('big')) return [3 * SQUARE, 2 * SQUARE];
  if (traits.includes('medium')) return [2 * SQUARE, 2 * SQUARE];
  return [2 * SQUARE, SQUARE];
}

export function MapView() {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const selected = useStore((st) => st.selected);
  const select = useStore((st) => st.select);
  const change = useStore((st) => st.change);
  const images = useStore((st) => st.tileImages);
  const setImages = useStore((st) => st.setTileImages);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ x: -10, y: -10, scale: 28 });
  const [imgSize, setImgSize] = useState<Record<string, [number, number]>>({});
  const [addingTile, setAddingTile] = useState(false);
  const drag = useRef<
    | { kind: 'pan'; sx: number; sy: number; view: View }
    | { kind: 'move'; name: string; dx: number; dy: number; snap: number; moved: boolean }
    | null
  >(null);
  const [panning, setPanning] = useState(false);

  const pieces = useMemo(() => s.components.filter((c) => ['Tile', 'Token', 'Door', 'MPlace'].includes(c.type)), [s.components]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit everything into view once when the map opens.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || size.w < 50) return;
    fitted.current = true;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // Measure loaded tile images to draw them at their real size.
  useEffect(() => {
    for (const [key, url] of Object.entries(images)) {
      if (imgSize[key]) continue;
      const img = new Image();
      img.onload = () => setImgSize((m) => ({ ...m, [key]: [img.naturalWidth / PX_PER_UNIT, img.naturalHeight / PX_PER_UNIT] }));
      img.src = url;
    }
  }, [images, imgSize]);

  function tileGeom(c: QComponent) {
    const t = tileById.get(c.data.side ?? '');
    const key = imageKey(t?.image);
    const [w, h] = imgSize[key] ?? fallbackSize(t?.traits ?? []);
    return { t, key, w, h, url: images[key] };
  }

  function fit() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const c of pieces) {
      const p = position(c) ?? { x: 0, y: 0 };
      const ext = c.type === 'Tile' ? Math.max(tileGeom(c).w, tileGeom(c).h) : 1;
      minX = Math.min(minX, p.x - 1);
      minY = Math.min(minY, -p.y - 1);
      maxX = Math.max(maxX, p.x + ext);
      maxY = Math.max(maxY, -p.y + ext);
    }
    if (!isFinite(minX)) {
      minX = -10;
      minY = -10;
      maxX = 20;
      maxY = 20;
    }
    const scale = Math.min(size.w / (maxX - minX + 4), size.h / (maxY - minY + 4), 60);
    setView({ scale, x: (minX + maxX) / 2 - size.w / scale / 2, y: (minY + maxY) / 2 - size.h / scale / 2 });
  }

  const toWorld = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: view.x + (clientX - r.left) / view.scale, y: view.y + (clientY - r.top) / view.scale };
  };

  const onWheel = (e: React.WheelEvent) => {
    const w = toWorld(e.clientX, e.clientY);
    const scale = Math.min(200, Math.max(3, view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const r = svgRef.current!.getBoundingClientRect();
    setView({ scale, x: w.x - (e.clientX - r.left) / scale, y: w.y - (e.clientY - r.top) / scale });
  };

  const startPan = (e: RPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, view };
    setPanning(true);
  };

  const startMove = (e: RPointerEvent, c: QComponent) => {
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    select(c.name);
    const p = position(c) ?? { x: 0, y: 0 };
    const w = toWorld(e.clientX, e.clientY);
    drag.current = { kind: 'move', name: c.name, dx: w.x - p.x, dy: w.y + p.y, snap: c.type === 'Tile' ? SNAP_TILE : SNAP_TOKEN, moved: false };
  };

  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan') {
      setView({ ...d.view, x: d.view.x - (e.clientX - d.sx) / view.scale, y: d.view.y - (e.clientY - d.sy) / view.scale });
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    const snap = e.shiftKey ? 0 : d.snap;
    const round = (v: number) => (snap ? Math.round(v / snap) * snap : v);
    const x = round(w.x - d.dx);
    const y = round(-(w.y - d.dy));
    d.moved = true;
    change((sc) => updateData(sc, d.name, { xposition: fmt(x), yposition: fmt(y) }), 'move:' + d.name);
  };

  const endDrag = () => {
    drag.current = null;
    setPanning(false);
  };

  const rotateSelected = () => {
    const c = pieces.find((p) => p.name === selected);
    if (!c) return;
    const r = ((Number(c.data.rotation ?? 0) || 0) + 90) % (c.type === 'Door' ? 180 : 360);
    change((sc) => updateData(sc, c.name, { rotation: r ? String(r) : undefined }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') rotateSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const centerWorld = () => {
    const x = view.x + size.w / view.scale / 2;
    const y = -(view.y + size.h / view.scale / 2);
    return { x, y };
  };

  const create = (type: 'Tile' | 'Token' | 'Door' | 'MPlace', extra: Record<string, string> = {}) => {
    const p = centerWorld();
    const snap = type === 'Tile' ? SNAP_TILE : SNAP_TOKEN;
    const data = { xposition: fmt(Math.round(p.x / snap) * snap), yposition: fmt(Math.round(p.y / snap) * snap), ...extra };
    let created = '';
    change((sc) => {
      const [next, name] = addComponent(sc, type, data, type === 'Tile' ? (extra.side ?? '').replace(/^TileSide/, '') : '');
      created = name;
      if (type === 'Token' || type === 'Door') return setText(setText(next, lang, name + '.text', ''), lang, name + '.button1', 'Продолжить');
      return next;
    });
    select(created);
  };

  const loadImages = (files: FileList | null) => {
    if (!files) return;
    const map: Record<string, string> = { ...images };
    for (const f of Array.from(files)) {
      if (!/\.(png|jpe?g|webp)$/i.test(f.name)) continue;
      map[imageKey(f.name)] = URL.createObjectURL(f);
    }
    setImages(map);
  };

  const gridStep = SQUARE;
  const startX = Math.floor(view.x / gridStep) * gridStep;
  const startY = Math.floor(view.y / gridStep) * gridStep;
  const lines: React.ReactNode[] = [];
  if (view.scale * gridStep > 8) {
    for (let x = startX; x < view.x + size.w / view.scale; x += gridStep)
      lines.push(<line key={'x' + x} x1={x} x2={x} y1={view.y} y2={view.y + size.h / view.scale} stroke="#2a2531" strokeWidth={1 / view.scale} />);
    for (let y = startY; y < view.y + size.h / view.scale; y += gridStep)
      lines.push(<line key={'y' + y} y1={y} y2={y} x1={view.x} x2={view.x + size.w / view.scale} stroke="#2a2531" strokeWidth={1 / view.scale} />);
  }

  const shownOnBoard = new Set(s.components.flatMap((c) => (c.data.add ?? '').split(/\s+/).filter(Boolean)));
  const dim = (c: QComponent) => (shownOnBoard.has(c.name) ? undefined : 0.45);
  const tiles = pieces.filter((c) => c.type === 'Tile');
  const others = pieces.filter((c) => c.type !== 'Tile');
  const hasImages = Object.keys(images).length > 0;

  return (
    <>
      <div className="view-toolbar" style={{ maxWidth: 'calc(100% - 24px)' }}>
        {addingTile ? (
          <div style={{ width: 320 }}>
            <Picker
              options={TILE_OPTIONS}
              value=""
              autoFocus
              placeholder="Название тайла, например Hall"
              onChange={(v) => {
                create('Tile', { side: v });
                setAddingTile(false);
              }}
            />
          </div>
        ) : (
          <button onClick={() => setAddingTile(true)}>+ 🧱 Тайл</button>
        )}
        <button onClick={() => create('Token', { type: 'TokenSearch' })}>+ 🔍 Жетон</button>
        <button onClick={() => create('Door')}>+ 🚪 Дверь</button>
        <button onClick={() => create('MPlace')}>+ 📍 Место монстра</button>
        <button onClick={rotateSelected} disabled={!pieces.some((p) => p.name === selected)} title="Клавиша R">
          ⟳ Повернуть
        </button>
        <button onClick={fit}>Показать всё</button>
        <label className="chip" style={{ padding: '6px 10px', margin: 0 }} title="Папка MoM/import/img в папке данных Valkyrie">
          {hasImages ? '🖼 Картинки загружены' : '🖼 Картинки тайлов…'}
          <input
            type="file"
            multiple
            // @ts-expect-error non-standard but widely supported folder picker
            webkitdirectory=""
            style={{ display: 'none' }}
            onChange={(e) => loadImages(e.target.files)}
          />
        </label>
      </div>
      <svg
        ref={svgRef}
        className={'map-svg' + (panning ? ' panning' : '')}
        viewBox={`${view.x} ${view.y} ${size.w / view.scale} ${size.h / view.scale}`}
        onWheel={onWheel}
        onPointerDown={(e) => {
          if (e.target === svgRef.current || (e.target as Element).classList.contains('bg')) {
            select(null);
            startPan(e);
          }
        }}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <rect className="bg" x={view.x} y={view.y} width={size.w / view.scale} height={size.h / view.scale} fill="transparent" />
        {lines}
        <circle cx={0} cy={0} r={0.15} fill="var(--accent)" opacity={0.5} />
        {tiles.map((c) => {
          const p = position(c) ?? { x: 0, y: 0 };
          const g = tileGeom(c);
          const outside = g.t?.traits.includes('outside') && !g.t?.traits.includes('inside');
          const rot = Number(c.data.rotation ?? 0) || 0;
          return (
            <g
              key={c.name}
              className={'piece tile' + (outside ? ' outside' : '') + (c.name === selected ? ' sel' : '')}
              transform={`translate(${p.x} ${-p.y}) rotate(${-rot})`}
              opacity={dim(c)}
              onPointerDown={(e) => startMove(e, c)}
            >
              {g.url ? (
                <image href={g.url} width={g.w} height={g.h} preserveAspectRatio="none" />
              ) : (
                <rect width={g.w} height={g.h} rx={0.2} />
              )}
              {c.name === selected && <rect className="outline" width={g.w} height={g.h} />}
              {!g.url && (
                <text x={0.3} y={0.8}>
                  {g.t?.name ?? c.data.side ?? 'Тайл'}
                </text>
              )}
            </g>
          );
        })}
        {others.map((c) => {
          const p = position(c) ?? { x: 0, y: 0 };
          const rot = Number(c.data.rotation ?? 0) || 0;
          const sel = c.name === selected;
          if (c.type === 'Door') {
            return (
              <g key={c.name} className={'piece' + (sel ? ' sel' : '')} opacity={dim(c)} transform={`translate(${p.x} ${-p.y}) rotate(${-rot})`} onPointerDown={(e) => startMove(e, c)}>
                <rect x={-0.15} y={-0.9} width={0.3} height={1.8} fill="#b38750" stroke="#0009" strokeWidth={0.05} />
              </g>
            );
          }
          if (c.type === 'MPlace') {
            return (
              <g key={c.name} className={'piece tok' + (sel ? ' sel' : '')} opacity={dim(c)} transform={`translate(${p.x} ${-p.y})`} onPointerDown={(e) => startMove(e, c)}>
                <rect x={-0.8} y={-0.8} width={1.6} height={1.6} fill="#9e3f4a66" stroke="#9e3f4a" strokeWidth={0.06} strokeDasharray="0.2 0.1" />
                <text textAnchor="middle" y={0.3}>
                  📍
                </text>
              </g>
            );
          }
          return (
            <g key={c.name} className={'piece tok' + (sel ? ' sel' : '')} opacity={dim(c)} transform={`translate(${p.x} ${-p.y})`} onPointerDown={(e) => startMove(e, c)}>
              <circle r={0.7} fill="#3f7f8c" />
              <text textAnchor="middle" y={0.3}>
                {tokenIcon(c.data.type ?? '')}
              </text>
            </g>
          );
        })}
      </svg>
      {!hasImages && tiles.length > 0 && (
        <div className="hint" style={{ position: 'absolute', bottom: 12, left: 12, maxWidth: 420, background: 'var(--panel)', padding: 10, borderRadius: 8, border: '1px solid var(--line)' }}>
          Тайлы показаны примерными прямоугольниками. Чтобы увидеть настоящие картинки, нажмите «Картинки тайлов…» и выберите
          папку <b>MoM/import/img</b> в папке данных Valkyrie. Перетаскивайте предметы мышкой, Shift отключает привязку к сетке. Полупрозрачные объекты пока не показывает ни одно событие.
        </div>
      )}
    </>
  );
}
