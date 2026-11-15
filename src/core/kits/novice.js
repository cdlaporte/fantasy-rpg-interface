// STUB: replaced by the Sim package
// Pre-class kit: stick basic attack (melee_arc) once flag has_stick; no abilities, no resource.
export default {
  id: 'novice',
  parent: null,
  resource: null,
  onEquip() {}, onUnequip() {}, update() {},
  basic(game, p, ctx) {
    if (!game.flags.has_stick) return;
    game.abilities.use('melee_arc', p, { angle: ctx.angle, arc: 100, range: 1, dmg: 1 });
  },
  abilities: {},
  hooks: {},
};
