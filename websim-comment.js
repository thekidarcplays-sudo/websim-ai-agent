const crypto = require('crypto');

const API_BASE = 'https://websim.com/api/v1';

function headers(token, slug, extra = {}) {
  return {
    'accept': '*/*',
    'origin': 'https://websim.com',
    'referer': `https://websim.com/${slug}`,
    'authorization': `Bearer ${token}`,
    ...extra,
  };
}

async function postComment(content, projectId, projectSlug, token, parentCommentId = null) {
  const id = crypto.randomUUID();
  const payload = { id, content, source: 'api' };
  if (parentCommentId) payload.parent_comment_id = parentCommentId;
  const res = await fetch(`${API_BASE}/projects/${projectId}/comments`, {
    method: 'POST',
    headers: headers(token, projectSlug, { 'content-type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`postComment failed (${res.status}): ${text}`);
  return text;
}

async function postReply(parentCommentId, content, projectId, projectSlug, token) {
  return postComment(content, projectId, projectSlug, token, parentCommentId);
}

async function deleteComment(commentId, projectId, projectSlug, token) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: headers(token, projectSlug),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`deleteComment failed (${res.status}): ${text}`);
  return text || 'deleted';
}

async function listComments(limit, projectId, projectSlug, token) {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/comments?first=${limit}&sort_by=created_at&only_video=false`,
    { headers: headers(token, projectSlug) }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`listComments failed (${res.status}): ${text}`);
  const data = JSON.parse(text);
  return (data.comments?.data || []).map((d) => d.comment);
}

async function listCommentReplies(commentId, limit, projectId, projectSlug, token) {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/comments/${commentId}/replies?last=${limit}`,
    { headers: headers(token, projectSlug) }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`listCommentReplies failed (${res.status}): ${text}`);
  const data = JSON.parse(text);
  return (data.comments?.data || []).map((d) => d.comment);
}

module.exports = { postComment, postReply, deleteComment, listComments, listCommentReplies };
