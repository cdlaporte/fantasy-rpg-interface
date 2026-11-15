// STUB: replaced by the UI package
export function createToasts(el) {
  return {
    show(text, style = 'info') {
      if (!el) return;
      const d = document.createElement('div');
      d.className = 'toast toast-' + style;
      d.textContent = text;
      el.appendChild(d);
      setTimeout(() => d.remove(), 2500);
    },
  };
}
export default createToasts;
