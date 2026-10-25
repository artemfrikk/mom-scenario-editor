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
import { addComponent, buttonLabel, buttonsOf, getText, resolveText, setButtonTargets, setText } from '../model/ops';
import { useStore, type Layout } from '../store';
import { TRIGGER_LABEL, TYPE_ICON } from './labels';
import { plainText } from './options';

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
  buttons: { index: number; label: string }[];
  adds: number;
  selected: boolean;
}

const StoryNode = memo(function StoryNode({ data }: NodeProps<Node<StoryData>>) {
  const icon = TYPE_ICON[data.type];
  return (
    <div className={'story-node' + (data.selected ? ' selected' : '')}>
      <Handle type="target" position={Position.Left} id="in" style={{ top: 16 }} />
      <div className="nh" style={{ background: TYPE_COLOR[data.type] ?? 'var(--panel-2)' }}>
        <span>{icon}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.name}</span>
        {data.trigger && <span className="trig">⚡ {TRIGGER_LABEL[data.trigger] ?? data.trigger}</span>}
      </div>
      <div className={'nb' + (data.text ? '' : ' empty')}>
        {data.shown ? data.text || 'Нет текста' : 'Скрытое событие (без окна)'}
      </div>
      {data.adds > 0 && <div className="nadd">🗺 показывает на карте: {data.adds}</div>}
      {data.buttons.map((b) => (
        <div className="nbtn" key={b.index}>
          <span>{data.shown ? b.label || 'Продолжить' : 'Далее'}</span>
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

function Story() {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const selected = useStore((st) => st.selected);
  const select = useStore((st) => st.select);
  const change = useStore((st) => st.change);
  const layout = useStore((st) => st.layout);
  const setLayout = useStore((st) => st.setLayout);
  const flow = useReactFlow();
  const [dragPos, setDragPos] = useState<Layout>({});

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

  const nodes: Node<StoryData>[] = useMemo(
    () =>
      s.components
        .filter((c) => isEventLike(c.type))
        .map((c) => {
          const shown = c.data.display !== 'false';
          return {
            id: c.name,
            type: 'story',
            // nodes are deleted from the inspector, with confirmation
            deletable: false,
            position: dragPos[c.name] ?? layout[c.name] ?? { x: 0, y: 0 },
            data: {
              name: c.name,
              type: c.type,
              shown,
              text: plainText(resolveText(s, lang, getText(s, lang, c.name + '.text'))),
              trigger: c.data.trigger ?? '',
              buttons: buttonsOf(c).map((b) => ({ index: b.index, label: plainText(buttonLabel(s, lang, b), 60) })),
              adds: (c.data.add ?? '').split(/\s+/).filter(Boolean).length,
              selected: c.name === selected,
            },
          };
        }),
    [s, lang, layout, dragPos, selected],
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
            style: { stroke: c.name === selected || t === selected ? 'var(--accent)' : '#7d7488', strokeWidth: 2 },
          });
        }
      }
    }
    return out;
  }, [s, nodes, selected]);

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
    <>
      <div className="view-toolbar">
        <button onClick={() => create('Event')}>+ {TYPE_ICON.Event} Событие</button>
        <button onClick={() => create('Token')}>+ {TYPE_ICON.Token} Жетон</button>
        <button onClick={() => create('Spawn')}>+ {TYPE_ICON.Spawn} Монстр</button>
        <button
          onClick={() => {
            setLayout(autoLayout(s, {}));
            setTimeout(() => flow.fitView({ duration: 300 }), 50);
          }}
          title="Расставить блоки автоматически"
        >
          Упорядочить
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, n) => select(n.id)}
        onPaneClick={() => select(null)}
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
        onEdgesDelete={(list) => {
          change((sc) => {
            let out = sc;
            for (const e of list) {
              const index = Number(e.sourceHandle?.substring(1));
              const c = out.components.find((x) => x.name === e.source);
              const b = c && buttonsOf(c).find((x) => x.index === index);
              if (b) out = setButtonTargets(out, e.source, index, b.targets.filter((t) => t !== e.target));
            }
            return out;
          });
        }}
        deleteKeyCode={['Delete', 'Backspace']}
        minZoom={0.1}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="#2c2733" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(n) => TYPE_COLOR[(n.data as StoryData).type] ?? '#555'} maskColor="#0009" style={{ background: '#1e1b24' }} />
      </ReactFlow>
      {nodes.length === 0 && (
        <div className="empty-state" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          Добавьте первое событие кнопкой «+ Событие».
        </div>
      )}
    </>
  );
}

export function StoryView() {
  return (
    <ReactFlowProvider>
      <Story />
    </ReactFlowProvider>
  );
}

