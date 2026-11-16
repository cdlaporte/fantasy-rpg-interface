// UI e2e fixtures: fake HudState values, modal payloads exactly per CONTRACTS section 9, overlay entities.
// installHarness(page) defines window.__ui inside the game page (needs ?test=1&debug=1):
//   __ui.setHud(partial)   deep-merged over every game.hudState() result (wraps hudState)
//   __ui.open(name)        opens a fixture modal with game.openModal(...)
//   __ui.payloads          the payloads; __ui.calls: commands the modals invoked [name, args]
//   __ui.spawnOverlayCast() creates NPC / enemy entities near the player and floats some numbers
//   __ui.poll()            forces a HUD refresh and renders one frame

async function installHarness(page) {
  await page.evaluate(async () => {
    const L = await import('/src/data/looks.js');
    const game = window.__game.game;
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const look = (i, patch) => {
      const b = clone(L.PLAYER_LOOKS[i]);
      for (const k of Object.keys(patch || {})) b[k] = typeof patch[k] === 'object' && patch[k] && !Array.isArray(patch[k]) && b[k] ? Object.assign(b[k], patch[k]) : patch[k];
      return b;
    };
    const looks = {
      warrior: look(0, { outfit: { style: 'tunic', primary: '#c8402e', secondary: '#dfe6ee', accent: '#ffd24a' }, held: { style: 'sword', color: '#dfe6ee' } }),
      mage: look(0, { outfit: { style: 'robe', primary: '#7a4bc4', secondary: '#3fd6ff', accent: '#ffd24a' }, hat: { style: 'wizard', color: '#6a4bc4' } }),
      rogue: look(0, { outfit: { style: 'leather', primary: '#3f9a52', secondary: '#2a3a2a', accent: '#c9a050' }, hat: { style: 'bandana', color: '#2e7d4f' } }),
      sorcerer: look(1, { outfit: { style: 'robe', primary: '#b8323a', secondary: '#ffd24a', accent: '#ff7a2f' }, hat: { style: 'wizard', color: '#8a1f2a' }, aura: null }),
      bram: { rig: 'humanoid', build: 'a', size: 1.1, skin: '#e0a878', hair: { style: 'spiky', color: '#d9862a' }, facial: 'none',
        outfit: { style: 'tunic', primary: '#c8402e', secondary: '#dfe6ee', accent: '#ffd24a' }, hood: false, hat: null, cape: null, held: { style: 'sword' }, aura: null, ears: 'round', hero: null },
      pip: { rig: 'humanoid', build: 'b', size: 0.85, skin: '#8d5a3b', hair: { style: 'curly', color: '#1e140e' }, facial: 'none',
        outfit: { style: 'leather', primary: '#3f9a52', secondary: '#2a3a2a', accent: '#c9a050' }, hood: false, hat: { style: 'bandana', color: '#2e7d4f' }, cape: null, held: { style: 'daggers' }, aura: null, ears: 'pointed', hero: null },
      shopkeeper: { rig: 'humanoid', build: 'b', size: 1, skin: '#f0c49a', hair: { style: 'bun', color: '#9a9aa8' }, facial: 'none',
        outfit: { style: 'apron', primary: '#f4f1e8', secondary: '#7a4bc4', accent: '#ff7ab8' }, hood: false, hat: null, cape: null, held: null, aura: null, ears: 'round', hero: null },
    };
    const calls = [];
    for (const k of Object.keys(game.commands)) {
      const orig = game.commands[k];
      game.commands[k] = (...args) => { calls.push([k, args]); return orig(...args); };
    }
    let fake = null;
    const merge = (dst, src) => {
      for (const k of Object.keys(src)) {
        const v = src[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k]) && k !== 'look') merge(dst[k], v);
        else dst[k] = Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : v;   // deep copy: the core mutates its hud arrays in place
      }
    };
    const origHud = game.hudState.bind(game);
    game.hudState = () => { const h = origHud(); if (fake) merge(h, fake); return h; };

    const p = game.player;
    const blips = [];
    const add = (dx, dy, type) => blips.push({ x: p.x + dx, y: p.y + dy, type });
    add(6, -3, 'enemy'); add(8, 2, 'enemy'); add(-5, 4, 'npc'); add(-2, -6, 'shop'); add(12, 9, 'quest'); add(3, 5, 'companion');
    add(-10, -2, 'exit'); add(4, -9, 'chest'); add(30, -20, 'quest');

    const hudFull = {
      zoneName: 'Whisperwood', hour: 14.5, daypart: 'day',
      player: { name: 'Rowan', level: 9, xp: 340, xpNext: 670, hp: 58, hpMax: 82, gold: 1234, classId: 'mage', className: 'Mage', specId: 'sorcerer', specName: 'Sorcerer',
        look: looks.sorcerer, cloaked: false, power: 21, defense: 4, speed: 3.3, wanted: false, resource: { id: 'mana', name: 'Mana', value: 62, max: 100, color: '#4d8dff' } },
      basic: { name: 'Overcharge', rank: 3, icon: 'fire' },
      abilities: [
        { slot: 'space', key: 'Space', id: 'blink', name: 'Blink', icon: 'blink', desc: 'Teleport a short hop.', unlocked: true, unlockLevel: 3, cdFrac: 0.35, ready: false, active: false, cost: 15 },
        { slot: 'q', key: 'Q', id: 'arcane_nova', name: 'Arcane Nova', icon: 'nova', desc: 'Blast enemies away.', unlocked: true, unlockLevel: 5, cdFrac: 0, ready: true, active: false, cost: 35 },
        { slot: 'f', key: 'F', id: 'meteor', name: 'Meteor', icon: 'meteor', desc: 'Call down a meteor.', unlocked: true, unlockLevel: 8, cdFrac: 0, ready: true, active: true, cost: 40 },
        { slot: 'shift', key: 'Shift', id: 'cataclysm', name: 'Cataclysm', icon: 'storm', desc: 'Five meteors.', unlocked: false, unlockLevel: 11, cdFrac: 0, ready: false, active: false, cost: 80 },
      ],
      items: [
        { id: 'potion_small', name: 'Small Potion', icon: 'potion', count: 3, cdFrac: 0 },
        { id: 'bread', name: 'Bread', icon: 'bread', count: 5, cdFrac: 0.5 },
        null,
        { id: 'bomb', name: 'Bomb', icon: 'bomb', count: 2, cdFrac: 0 },
        { id: 'speed_tonic', name: 'Speed Tonic', icon: 'tonic', count: 1, cdFrac: 0 },
        { id: 'focus_scroll', name: 'Focus Scroll', icon: 'book', count: 1, cdFrac: 0 },
      ],
      quest: { id: 'forest_mushroom_mischief', name: 'Mushroom Mischief', step: 'Pop the sporecaps in the glade', progress: '4/6' },
      companions: [
        { id: 'bram', name: 'Bram', classId: 'warrior', hpFrac: 0.8, down: false, look: looks.bram },
        { id: 'pip', name: 'Pip', classId: 'rogue', hpFrac: 0.2, down: false, look: looks.pip },
      ],
      boss: null, prompt: null, tutorial: null, pendingBoons: 1, pendingSpec: false,
      kitHud: null,
      minimap: { px: p.x, py: p.y, blips, blipCount: blips.length },
    };

    const classes = [
      { id: 'warrior', name: 'Warrior', blurb: 'The wall and the hammer. Heavy swings that move everything.', look: looks.warrior,
        basic: { name: 'Sword Arc', icon: 'sword', desc: 'A wide, heavy swing.' },
        abilities: [{ slot: 'space', name: 'Shield Bash', icon: 'dash', desc: 'Dash and stun.', unlock: 3 }, { slot: 'q', name: 'War Cry', icon: 'roar', desc: 'Shockwave and power up.', unlock: 5 }] },
      { id: 'mage', name: 'Mage', blurb: 'The glass cannon who controls space. Bolts, blinks and big booms.', look: looks.mage,
        basic: { name: 'Arcane Bolt', icon: 'bolt', desc: 'A fast magic bolt.' },
        abilities: [{ slot: 'space', name: 'Blink', icon: 'blink', desc: 'Teleport a short hop.', unlock: 3 }, { slot: 'q', name: 'Arcane Nova', icon: 'nova', desc: 'Blast everything away.', unlock: 5 }] },
      { id: 'rogue', name: 'Rogue', blurb: 'Fast, slippery and bursty. Build combo, then cash it in.', look: looks.rogue,
        basic: { name: 'Twin Daggers', icon: 'dagger', desc: 'Quick double slash.' },
        abilities: [{ slot: 'space', name: 'Dodge Roll', icon: 'roll', desc: 'Roll through danger.', unlock: 3 }, { slot: 'q', name: 'Fan of Knives', icon: 'knives', desc: 'Spend combo on knives.', unlock: 5 }] },
    ];
    const specs = [
      { id: 'conjurer', name: 'Conjurer', blurb: 'A one-student army of spirit pets.', look: Object.assign(clone(looks.mage), { outfit: { style: 'robe', primary: '#1f9e8a', secondary: '#3fe0c5', accent: '#ffd24a' }, hat: { style: 'circlet', color: '#ffd24a' } }),
        basic: { name: 'Spirit Bolt', icon: 'orb' }, abilities: [{ slot: 'f', name: 'Summon Familiar', icon: 'summon', desc: 'Fox, owl, stoneling.', unlock: 8 }, { slot: 'shift', name: 'Grand Conjuration', icon: 'summon', desc: 'A giant guardian.', unlock: 11 }] },
      { id: 'sorcerer', name: 'Sorcerer', blurb: 'Charge-up artillery. Hold to unleash.', look: looks.sorcerer,
        basic: { name: 'Overcharge', icon: 'fire' }, abilities: [{ slot: 'f', name: 'Meteor', icon: 'meteor', desc: 'Drop a meteor.', unlock: 8 }, { slot: 'shift', name: 'Cataclysm', icon: 'storm', desc: 'Five meteors.', unlock: 11 }] },
      { id: 'monk', name: 'Monk', blurb: 'The mage who punches. Combos and flying kicks.', look: Object.assign(clone(looks.mage), { outfit: { style: 'gi', primary: '#f2a93b', secondary: '#fff6df', accent: '#3fa34d' }, hat: { style: 'bandana', color: '#e2503c' } }),
        basic: { name: 'Four-Beat Combo', icon: 'fist' }, abilities: [{ slot: 'f', name: 'Flying Kick', icon: 'kick', desc: 'Chain kicks.', unlock: 8 }, { slot: 'shift', name: 'Thousand Palms', icon: 'fist', desc: 'A blur of strikes.', unlock: 11 }] },
    ];
    const payloads = {
      dialogue: { type: 'dialogue', speaker: 'Mr. Laporte', speakerLook: null, portrait: 'laporte', mood: 'calm',
        text: 'Ah, yes. Rowan. You must be the new student. This road is dangerous. Follow me, and please put the stick down.', options: null },
      dialogueOptions: { type: 'dialogue', speaker: 'Pip', speakerLook: looks.pip, portrait: null, mood: 'happy',
        text: 'Psst! Want to sneak into the library after hours?',
        options: [{ text: 'Absolutely. Lead the way!' }, { text: 'No thanks, I have homework.' }, { text: 'Only if we bring snacks.', disabled: true, hint: 'Needs Bread' }] },
      shop: { type: 'shop', id: 'potions', name: 'The Bubbling Cauldron', keeper: 'shopkeeper', gold: 120, haggled: false,
        stock: [
          { id: 'potion_small', name: 'Small Potion', desc: 'Heals 30% of your health.', icon: 'potion', price: 15, canBuy: true },
          { id: 'potion_big', name: 'Big Potion', desc: 'Heals 70% of your health.', icon: 'potion', price: 45, canBuy: true },
          { id: 'speed_tonic', name: 'Speed Tonic', desc: 'Run faster for 10 seconds.', icon: 'tonic', price: 30, canBuy: true },
          { id: 'shield_charm', name: 'Shield Charm', desc: 'A bubble that blocks a few hits.', icon: 'charm', price: 60, canBuy: true },
          { id: 'focus_scroll', name: 'Focus Scroll', desc: 'Answer a question to power up.', icon: 'book', price: 150, canBuy: false },
        ] },
      inventory: { type: 'inventory', items: { potion_small: 3, bread: 5, bomb: 2, smoke_pellet: 1, old_key: 1 },
        cosmetics: [{ id: 'hat_feather', name: 'Feathered Cap', icon: 'hat' }, { id: 'cape_blue', name: 'Sky Cape', icon: 'cloak' }], equipped: { hat: 'hat_feather', cape: null, outfitColor: null } },
      lookPicker: { type: 'lookPicker', name: 'Rowan', looks: L.PLAYER_LOOKS.slice(0, 8) },
      classPicker: { type: 'classPicker', classes },
      specPicker: { type: 'specPicker', options: specs },
      boonPicker: { type: 'boonPicker', options: [
        { id: 'splitting_bolts', name: 'Splitting Bolts', desc: 'Bolts split into two smaller bolts on impact.', icon: 'bolt' },
        { id: 'blink_burst', name: 'Blink Burst', desc: 'Blink leaves a half-strength Nova behind.', icon: 'blink' },
        { id: 'frost_nova', name: 'Frost Nova', desc: 'Nova freezes enemies and leaves frosty ground.', icon: 'frost' },
      ] },
      question: { type: 'question', req: { context: 'gate', difficulty: 2, tags: ['fractions'] },
        mount: (el) => import('/src/questions/stubProvider.js').then((m) => m.default.ask({ context: 'gate', difficulty: 2, tags: ['fractions'] }, el))
          .then((r) => { window.__ui.answered = r; game.closeModal(r); return r; }) },
      lesson: { type: 'lesson', teacher: 'laporte', title: 'Fractions of a Fireball', total: 3, done: 2, correct: 1 },
      pause: { type: 'pause' },
    };
    // the stub inventory has no item defs: give the fixture some names
    game.data.items = Object.assign({
      potion_small: { id: 'potion_small', type: 'consumable', name: 'Small Potion', desc: 'Heals 30% of your health.', icon: 'potion' },
      bread: { id: 'bread', type: 'consumable', name: 'Fresh Bread', desc: 'Heals a little over time.', icon: 'bread' },
      bomb: { id: 'bomb', type: 'consumable', name: 'Bomb', desc: 'Throw it. Boom.', icon: 'bomb' },
      smoke_pellet: { id: 'smoke_pellet', type: 'consumable', name: 'Smoke Pellet', desc: 'Vanish in a puff.', icon: 'smoke' },
      old_key: { id: 'old_key', type: 'key', name: 'Old Key', desc: 'Opens something, somewhere.', icon: 'key' },
    }, game.data.items || {});
    game.data.npcs = Object.assign({ shopkeeper: { id: 'shopkeeper', name: 'Madame Fizz', look: looks.shopkeeper } }, game.data.npcs || {});

    window.__ui = {
      looks, payloads, calls, hudFull,
      setHud(o) { fake = o; window.__ui.poll(); },
      poll() { window.__game.step(0); },
      open(name) { const pl = payloads[name]; game.openModal(Object.assign({}, pl)); window.__game.step(0); return game.modal && game.modal.type; },
      spawnOverlayCast() {
        const e = game.ents;
        const npc = e.create({ kind: 'ranger_tam', type: 'npc', team: 'town', name: 'Ranger Tam', x: p.x - 2.2, y: p.y - 0.6, look: looks.bram, hp: 10, hpMax: 10 });
        const en = e.create({ kind: 'slime', type: 'enemy', team: 'enemy', name: 'Slime', x: p.x + 3, y: p.y + 0.5,
          look: { rig: 'blob', size: 0.7, colors: { body: '#58d68d', belly: '#b8f0c8', accent: '#ffd24a', eye: '#1b1b1b' }, features: [] }, hp: 6, hpMax: 14 });
        const en2 = e.create({ kind: 'boar', type: 'enemy', team: 'enemy', name: 'Boar', x: p.x + 4.5, y: p.y - 2,
          look: { rig: 'quadruped', size: 1, colors: { body: '#7a5233', belly: '#c99a62', accent: '#fff', eye: '#1b1b1b' }, features: ['tusks'] }, hp: 30, hpMax: 40 });
        fake = Object.assign({}, fake || {}, { prompt: { text: 'Talk', key: 'E', entId: npc.id } });
        game.fx({ type: 'text', x: en.x, y: en.y, text: '12', style: 'dmg' });
        game.fx({ type: 'text', x: en2.x, y: en2.y, text: '37', style: 'crit' });
        game.fx({ type: 'text', x: p.x, y: p.y, text: '8', style: 'heal' });
        game.fx({ type: 'text', x: p.x + 1, y: p.y + 1, text: '25', style: 'xp' });
        game.fx({ type: 'text', x: p.x - 1, y: p.y + 1.5, text: '7', style: 'gold' });
        game.fx({ type: 'text', x: en.x + 1, y: en.y, text: 'miss', style: 'miss' });
        game.fx({ type: 'text', x: npc.x, y: npc.y, text: 'Lovely day for slime hunting, isn\'t it?', style: 'bubble', ent: npc.id });
        window.__game.step(1);
        return { npc: npc.id, enemy: en.id };
      },
    };
  });
}

module.exports = { installHarness };
