// Shops (CONTRACTS 13a): {id, name, keeper, stock: [{item, req: [conds]}], haggle}.
// Prices live on the item defs (data/items.js). Keepers are NPC ids from data/npcs/town.js.
const s = (item, req = []) => ({ item, req });

export default {
  potions: {
    id: 'potions', name: 'The Bubbling Cauldron', keeper: 'mira', haggle: true,
    stock: [
      s('potion_small'),
      s('potion_big', [['level', '>=', 5]]),
      s('speed_tonic'),
      s('shield_charm', [['level', '>=', 4]]),
      s('herbal_tea'),
      s('focus_scroll', [['flag', 'class_chosen']]),
    ],
  },
  outfitter: {
    id: 'outfitter', name: 'Stitch & Sparkle', keeper: 'fenwick', haggle: true,
    stock: [
      s('hat_cap_blue'), s('hat_red_bandana'), s('hat_straw'), s('hat_paper_crown'), s('hat_chef'),
      s('hat_star_wizard'), s('hat_feather', [['quest', 'town_bard_ballad', 'done']]),
      s('hat_horned', [['level', '>=', 6]]), s('hat_moon_circlet', [['level', '>=', 8]]),
      s('cape_mint'), s('cape_crimson'), s('cape_midnight', [['level', '>=', 5]]),
      s('cape_gold', [['flag', 'mossback_defeated']]),
      s('dye_sunset'), s('dye_ocean'), s('dye_forest'), s('dye_lavender'), s('dye_midnight', [['level', '>=', 7]]),
    ],
  },
  general: {
    id: 'general', name: 'Odds & Ends', keeper: 'gus', haggle: true,
    stock: [
      s('bomb'), s('smoke_pellet'), s('potion_small'), s('cheese'),
      s('fox_whistle', [['level', '>=', 4]]),
    ],
  },
  bakery: {
    id: 'bakery', name: 'Rise & Shine', keeper: 'rosa', haggle: false,
    stock: [s('bread'), s('honey_bun'), s('cheese')],
  },
};
