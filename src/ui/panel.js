// STUB: replaced by the UI package
// Plain-text left panel from HudState.
export function createPanel(el) {
  const pre = document.createElement('div');
  pre.className = 'panel-text';
  el.appendChild(pre);
  return {
    update(hud) {
      const p = hud.player;
      pre.textContent = `${p.name}\nLevel ${p.level}  XP ${p.xp}/${p.xpNext}\nHP ${p.hp}/${p.hpMax}\nGold ${p.gold}\n\n` +
        `${hud.zoneName}\n${hud.daypart} ${hud.hour.toFixed(1)}h`;
    },
    dispose() { pre.remove(); },
  };
}
export default createPanel;
