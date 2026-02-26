# wopr-plugin-soul

Soul/personality plugin — persistent agent identity via SOUL.md.

## Structure

- `src/index.ts` — Plugin entry, manifest, init/shutdown lifecycle
- `src/soul-a2a-tools.ts` — A2A tools: `soul.get`, `soul.update`
- `src/soul-context-provider.ts` — Context provider injecting SOUL.md into conversations
- `tests/index.test.ts` — Full test suite

## Dev

```bash
npm install
npm run build     # tsc
npm run test      # vitest run
npm run lint      # biome check
npm run lint:fix  # biome check --fix
npm run format    # biome format --write
npm run check     # biome check + tsc --noEmit
```

## Conventions

- Default export is the `WOPRPlugin` object
- Module-level `let ctx` and `const cleanups` for lifecycle
- A2A tool names use dot notation: `soul.get`, `soul.update`
- All catch blocks use `catch (error: unknown)` or `catch (_error: unknown)`
- Shutdown is idempotent (`if (!ctx) return`)
- No `isError` in A2A tool returns
