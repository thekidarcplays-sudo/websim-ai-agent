const { CONFIG, RANDOM_QUOTES } = require('./constants');
const { getMcpClient } = require('./mcp');
const { extractCommentText, triageComment } = require('./triage');
const { saveBotState } = require('./state');

function bgReply(projectAlias, commentId, content) {
  getMcpClient().callTool({ name: 'post_reply', arguments: { project: projectAlias, comment_id: commentId, content } }).catch(() => {});
}

function addToQueue(state, comment) {
  const author = comment.author?.username || '';
  const content = extractCommentText(comment);
  if (!content.trim()) return;
  if (state.queue.find(q => q.commentId === comment.id)) return;
  if (state.entries[comment.id]?.category === 'cleared') return;

  if (author === 'Endoxidev' && content.startsWith('!')) {
    handleAdminCommand(content, comment, state);
    return;
  }

  const item = { commentId: comment.id, author, content: content.slice(0, 200), addedAt: new Date().toISOString() };
  author === 'Endoxidev' ? state.queue.unshift(item) : state.queue.push(item);

  const pos = state.queue.indexOf(item) + 1;
  const total = state.queue.length;
  console.log(`   ${author === 'Endoxidev' ? '⭐' : '📥'} @${author} → queue #${pos}/${total}`);

  const quote = RANDOM_QUOTES[Math.floor(Math.random() * RANDOM_QUOTES.length)];
  const statusLine = (pos === 1 && state.currentlyProcessing) ? `**#1** — currently being built! 🔨` : `**#${pos}** of ${total}`;
  bgReply(state._projectAlias || 'opus48', comment.id,
    `⚠️ *Heads up — heavy work in progress!*\n\nYour spot in the generation queue: ${statusLine}. Please be patient!\n\n> ${quote}`);
}

async function handleAdminCommand(content, comment, state) {
  const cmd = content.trim().toLowerCase();
  const proj = state._projectAlias || 'opus48';
  const WIP = '⚠️ *Admin command received.*\n\n';

  if (cmd === '!clearqueue' || cmd === '!clear') {
    const count = state.queue.length;
    console.log(`   🔧 !clearqueue: clearing ${count} items...`);

    for (const item of state.queue) {
      state.entries[item.commentId] = { id: item.commentId, category: 'cleared', at: new Date().toISOString() };
    }
    state.currentlyProcessing = null;

    for (const item of state.queue) {
      bgReply(proj, item.commentId, `⚠️ *Build queue cleared by admin.*\n\nYour request (${item.content.slice(0, 60)}...) has been removed. Feel free to resubmit with a new comment!`);
      await new Promise(r => setTimeout(r, 1000));
    }

    state.queue = [];
    state.entries[comment.id] = { id: comment.id, category: 'admin', at: new Date().toISOString() };
    saveBotState(state);

    bgReply(proj, comment.id, `✅ **Queue cleared!** ${count} items removed, all ${count} users notified.\n\nComments marked as cleared won't re-process. Post new comments to re-enter the queue.`);
    console.log(`   🔧 Queue cleared: ${count} items removed + notified`);

  } else if (cmd === '!status') {
    const s = state.queue.length;
    const b = state.checklist.length;
    const cp = state.currentlyProcessing ? 'building' : 'idle';
    bgReply(proj, comment.id, `📊 **Status:** ${s} in queue | ${b} built | Currently: ${cp}`);
    state.entries[comment.id] = { id: comment.id, category: 'admin', at: new Date().toISOString() };
    console.log(`   🔧 !status: ${s} queued, ${b} built, ${cp}`);
  } else {
    console.log(`   ⚠️ Unknown admin command: ${cmd}`);
  }
}

