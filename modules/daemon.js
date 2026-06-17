const { CONFIG } = require('./constants');
const { getMcpClient, stopMCP } = require('./mcp');
const { loadBotState, saveBotState } = require('./state');
const { addToQueue, announceQueuePositions, processNextInQueue } = require('./queue');

async function daemonLoop(projectAlias) {
  const state = loadBotState();
  state._projectAlias = projectAlias;
  if (state.currentlyProcessing) state.currentlyProcessing = null;
  saveBotState(state);

  const intSec = Math.round(CONFIG.watchIntervalMs / 1000);
  console.log(`\n🤖 Daemon v2.2 | Model: ${CONFIG.model} | Poll: ${intSec}s | Priority: @Endoxidev`);
  console.log(`   Queue: ${state.queue.length} | Built: ${state.checklist.length} | Admin: !clearqueue, !status\n`);

  await pollAndEnqueue(projectAlias, state);

  const pollTimer = setInterval(() => pollAndEnqueue(projectAlias, state), CONFIG.watchIntervalMs);
  const announceTimer = setInterval(() => announceQueuePositions(projectAlias, state), CONFIG.queueAnnounceMs);

  let closing = false;
  const shutdown = async () => {
    if (closing) return; closing = true;
    clearInterval(pollTimer); clearInterval(announceTimer);
    state.currentlyProcessing = null;
    saveBotState(state);
    await stopMCP();
    process.exit(0);
  };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}

async function pollAndEnqueue(projectAlias, state) {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  try {
    const res = await getMcpClient().callTool({ name: 'list_comments', arguments: { project: projectAlias, limit: 50 } });
    const text = res.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    let comments;
    try { const p = JSON.parse(text); comments = p.comments || p; } catch { comments = []; }
    if (!Array.isArray(comments)) comments = [];

    const foreign = comments.filter(c => (c.author?.username || '') !== CONFIG.botUsername);
    const selfCount = comments.length - foreign.length;
    const newComments = foreign.filter(c => !state.entries[c.id] && !state.queue.find(q => q.commentId === c.id));

    for (const c of newComments) {
      state.entries[c.id] = { id: c.id, category: 'queued', at: new Date().toISOString(), author: c.author?.username };
      addToQueue(state, c);
    }
    saveBotState(state);

    if (newComments.length > 0) {
      const sn = selfCount > 0 ? ` (${selfCount} self skipped)` : '';
      console.log(`[${ts}] ${newComments.length} new → queue now ${state.queue.length}${sn}`);
      announceQueuePositions(projectAlias, state).catch(() => {});
    }

    if (!state.currentlyProcessing && state.queue.length > 0) {
      await processNextInQueue(projectAlias, state);
    }

    state.lastRun = new Date().toISOString();
    saveBotState(state);
  } catch (err) { console.error(`[${ts}] ⚠️ ${err.message}`); }
}

module.exports = { daemonLoop, pollAndEnqueue };
