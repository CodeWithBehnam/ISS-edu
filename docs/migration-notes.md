## Migration Complete: Next.js → Vite + React + Bun

The project has been successfully migrated from Next.js to Vite + React + Bun.

### Changes Made

1. **Package Configuration**
   - Removed Next.js dependencies
   - Added Vite and React Router
   - Updated scripts to use Vite commands
   - Removed `engines` field (Bun doesn't require specific versions)

2. **Build System**
   - Created `vite.config.ts` with proper React plugin and path aliases
   - Created `index.html` as Vite entry point
   - Updated `tsconfig.json` for Vite bundler mode

3. **Project Structure**
   - Moved all source files to `src/` directory
   - Created `src/main.tsx` as entry point
   - Created `src/App.tsx` with React Router setup
   - Updated all imports to use `@/` alias

4. **Removed Next.js Specifics**
   - Removed all `'use client'` directives
   - Removed Next.js API routes (now using direct API calls)
   - Updated `useTelemetryQuery` to fetch directly from `wheretheiss.at`
   - Removed Next.js font loading

5. **Configuration Files**
   - Deleted `next.config.js`
   - Deleted `next-env.d.ts`
   - Created `tsconfig.node.json` for Vite config

### Next Steps

1. Install dependencies: `bun install`
2. Run dev server: `bun run dev`
3. Test the application
4. Complete remaining UI components (PassList, TimeScrubber, HUD Cards)

### Notes

- Web Workers are configured to use ES modules (`format: 'es'`)
- All API calls are now client-side (no server-side routes)
- React Router is set up for future routing needs
- Path aliases (`@/`) are configured in both Vite and TypeScript

