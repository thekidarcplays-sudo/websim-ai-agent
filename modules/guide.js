const fs = require('fs');
const nodePath = require('path');

let _claudeGuide = '';
function loadClaudeGuide() {
  if (_claudeGuide) return _claudeGuide;
  try { _claudeGuide = fs.readFileSync(nodePath.join(__dirname, '..', 'CLAUDE.md'), 'utf8'); }
  catch { _claudeGuide = ''; }
  return _claudeGuide;
}

module.exports = { loadClaudeGuide };
