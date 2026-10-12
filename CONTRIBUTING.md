# Contributing to ISS-edu

Thank you for helping make the ISS a little easier to understand. Bug reports, ideas, documentation fixes and code are all welcome.

For a security problem, please do not open a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## Before you start

- **Small fixes** (typos, a clear bug with an obvious fix): open a pull request straight away.
- **Anything larger** (a new feature, a new dependency, a change to the look): open an issue first so we can agree on the approach before you spend time on it.
- The app is deliberately a static, client-side app with no backend, no accounts and no tracking. Changes that need a server, store personal data or call new third-party hosts will need a strong reason.

## Setting up

You need [Bun](https://bun.sh) 1.4 or newer. This project uses Bun for everything: please do not use npm, yarn or pnpm, and do not commit any lockfile other than `bun.lock`.

```bash
git clone https://github.com/CodeWithBehnam/ISS-edu.git
cd ISS-edu
bun install
bun run dev
```

To try the production container, run `podman compose up --build` or `docker compose up --build` and open <http://localhost:8080>.

## Checks to run before opening a pull request

```bash
bun run typecheck   # TypeScript, strict mode
bun run lint        # ESLint, zero warnings allowed
bun run test        # Vitest unit tests
bun run build       # type-check and production build
```

[CI](.github/workflows/ci.yml) runs the same checks, and also builds the container image. A pull request needs CI to be green.

If you change anything that affects how the app looks or behaves, also run it in a browser, in the 3D view and in the flat-map fallback if you touched either, and at phone width (about 390 px) as well as desktop. For visible changes, please attach a before and after screenshot to the pull request.

### Generated files

- `public/data/countries-110m.json` is generated. Change `scripts/build-countries.ts` and run `bun run data:countries`, rather than editing the JSON.
- `public/models/*.glb` are exported from `assets/blender/iss-tracker-models.blend`. See [assets/blender/README.md](assets/blender/README.md). Please change the generator scripts inside the `.blend`, then re-export, rather than editing the GLBs.

## Code style

Match the code around you. The conventions that matter most:

- **TypeScript in strict mode, no `any`.** Use `unknown` and narrow it, and validate anything from the network with zod at the boundary.
- **Functional core, imperative shell.** Keep logic in pure functions under `src/lib/**` and keep effects (timers, network, the browser) in hooks and components. Prefer immutable data and composition. A little local mutation inside one function is fine when it is clearer or measurably faster.
- **Files stay under 300 lines.** Split a file when it grows past that.
- **Comments explain why, not what.** No commented-out code.
- **British English** in prose, comments, documentation and user-facing text: "colour", "centre", "licence" (the noun). Identifiers follow the language's conventions, so CSS and JavaScript keep `color`.
- **No em dashes** (the long dash) in prose, comments or documentation. Use a comma, a colon, brackets or a full stop.
- **Errors fail fast and are never swallowed.** Throw specific errors, and log with `clientLog` from `src/lib/observability/client-log.ts`. Do not call `console.*` directly in library code.
- **Do not add runtime dependencies** without discussing it in an issue first. Prefer the platform and the libraries already in use.
- Match the surrounding formatting: two-space indentation, single quotes, semicolons, trailing commas. The project has no automatic formatter, so please do not reformat lines you are not otherwise changing.

### Working in the 3D scene

- Do not call React Query hooks inside the `<Canvas>` tree: the React context does not reliably cross the renderer. Fetch in DOM components and pass the data in as props.
- Per-frame data lives in the mutable `IssFrame` snapshot (`src/components/scene/iss-frame.ts`). Read it from `useFrame`. Inside `useFrame`, read the Zustand store with `useTrackerStore.getState()` so frames do not cause React re-renders.
- The simulation time is `currentSimMs(clock, Date.now())`. Never use `Date.now()` directly for anything that should follow time travel.
- The scene frame is Earth-fixed and Y-up, shared with the Blender models: `+Y` north, `+X` at latitude 0 and longitude 0, `-Z` at latitude 0 and longitude 90 degrees east. Use the helpers in `src/lib/orbit/frames.ts` rather than converting by hand.

### Tests

- Test pure functions directly, with the real implementation. Mock only at the boundary (the network, the clock, the browser).
- Put tests in `tests/unit/<name>.test.ts`. A bug fix should come with a test that fails without the fix.

### Accessibility

New controls need an accessible name, must work with the keyboard and must keep a visible focus ring. Respect `prefers-reduced-motion` (the store's `reducedMotion` flag) for anything that moves. Keep text contrast at or above 4.5:1.

## Commits and pull requests

- Branch from `main` and keep each pull request focused on one thing.
- Write commit messages in the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) style, in the imperative mood and with a subject under 72 characters: `feat: add a miles toggle to the footprint label`, `fix: wrap longitude at the date line`, `docs: explain the base path`.
- Explain what changed and why in the pull request description, and link the issue it closes.
- Update the README or other documentation when behaviour changes.
- Never commit secrets, `.env` files or credentials. The app has none and should stay that way.
- Be kind in reviews and discussions. Assume good faith.

## Licence

By contributing you agree that your contribution is licensed under the [MIT Licence](LICENSE) that covers the project.
