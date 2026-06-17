#!/usr/bin/env node
/**
 * websim AI agent v2.2 — instant queue alerts + background announcements
 */

require('dotenv').config();

const { CONFIG, loadProjectsConfig } = require('./modules/constants');
const { startMCP, stopMCP } = require('./modules/mcp');
const { runAgent } = require('./modules/agent-loop');
const { daemonLoop } = require('./modules/daemon');

async function main() {
  const args = process.argv.slice(2);
  let projectAlias = null, prompt = '', watch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' || args[i] === '-p') projectAlias = args[++i];
    else if (args[i] === '--watch' || args[i] === '-w' || args[i] === '--daemon') watch = true;
    else if (args[i] === '--list-projects') {
      const c = loadProjectsConfig();
      console.log(JSON.stringify(Object.entries(c.projects||{}).map(([k,v])=>({alias:k,id:v.id,slug:v.slug})),null,2));
      process.exit(0);
    }
    else prompt += (prompt?' ':'') + args[i];
  }

  if (!CONFIG.apiKey) { console.error('❌ OPENAI_API_KEY not set'); process.exit(1); }
  try { await startMCP(); } catch (err) { console.error('❌ MCP:', err.message); process.exit(1); }
  process.on('SIGINT', async () => { await stopMCP(); process.exit(0); });

  if (watch) { await daemonLoop(projectAlias); return; }
  try { await runAgent(prompt, projectAlias); } catch (err) { console.error(`\n❌ ${err.message}`); } finally { await stopMCP(); }
}

main().catch(async e => { console.error('Fatal:', e); await stopMCP(); process.exit(1); });
