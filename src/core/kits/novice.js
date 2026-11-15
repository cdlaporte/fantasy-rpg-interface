// Pre-class kit (CONTRACTS 8, CLASSES "Novice"): the stick. melee_arc 90 deg, range 0.9, coef 1.0, every 0.45 s,
// fx slash style 'stick'. No resource, no abilities. Cannot attack before flag has_stick.
// Numbers may be overridden by data.classes.novice.basic {arc, range, dmg, interval, knockback}.
const DEF = { arc: 90, range: 0.9, dmg: 1, interval: 0.45, knockback: 3.5 };

function nums(game) {
  const c = game.data.classes && game.data.classes.novice;
  return (c && c.basic) || DEF;
}

export default {
  id: 'novice',
  parent: null,
  resource: null,
  basicInfo(game) { return { name: game.flags.has_stick ? 'Stick' : '', icon: 'sword' }; },
  interval(game) { return nums(game).interval || DEF.interval; },
  onEquip() {}, onUnequip() {}, update() {},
  basic(game, p, ctx) {
    if (!game.flags.has_stick) return false;
    const n = nums(game);
    game.abilities.use('melee_arc', p, {
      angle: ctx.angle, arc: n.arc != null ? n.arc : DEF.arc, range: n.range != null ? n.range : DEF.range,
      dmg: n.dmg != null ? n.dmg : DEF.dmg, knockback: n.knockback != null ? n.knockback : DEF.knockback,
      style: 'stick', color: '#e8d2a0',
    });
    return undefined;
  },
  abilities: {},
  hooks: {},
};
