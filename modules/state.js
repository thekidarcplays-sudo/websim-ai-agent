const fs = require('fs');
const nodePath = require('path');

const BOT_STATE_PATH = nodePath.join(__dirname, '..', 'comment-bot-seen.json');

function loadBotState() {
  try {
    const s = JSON.parse(fs.readFileSync(BOT_STATE_PATH, 'utf8'));
    s.entries = s.entries || {};
    s.queue = s.queue || [];
    s.checklist = s.checklist || [];
    return s;
  } catch {
    return { entries: {}, queue: [], checklist: [], currentlyProcessing: null, lastAnnounce: null, lastRun: null };
  }
}
function saveBotState(state) { fs.writeFileSync(BOT_STATE_PATH, JSON.stringify(state, null, 2)); }

module.exports = { loadBotState, saveBotState };
