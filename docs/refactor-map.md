# Refactor Map — agent.js

## Summary
- **File**: `agent.js` (475 lines → 33 lines)
- **Total functions**: 20 → extracted into 9 modules
- **Zero circular dependencies, zero behavioral changes**

## Final Module Map

| File | Responsibility | Exported Symbols |
|---|---|---|
| `modules/constants.js` | Shared config, quotes, debug logging, project config loader | `CONFIG`, `RANDOM_QUOTES`, `log`, `loadProjectsConfig` |
| `modules/mcp.js` | MCP client lifecycle, tool format conversion, getters | `startMCP`, `stopMCP`, `mcpToolToOpenAI`, `getMcpClient`, `getMcpTools` |
| `modules/model.js` | OpenAI-compatible API calls | `callModel` |
| `modules/guide.js` | CLAUDE.md loader with in-memory cache | `loadClaudeGuide` |
| `modules/triage.js` | Comment content parsing + AI triage classification | `extractCommentText`, `triageComment` |
| `modules/state.js` | Daemon state persistence (comment-bot-seen.json) | `loadBotState`, `saveBotState` |
| `modules/queue.js` | Comment queue system, admin commands, position announcements | `bgReply`, `addToQueue`, `handleAdminCommand`, `announceQueuePositions`, `processNextInQueue` |
| `modules/daemon.js` | Poll loop + daemon lifecycle | `daemonLoop` |
| `modules/agent-loop.js` | Agent tool-calling loop (prompt → LLM → tools → repeat) | `runAgent` |
| `agent.js` | CLI entry point (pure wiring) | none |

## Dependency Graph

```
agent.js
  ├── modules/daemon.js
  │     ├── modules/queue.js
  │     │     ├── modules/agent-loop.js
  │     │     │     ├── modules/mcp.js
  │     │     │     ├── modules/model.js
  │     │     │     └── modules/guide.js
  │     │     ├── modules/triage.js
  │     │     │     ├── modules/model.js
  │     │     │     └── modules/guide.js
  │     │     ├── modules/mcp.js
  │     │     ├── modules/state.js
  │     │     └── modules/constants.js
  │     ├── modules/mcp.js
  │     ├── modules/state.js
  │     └── modules/constants.js
  ├── modules/agent-loop.js
  ├── modules/mcp.js
  └── modules/constants.js
```

## Extraction Order (Dependency Depth)
1. constants.js (leaf)
2. mcp.js (depends on constants)
3. model.js (depends on constants)
4. guide.js (leaf)
5. triage.js (depends on model, guide)
6. state.js (leaf)
7. queue.js (depends on mcp, triage, state, constants)
8. daemon.js (depends on mcp, queue, state, constants)
9. agent-loop.js (depends on mcp, model, guide)
10. agent.js → pure wiring
