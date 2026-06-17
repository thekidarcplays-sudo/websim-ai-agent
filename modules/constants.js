const fs = require('fs');
const nodePath = require('path');

const CONFIG = {
  baseUrl:   (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
  apiKey:    process.env.OPENAI_API_KEY || '',
  model:     'claude-opus-4-8-20260501',
  maxTurns:  parseInt(process.env.AGENT_MAX_TURNS || '15', 10),
  debug:     process.env.AGENT_DEBUG === 'true',
  watchIntervalMs: parseInt(process.env.AGENT_WATCH_INTERVAL_SECONDS || '10', 10) * 1000,
  queueAnnounceMs: 30000,
  botUsername: process.env.WEBSIM_BOT_USERNAME || 'Opus_4_8',
};

const RANDOM_QUOTES = [
  "Good things come to those who wait! 🌟",
  "Cooking up something special... 🍳",
  "The AI is thinking really hard right now! 🧠",
  "Quality takes time! ⏳",
  "Your patience is legendary! 👑",
  "Building with love and circuits... ❤️",
  "Rome wasn't built in a day! 🏛️",
  "Every masterpiece needs its time... 🎨",
  "Good code is worth the wait! 💻",
  "Hang tight, magic incoming! ✨",
];

function log(...args) { if (CONFIG.debug) console.error('[agent]', ...args); }

const PROJECTS_CONFIG_PATH = nodePath.join(__dirname, '..', 'projects.config.json');
function loadProjectsConfig() {
  try { return JSON.parse(fs.readFileSync(PROJECTS_CONFIG_PATH, 'utf8')); }
  catch { return { projects: {}, defaultProject: null }; }
}

module.exports = { CONFIG, RANDOM_QUOTES, log, loadProjectsConfig };
