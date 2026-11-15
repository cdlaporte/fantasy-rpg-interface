// Frozen. Tiny synchronous event bus. Listeners run in subscription order.
// emit() does not allocate; on/off use copy-on-write so listeners may unsubscribe during emit.

export function createBus() {
  const map = new Map();
  const bus = {
    on(evt, fn) {
      const list = map.get(evt);
      map.set(evt, list ? list.concat(fn) : [fn]);
      return () => bus.off(evt, fn);
    },
    off(evt, fn) {
      const list = map.get(evt);
      if (!list) return;
      const i = list.indexOf(fn);
      if (i < 0) return;
      const next = list.slice();
      next.splice(i, 1);
      if (next.length) map.set(evt, next); else map.delete(evt);
    },
    once(evt, fn) {
      const off = bus.on(evt, (p) => { off(); fn(p); });
      return off;
    },
    emit(evt, payload) {
      const list = map.get(evt);
      if (!list) return;
      for (let i = 0; i < list.length; i++) list[i](payload);
    },
    count(evt) {
      const list = map.get(evt);
      return list ? list.length : 0;
    },
    clear() { map.clear(); },
  };
  return bus;
}

export default createBus;
