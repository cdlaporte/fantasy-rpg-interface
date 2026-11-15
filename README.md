# Flinkerton Academy

A bright, light-hearted fantasy action-RPG for school Chromebooks. Plain ES modules, no build step,
two looks from the same game: `2d` (Canvas 2D) and `3d` (three.js, vendored in `vendor/three/`).

## Run

```sh
node tools/serve.mjs          # http://127.0.0.1:8080/
```

Open `http://127.0.0.1:8080/` (it must be served over http, not opened as a file).
Useful URL parameters: `renderer=2d|3d`, `skipintro=1`, `debug=1` (exposes `window.__game`),
`test=1` (manual stepping, fixed seed), `questions=off|auto|stub`, `perf=1`, `seed=N`, `zone=<id>`, `marker=<name>|x,y`.

Renderer gallery (no game needed): `http://127.0.0.1:8080/tools/gallery.html?renderer=2d&page=0` (pages 0-4).

## Tests

```sh
node --test tests/node        # Node unit tests
node tests/e2e/skeleton.cjs   # headless Chromium smoke test (screenshots in tests/e2e/out/)
```

The authoritative spec is `docs/CONTRACTS.md`. Package notes live in `docs/notes/`.
