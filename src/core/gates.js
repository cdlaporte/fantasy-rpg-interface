// STUB: replaced by the Meta package
export default {
  id: 'gates',
  always: true,
  init() { return { ask() { return Promise.resolve({ correct: true, skipped: false }); } }; },
  update() {},
};
