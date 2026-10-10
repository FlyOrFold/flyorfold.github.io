// Browser stand-ins for modules that touch localStorage or fire document events.
// Not a test file itself (no .test. in the name), so `node --test tests/` skips it.

/** Install a fake localStorage and document on globalThis. Call reset() in beforeEach. */
export function fakeBrowser() {
  const store = new Map();
  const events = [];
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.document = { dispatchEvent: (e) => events.push(e.type) };
  return { store, events, reset: () => { store.clear(); events.length = 0; } };
}
