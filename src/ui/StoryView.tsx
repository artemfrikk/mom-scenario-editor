import dagre from '@dagrejs/dagre';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnectEnd,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isEventLike, type ComponentType, type Scenario } from '../format/scenario';
import { addComponent, buttonLabel, buttonsOf, deleteComponent, getText, resolveText, setButtonTargets, setText } from '../model/ops';
import { useStore, type Layout } from '../store';
import { TRIGGER_LABEL, TYPE_ICON } from './labels';
import { MapView } from './MapView';
import { plainText } from './options';
import { TemplatesDialog } from './TemplatesDialog';
import { BLOCK_MIME, BlockPalette } from './BlockPalette';
import { defaultHook } from '../model/builder';
import { buildTemplate } from '../model/templates';

const TYPE_COLOR: Partial<Record<ComponentType, string>> = {
  Event: 'var(--event)',
  Token: 'var(--token)',
  Door: 'var(--door)',
  Spawn: 'var(--spawn)',
  UI: '#4d5a7a',
  Puzzle: '#7a4d72',
};

interface StoryData extends Record<string, unknown> {
  name: string;
  type: ComponentType;
  text: string;
  shown: boolean;
  trigger: string;
  buttons: { index: number; label: string; linked: boolean }[];
  onAdd: (name: string, index: number) => void;
  adds: number;
  remembers: number;
  conditional: boolean;
  selected: boolean;
}

// Double-click on a card writes its text right there; the inspector shows the same text.
function NodeText({ name, onDone }: { name: string; onDone: () => void }) {
  const lang = useStore((st) => st.lang);
  const value = useStore((st) => getText(st.scenario, st.lang, name + '.text'));
  const change = useStore((st) => st.change);
  return (
    <textarea
      className="nb-edit nodrag nopan nowheel"
      autoFocus
      rows={Math.min(10, Math.max(3, Math.ceil(value.length / 34) + 1))}
      value={value}
      placeholder="Что прочитают игроки…"
      onFocus={(e) => e.target.setSelectionRange(value.length, value.length)}
      onChange={(e) => change((sc) => setText(sc, lang, name + '.text', e.target.value), 'text:' + name + '.text')}
      onBlur={onDone}
      onKeyDown={(e) => {
        e.stopPropagation(); // Delete and R must not act on the card while typing
        if (e.key === 'Escape') onDone();
      }}
    />
  );
}

const StoryNode = memo(function StoryNode({ data }: NodeProps<Node<StoryData>>) {
  const icon = TYPE_ICON[data.type];
  const [editing, setEditing] = useState(false);
  return (
    <div className={'story-node' + (data.selected ? ' selected' : '')}>
      <Handle type="target" position={Position.Left} id="in" style={{ top: 16 }} />
      <div className="nh" style={{ background: TYPE_COLOR[data.type] ?? 'var(--panel-2)' }}>
        <span>{icon}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.name}</span>
        {data.trigger && <span className="trig">⚡ {TRIGGER_LABEL[data.trigger] ?? data.trigger}</span>}
      </div>
      {editing && data.shown ? (
        <NodeText name={data.name} onDone={() => setEditing(false)} />
      ) : (
        <div className={'nb' + (data.text ? '' : ' empty')} title={data.shown ? 'Двойной щелчок: написать текст здесь' : undefined} onDoubleClick={() => {
            if (!data.shown) return;
            useStore.getState().select(data.name);
            setEditing(true);
          }}>
          {data.shown ? data.text || 'Нет текста' : 'Скрытое событие (без окна)'}
        </div>
      )}
      {data.adds > 0 && <div className="nadd">🗺 показывает на карте: {data.adds}</div>}
      {data.remembers > 0 && <div className="nadd">🧠 запоминает: {data.remembers}</div>}
      {data.conditional && <div className="nadd">❓ срабатывает при условии</div>}
      {data.buttons.map((b) => (
        <div className="nbtn" key={b.index}>
          <span>{data.shown ? b.label || 'Продолжить' : 'Далее'}</span>
          {!b.linked && (
            <button
              className="nbtn-add nodrag nopan"
              title="Создать следующее событие для этой кнопки"
              onClick={(e) => {
                e.stopPropagation();
                data.onAdd(data.name, b.index);
              }}
            >
              + Далее
            </button>
          )}
          <Handle type="source" position={Position.Right} id={'b' + b.index} />
        </div>
      ))}
    </div>
  );
});

const nodeTypes = { story: StoryNode };


