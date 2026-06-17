const { callModel } = require('./model');
const { loadClaudeGuide } = require('./guide');

const TRIAGE_PROMPT = `You triage comments for a websim project. Decide if a comment is worth building.

Reply JSON ONLY:
{"category":"feature_request|bug_fix|ui_change|content_change|question|praise|spam|abuse|greeting|unclear","actionable":true/false,"reasoning":"why","decisionReply":"friendly public reply","editPrompt":"precise instructions if actionable"}

Default to actionable. Interpret vaguely but generously. Greetings → welcome + ask what to build. Questions → answer. Links-only → spam.`;

function extractCommentText(comment) {
  const raw = comment.raw_content || '';
  if (raw.trim()) return raw.trim();
  if (typeof comment.content === 'object' && comment.content?.children) {
    const parts = [];
    (function walk(nodes) { for (const n of nodes) { if (n.text) parts.push(n.text); if (n.children) walk(n.children); } })(comment.content.children);
    return parts.join(' ').trim();
  }
  return '';
}

async function triageComment(comment) {
  const content = extractCommentText(comment);
  const author = comment.author?.username || 'someone';
  const guide = loadClaudeGuide();
  const ctx = guide ? `\nPROJECT CONTEXT:\n${guide.slice(0, 3000)}` : '';
  const res = await callModel([
    { role: 'system', content: TRIAGE_PROMPT + ctx },
    { role: 'user', content: `From @${author}: ${content}` },
  ], []);
  try {
    const d = JSON.parse((res.choices?.[0]?.message?.content||'').replace(/```json|```/g, '').trim());
    return { category: d.category||'unclear', actionable: !!d.actionable, reasoning: d.reasoning||'', decisionReply: d.decisionReply||'', editPrompt: d.editPrompt||'' };
  } catch {
    return { category:'unclear', actionable:false, reasoning:'parse error', decisionReply:'', editPrompt:'' };
  }
}

module.exports = { extractCommentText, triageComment };