async function announceQueuePositions(projectAlias, state) {
  if (state.queue.length === 0) return;
  const now = Date.now();
  const last = state.lastAnnounce ? new Date(state.lastAnnounce).getTime() : 0;
  if (now - last < CONFIG.queueAnnounceMs && state.queue.length > 0 && last > 0) return;

  console.log(`   📢 Announcing positions to ${state.queue.length} waiting...`);
  const WIP = '⚠️ *Heads up — heavy work in progress!*\n\n';

  for (let i = 0; i < state.queue.length; i++) {
    const item = state.queue[i];
    const quote = RANDOM_QUOTES[Math.floor(Math.random() * RANDOM_QUOTES.length)];
    const statusLine = (i === 0 && state.currentlyProcessing) ? `**#1** — currently being built! 🔨` : `**#${i + 1}** of ${state.queue.length}`;
    bgReply(projectAlias, item.commentId, `${WIP}Your spot in the generation queue: ${statusLine}. Please be patient!\n\n> ${quote}`);
    await new Promise(r => setTimeout(r, 1500));
  }

  state.lastAnnounce = new Date().toISOString();
  saveBotState(state);
}

async function processNextInQueue(projectAlias, state) {
  if (state.queue.length === 0 || state.currentlyProcessing) return;

  const item = state.queue.shift();
  state.currentlyProcessing = item.commentId;
  state.entries[item.commentId] = { id: item.commentId, category: 'processing', at: new Date().toISOString(), author: item.author, snippet: item.content.slice(0, 120) };
  saveBotState(state);

  announceQueuePositions(projectAlias, state).catch(() => {});

  console.log(`\n🛠️  Processing: @${item.author}: "${item.content.slice(0, 80)}..."`);

  const WIP = '⚠️ *Heads up — heavy work in progress! Pardon our dust.*\n\n';
  const comment = { id: item.commentId, content: item.content, raw_content: item.content, author: { username: item.author } };

  console.log('   🧠 Reasoning...');
  const decision = await triageComment(comment);
  const emojis = { feature_request:'✨', bug_fix:'🐛', ui_change:'🎨', content_change:'✏️', question:'❓', praise:'❤️', spam:'🗑️', abuse:'🚫', greeting:'👋', unclear:'🤷' };
  console.log(`   ${emojis[decision.category]||'📌'} ${decision.category} → ${decision.actionable ? 'BUILD' : 'PASS'}`);
  console.log(`   ↳ ${decision.reasoning}`);

  bgReply(projectAlias, item.commentId, WIP + (decision.decisionReply || (decision.actionable ? "Great idea! I'll build this now." : "Thanks for the comment!")));
  console.log('   💬 Decision reply sent.');

  if (decision.actionable && decision.editPrompt) {
    console.log('   🛠️  Building...');
    try {
      const { runAgent } = require('./agent-loop');
      const result = await runAgent(decision.editPrompt, projectAlias);
      state.checklist.push({ what: decision.editPrompt, category: decision.category, commentId: item.commentId, author: item.author, at: new Date().toISOString() });
      state.entries[item.commentId].built = result.ok;
      state.entries[item.commentId].builtAt = new Date().toISOString();
      bgReply(projectAlias, item.commentId, `${WIP}✅ Done! Refresh to see the changes.\n\n> ${decision.reasoning}\n\nLet me know if you want tweaks!`);
      console.log('   ✅ Build complete.');
    } catch (err) {
      console.error(`   ❌ Build failed: ${err.message}`);
      state.entries[item.commentId].buildError = err.message.slice(0, 200);
      bgReply(projectAlias, item.commentId, `${WIP}😅 Hit a snag: ${err.message.slice(0, 150)}. Moving on...`);
    }
  }

  state.currentlyProcessing = null;
  saveBotState(state);

  if (state.queue.length > 0) {
    console.log(`   📋 ${state.queue.length} remaining — announcing + processing next...`);
    announceQueuePositions(projectAlias, state).catch(() => {});
    await processNextInQueue(projectAlias, state);
  }
}

module.exports = { bgReply, addToQueue, handleAdminCommand, announceQueuePositions, processNextInQueue };