function autoLayout(s: Scenario, layout: Layout): Layout {
  const missing = s.components.filter((c) => isEventLike(c.type) && !layout[c.name]);
  if (!missing.length) return layout;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const c of s.components) {
    if (!isEventLike(c.type)) continue;
    g.setNode(c.name, { width: 240, height: 90 + buttonsOf(c).length * 26 });
  }
  for (const c of s.components) {
    if (!isEventLike(c.type)) continue;
    for (const b of buttonsOf(c)) for (const t of b.targets) if (g.hasNode(t)) g.setEdge(c.name, t);
  }
  dagre.layout(g);
  const out = { ...layout };
  for (const c of missing) {
    const n = g.node(c.name);
    if (n) out[c.name] = { x: n.x - n.width / 2, y: n.y - n.height / 2 };
  }
  return out;
}

function Story({ mapOpen, onToggleMap }: { mapOpen: boolean; onToggleMap: () => void }) {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const selected = useStore((st) => st.selected);
  const select = useStore((st) => st.select);
  const change = useStore((st) => st.change);
  const layout = useStore((st) => st.layout);
  const setLayout = useStore((st) => st.setLayout);
  const flow = useReactFlow();
  const [dragPos, setDragPos] = useState<Layout>({});
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [templates, setTemplates] = useState(false);
  const [palette, setPalette] = useState(true);
  const facts = useStore((st) => st.facts);
  const setFact = useStore((st) => st.setFact);
  const flash = useStore((st) => st.flash);

  // Delete / Backspace removes the chosen arrow, or the chosen block with everything that points to it.
  // Ctrl+Z brings it back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      if (selectedEdge) {
        const [source, index, target] = selectedEdge.split(':');
        change((sc) => {
          const c = sc.components.find((x) => x.name === source);
          const b = c && buttonsOf(c).find((x) => x.index === Number(index));
          return b ? setButtonTargets(sc, source, Number(index), b.targets.filter((t) => t !== target)) : sc;
        });
        setSelectedEdge(null);
        e.preventDefault();
      } else if (selected && s.components.some((c) => c.name === selected && isEventLike(c.type))) {
        e.preventDefault();
        change((sc) => deleteComponent(sc, selected));
        select(null);
        flash(`Удалено: ${selected}. Ctrl+Z возвращает обратно.`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, selectedEdge, s.components, change, select, flash]);

  // Give every new node a place once; later the user moves them by hand.
  useEffect(() => {
    const next = autoLayout(s, layout);
    if (next !== layout) setLayout(next, false);
  }, [s, layout, setLayout]);

  // Open on the start of the story at a readable zoom; small stories fit entirely.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !Object.keys(layout).length) return;
    framed.current = true;
    const events = s.components.filter((c) => isEventLike(c.type));
    const start = events.find((c) => c.data.trigger === 'EventStart') ?? events[0];
    setTimeout(() => {
      if (events.length <= 12 || !start || !layout[start.name]) flow.fitView({ maxZoom: 1 });
      else flow.setCenter(layout[start.name].x + 360, layout[start.name].y + 120, { zoom: 0.8 });
    }, 0);
  }, [layout, s.components, flow]);

  // The "+ Далее" button on a block: a new event, already linked to that button and placed to its right.
  const addNext = useCallback(
    (from: string, index: number) => {
      let created = '';
      change((sc) => {
        const [next, name] = addComponent(sc, 'Event');
        created = name;
        const c = next.components.find((x) => x.name === from);
        const b = c && buttonsOf(c).find((x) => x.index === index);
        let out = setText(next, lang, name + '.text', '');
        out = setText(out, lang, name + '.button1', 'Продолжить');
        return b ? setButtonTargets(out, from, index, [...b.targets, name]) : out;
      });
      const at = useStore.getState().layout[from];
      if (at) setLayout({ ...useStore.getState().layout, [created]: { x: at.x + 300, y: at.y + (index - 1) * 110 } });
      select(created);
    },
    [change, lang, select, setLayout],
  );

  const nodes: Node<StoryData>[] = useMemo(
    () =>
      s.components
        .filter((c) => isEventLike(c.type))
        .map((c) => {
          const shown = c.data.display !== 'false';
          return {
            id: c.name,
            type: 'story',
            position: dragPos[c.name] ?? layout[c.name] ?? { x: 0, y: 0 },
            data: {
              name: c.name,
              type: c.type,
              shown,
              text: plainText(resolveText(s, lang, getText(s, lang, c.name + '.text'))),
              trigger: c.data.trigger ?? '',
              buttons: buttonsOf(c).map((b) => ({ index: b.index, label: plainText(buttonLabel(s, lang, b), 60), linked: b.targets.length > 0 })),
              onAdd: addNext,
              adds: (c.data.add ?? '').split(/\s+/).filter(Boolean).length,
              remembers: (c.data.operations ?? '').split(/\s+/).filter(Boolean).length,
              conditional: !!c.data.vartests,
              selected: c.name === selected,
            },
          };
        }),
    [s, lang, layout, dragPos, selected, addNext],
  );

  const edges: Edge[] = useMemo(() => {
    const names = new Set(nodes.map((n) => n.id));
    const out: Edge[] = [];
    for (const c of s.components) {
      if (!isEventLike(c.type)) continue;
      for (const b of buttonsOf(c)) {
        for (const t of b.targets) {
          if (!names.has(t)) continue;
          out.push({
            id: `${c.name}:${b.index}:${t}`,
            source: c.name,
            sourceHandle: 'b' + b.index,
            target: t,
            targetHandle: 'in',
            animated: c.name === selected || t === selected,
            selected: `${c.name}:${b.index}:${t}` === selectedEdge,
            style: {
              stroke: `${c.name}:${b.index}:${t}` === selectedEdge ? 'var(--err)' : c.name === selected || t === selected ? 'var(--accent)' : '#7d7488',
              strokeWidth: `${c.name}:${b.index}:${t}` === selectedEdge ? 3 : 2,
            },
          });
        }
      }
    }
    return out;
  }, [s, nodes, selected, selectedEdge]);

  const link = useCallback(
    (source: string, handle: string, target: string) => {
      const index = Number(handle.substring(1));
      change((sc) => {
        const c = sc.components.find((x) => x.name === source);
        const b = c && buttonsOf(c).find((x) => x.index === index);
        if (!b || b.targets.includes(target)) return sc;
        return setButtonTargets(sc, source, index, [...b.targets, target]);
      });
    },
    [change],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      // Dropped on empty space: create the next event right there.
      if (state.isValid || !state.fromNode || !state.fromHandle?.id) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      const pos = flow.screenToFlowPosition({ x: point.clientX, y: point.clientY });
      let created = '';
      const from = state.fromNode.id;
      const handle = state.fromHandle.id;
      change((sc) => {
        const [next, name] = addComponent(sc, 'Event');
        created = name;
        const index = Number(handle.substring(1));
        const c = next.components.find((x) => x.name === from);
        const b = c && buttonsOf(c).find((x) => x.index === index);
        let out = setText(next, lang, name + '.text', '');
        out = setText(out, lang, name + '.button1', 'Продолжить');
        return b ? setButtonTargets(out, from, index, [...b.targets, name]) : out;
      });
      setLayout({ ...useStore.getState().layout, [created]: { x: pos.x, y: pos.y - 20 } });
      select(created);
    },
    [change, flow, lang, select, setLayout],
  );

  // A block from the constructor: built, hung on a free button and put on the canvas.
  const place = useCallback(
    (id: string, at?: { x: number; y: number }) => {
      const st = useStore.getState();
      const hook = defaultHook(st.scenario, lang, st.selected);
      let result: ReturnType<typeof buildTemplate> = null;
      change((sc) => {
        result = buildTemplate(sc, lang, id, hook && { event: hook.event, button: hook.button }, facts);
        return result ? result.scenario : sc;
      });
      const built = result as ReturnType<typeof buildTemplate>;
      if (!built) return;
      for (const [k, v] of Object.entries(built.facts)) setFact(k, v);
      // Keep the shape dagre gives the new chain, moved next to where it hangs (or where it was dropped).
      const now = useStore.getState().scenario;
      const full = autoLayout(now, {});
      const fresh = built.events.filter((n) => full[n] && isEventLike(now.components.find((c) => c.name === n)?.type ?? 'Tile'));
      const old = useStore.getState().layout;
      const base = at ?? (hook && old[hook.event] ? { x: old[hook.event].x + 300, y: old[hook.event].y } : flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));
      if (fresh.length) {
        const dx = base.x - full[fresh[0]].x;
        const dy = base.y - full[fresh[0]].y;
        const add: Layout = {};
        for (const n of fresh) add[n] = { x: full[n].x + dx, y: full[n].y + dy };
        setLayout({ ...old, ...add });
      }
      select(built.first);
      flash(hook ? `Добавлено и подключено к «${hook.event}». Замените тексты-заготовки на свои.` : 'Добавлено. Замените тексты-заготовки на свои.');
    },
    [change, facts, flash, flow, lang, select, setFact, setLayout],
  );

  const create = (type: ComponentType) => {
    const center = flow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    let created = '';
    change((sc) => {
      const data: Record<string, string> = type === 'Token' ? { type: 'TokenSearch', xposition: '0', yposition: '0' } : {};
      const [next, name] = addComponent(sc, type, data);
      created = name;
      return setText(setText(next, lang, name + '.text', ''), lang, name + '.button1', 'Продолжить');
    });
    setLayout({ ...useStore.getState().layout, [created]: center });
    select(created);
  };

  return (
    <div className={'story-root' + (palette ? ' with-palette' : '')}>
      <div className="view-toolbar">
        <button onClick={() => create('Event')}>+ {TYPE_ICON.Event} Событие</button>
        <button onClick={() => create('Token')}>+ {TYPE_ICON.Token} Жетон</button>
        <button onClick={() => create('Spawn')}>+ {TYPE_ICON.Spawn} Монстр</button>
        <button className={palette ? 'primary' : ''} onClick={() => setPalette(!palette)} title="Готовые блоки для сюжета">
          🧩 Конструктор
        </button>
        <button onClick={() => setTemplates(true)} title="Жетон с находкой, запертая дверь, засада, развилка, концовки">
          ✨ Заготовки
        </button>
        <button
          onClick={() => {
            setLayout(autoLayout(s, {}));
            setTimeout(() => flow.fitView({ duration: 300 }), 50);
          }}
          title="Расставить блоки автоматически"
        >
          Упорядочить
        </button>
        <button className={mapOpen ? 'primary' : ''} onClick={onToggleMap} title="Показать или скрыть карту рядом со схемой">
          🗺 Карта
        </button>
        <span className="hint tb-hint">Delete: удалить выбранное</span>
      </div>
      {palette && <BlockPalette onPlace={(id) => place(id)} onClose={() => setPalette(false)} />}
      <div
        className="flow-drop"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(BLOCK_MIME)) e.preventDefault();
        }}
        onDrop={(e) => {
          const id = e.dataTransfer.getData(BLOCK_MIME);
          if (!id) return;
          e.preventDefault();
          place(id, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
        }}
      >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => {
          setSelectedEdge(null);
          select(n.id);
        }}
        onEdgeClick={(_, e) => setSelectedEdge(e.id)}
        onPaneClick={() => {
          setSelectedEdge(null);
          select(null);
        }}
        onNodesChange={(changes) => {
          for (const ch of changes) {
            if (ch.type === 'position' && ch.position) {
              const p = ch.position;
              if (ch.dragging) setDragPos((d) => ({ ...d, [ch.id]: p }));
              else {
                setLayout({ ...useStore.getState().layout, [ch.id]: ch.position });
                setDragPos((d) => {
                  const { [ch.id]: _, ...rest } = d;
                  return rest;
                });
              }
            }
          }
        }}
        onConnect={(c) => c.sourceHandle && link(c.source, c.sourceHandle, c.target)}
        onConnectEnd={onConnectEnd}
        deleteKeyCode={null}
        minZoom={0.1}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="#2c2733" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(n) => TYPE_COLOR[(n.data as StoryData).type] ?? '#555'} maskColor="#0009" style={{ background: '#1e1b24' }} />
      </ReactFlow>
      </div>
      {templates && <TemplatesDialog onClose={() => setTemplates(false)} />}
      {nodes.length === 0 && (
        <div className="empty-state" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          Добавьте первое событие кнопкой «+ Событие».
        </div>
      )}
    </div>
  );
}

