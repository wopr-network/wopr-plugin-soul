# @wopr-network/wopr-plugin-soul

> Soul/personality plugin for WOPR — give your agent a persistent identity and character via SOUL.md.

## Install

```bash
npm install @wopr-network/wopr-plugin-soul
```

## Usage

```bash
wopr plugin install github:wopr-network/wopr-plugin-soul
```

Then configure via `wopr configure --plugin @wopr-network/wopr-plugin-soul`.

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `soul_file` | string | No | Path to SOUL.md file (default: `SOUL.md` in data dir) |

## What it does

The soul plugin injects a persistent persona into every agent conversation via a high-priority context provider. The agent's character, tone, and backstory are defined in a `SOUL.md` markdown file that you author — the plugin reads it at startup and includes it in every system prompt. It also registers `soul_get` and `soul_update` A2A tools so agents can introspect and evolve their own identity at runtime.

## License

MIT
