import type { IniSection } from './ini';

// Component kinds understood by Valkyrie, matched by section-name prefix
// (QuestData.AddData in unity/Assets/Scripts/Content/QuestData.cs).
export const COMPONENT_TYPES = [
  'Tile',
  'Door',
  'Token',
  'UI',
  'Event',
  'Spawn',
  'MPlace',
  'QItem',
  'Puzzle',
  'CustomMonster',
  'Activation',
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

// Every type except these can act as an event (has buttons, add/remove, operations...).
export const NON_EVENT_TYPES: ComponentType[] = ['Tile', 'MPlace', 'QItem', 'CustomMonster', 'Activation'];
export const isEventLike = (t: ComponentType) => !NON_EVENT_TYPES.includes(t);

// File a new component is saved to, mirroring the layout Valkyrie scenarios usually have.
export const DEFAULT_SOURCE: Record<ComponentType, string> = {
  Tile: 'tiles.ini',
  Door: 'tokens.ini',
  Token: 'tokens.ini',
  UI: 'ui.ini',
  Event: 'events.ini',
  Spawn: 'spawns.ini',
  MPlace: 'other.ini',
  QItem: 'items.ini',
  Puzzle: 'puzzles.ini',
  CustomMonster: 'monsters.ini',
  Activation: 'monsters.ini',
};

export interface QComponent {
  name: string;
  type: ComponentType;
  // ini file inside the package this component is stored in
  source: string;
  // raw key/values exactly as in the ini file (unknown keys are preserved)
  data: IniSection;
}

export interface Scenario {
  quest: IniSection;
  components: QComponent[];
  // language -> key -> text
  texts: Record<string, Record<string, string>>;
  // files kept untouched (images, audio...)
  assets: Record<string, Uint8Array>;
}

export function typeOfSection(name: string): ComponentType | null {
  for (const t of COMPONENT_TYPES) if (name.startsWith(t)) return t;
  return null;
}

export const CURRENT_FORMAT = '18';

export function newScenario(language = 'English'): Scenario {
  return {
    quest: {
      format: CURRENT_FORMAT,
      hidden: 'False',
      type: 'MoM',
      defaultlanguage: language,
      defaultmusicon: 'True',
      minhero: '1',
      maxhero: '5',
      difficulty: '0.5',
      lengthmin: '60',
      lengthmax: '120',
    },
    components: [
      {
        name: 'EventStart',
        type: 'Event',
        source: 'events.ini',
        data: { buttons: '1', event1: '', trigger: 'EventStart' },
      },
    ],
    texts: {
      [language]: {
        'quest.name': 'Новый сценарий',
        'quest.description': '',
        'quest.authors': '',
        'EventStart.text': 'Вступление к вашему сценарию.',
        'EventStart.button1': 'Продолжить',
      },
    },
    assets: {},
  };
}

export function defaultLanguage(s: Scenario): string {
  return s.quest.defaultlanguage || Object.keys(s.texts)[0] || 'English';
}