const SPLIT_KEY = 'mse-story-map';

function loadSplit(): { open: boolean; width: number } {
  try {
    const v = JSON.parse(localStorage.getItem(SPLIT_KEY) ?? '');
    return { open: v.open !== false, width: Math.max(260, Number(v.width) || 460) };
  } catch {
    return { open: true, width: 460 };
  }
}

// The story graph with the live map on its right: the divider drags, the map can be hidden.
export function StoryView() {
  const [split, setSplit] = useState(loadSplit);
  const box = useRef<HTMLDivElement>(null);
  const update = (next: { open: boolean; width: number }) => {
    setSplit(next);
    try {
      localStorage.setItem(SPLIT_KEY, JSON.stringify(next));
    } catch {
      // remembering the layout is optional
    }
  };

  const startDrag = (e: React.PointerEvent) => {
    const el = box.current;
    if (!el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const width = Math.min(rect.width - 320, Math.max(240, rect.right - ev.clientX));
      setSplit((sp) => ({ ...sp, width }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setSplit((sp) => {
        update(sp);
        return sp;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="split" ref={box}>
      <div className="split-left">
        <ReactFlowProvider>
          <Story mapOpen={split.open} onToggleMap={() => update({ ...split, open: !split.open })} />
        </ReactFlowProvider>
      </div>
      {split.open && (
        <>
          <div className="split-bar" onPointerDown={startDrag} title="Потяните, чтобы изменить размер" />
          <div className="split-right" style={{ width: split.width }}>
            <MapView embedded />
          </div>
        </>
      )}
    </div>
  );
}
