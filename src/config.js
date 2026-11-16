// Frozen tunables. Changed only by the integrator. Pure data, safe under Node.

export const config = {
  startZone: 'intro',          // zone loaded for a new game
  startMarker: 'start',
  fallbackZone: 'test',        // used when startZone is missing from data.zones
  levelCap: 20,                // round 3 (was 12)
  numberScale: 6,              // every health and damage number in the game is this many times bigger (see docs/notes/fixcore.md)
  // round 2 (playtest feedback)
  cameraZoom: 1.3,             // 3D camera: closer view (cutscene zooms multiply this)
  modelScale: 1.3,             // 3D: characters and creatures drawn this much bigger (not props, projectiles, effects)
  playerSpeedMul: 1.3,         // player (and companion) walking speed multiplier over the class numbers
  xpCurve: { base: 15, exp: 1.5 },   // xpNext(level) = round(base * level^exp)
  teacherPin: '9631',          // classroom lock for Teacher options (not real security)
  defaultRenderer: '3d',
  // Scholar's chests: question-locked chests placed automatically per zone (zone def `scholarChests` wins; zones
  // with `scaleToPlayer` (the biomes) default to `biome`).
  scholarChests: { intro: 2, town: 4, academy: 2, forest: 8, biome: 10 },
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
    retrySeconds: 3,           // integration (Meta request): wait before a blocking question is asked again
    contexts: {
      // blocking = must be answered correctly (wrong: worked solution, then a new problem). Teacher decision:
      // only rune gates and boss shields block; everywhere else a wrong answer just gives a smaller reward.
      levelup: { enabled: true, blocking: false },
      boon: { enabled: true, blocking: false },
      spec: { enabled: true, blocking: false },
      mastery: { enabled: true, blocking: false },       // round 4: the level-15 mastery trial (right: +5% power)
      gate: { enabled: true, blocking: true },
      chest: { enabled: true, blocking: false },
      scholar_chest: { enabled: true, blocking: false },   // Scholar's chests: a wrong answer leaves the chest locked
      boss_shield: { enabled: true, blocking: true },
      focus: { enabled: true, blocking: false },
      lesson: { enabled: true, blocking: false },
      quest_turnin: { enabled: true, blocking: false },
      haggle: { enabled: true, blocking: false },
      revive: { enabled: true, blocking: false },
    },
  },
};

export default config;
