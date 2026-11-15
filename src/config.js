// Frozen tunables. Changed only by the integrator. Pure data, safe under Node.

export const config = {
  startZone: 'intro',          // zone loaded for a new game
  startMarker: 'start',
  fallbackZone: 'test',        // used when startZone is missing from data.zones
  levelCap: 12,
  dayLengthSeconds: 720,       // a full in-game day = 12 real minutes
  startHour: 8,
  activationRadius: 30,        // tiles; entities farther from the player are asleep
  caps: { enemies: 24, npcs: 12, projectiles: 64 },
  fxQueueMax: 256,             // FxEvents buffered between rendered frames; extra are dropped
  maxCatchUpSteps: 4,
  autosaveSeconds: 60,
  saveKeyPrefix: 'flinkerton.v1.',
  panelWidth: 280,             // CSS px
  tilePx: 48,                  // CSS px per tile at zoom 1
  nameMaxLength: 12,
  defaultQuality: 1,           // 0 low | 1 medium | 2 high
  testSeed: 12345,
  questions: {
    contexts: {
      levelup: { enabled: true, blocking: false },
      boon: { enabled: true, blocking: true },
      spec: { enabled: true, blocking: true },
      gate: { enabled: true, blocking: true },
      chest: { enabled: true, blocking: true },
      boss_shield: { enabled: true, blocking: true },
      focus: { enabled: true, blocking: false },
      lesson: { enabled: true, blocking: true },
      quest_turnin: { enabled: true, blocking: true },
      haggle: { enabled: true, blocking: false },
      revive: { enabled: true, blocking: true },
    },
  },
};

export default config;
