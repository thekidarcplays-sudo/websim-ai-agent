const { CONFIG } = require('./constants');
const { mcpToolToOpenAI, getMcpClient, getMcpTools } = require('./mcp');
const { callModel } = require('./model');
const { loadClaudeGuide } = require('./guide');

async function runAgent(prompt, projectAlias) {
  const tools = getMcpTools().map(mcpToolToOpenAI);
  const guide = loadClaudeGuide();
  const guideSection = guide ? `\n\nGUIDE:\n${guide.slice(0, 3000)}\n` : '';
  const messages = [
    { role: 'system', content: `You edit a websim.com project. Use TOOLS — never describe changes in prose.

WORKFLOW:
1. list_revisions → find latest
2. create_revision(parent_version=latest) → draft
3. download_file → read contents
4. write_file → stage edits
5. upload_file → push
6. finish_revision → publish (MANDATORY!)
7. set_current_revision → make live
Stop and give 1-2 sentence summary.

Project: "${projectAlias || 'default'}". Always start with list_revisions.${guideSection}` },
    { role: 'user', content: prompt },
  ];

  console.log(`\n🤖 Building: "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`);

  const MUTATING = new Set(['upload_file', 'finish_revision', 'set_current_revision', 'delete_file', 'create_revision']);
  let edited = false, published = false, publishRetries = 0, writtenFiles = [];

  for (let turn = 0; turn < CONFIG.maxTurns; turn++) {
    const response = await callModel(messages, tools);
    const msg = response.choices?.[0]?.message;
    if (!msg) { console.log('⚠️ Empty response.'); break; }
    const toolCalls = msg.tool_calls || [];

    if (toolCalls.length === 0) {
      if (edited && !published && publishRetries < 3) {
        publishRetries++;
        console.log(`   ⚠️ Not published (retry ${publishRetries}/3)`);
        messages.push({ role: 'user', content: 'Call finish_revision then set_current_revision NOW. Do NOT download anything else.' });
        continue;
      }
      const summary = (msg.content || '').trim();
      if (summary) console.log(summary.slice(0, 400));
      messages.push({ role: 'assistant', content: summary });
      console.log(edited ? (published ? '✅ Published.' : '⚠️ Uploaded but not published.') : '⚠️ No changes.');
      return { ok: edited && published, summary, edited };
    }

    messages.push({ role: 'assistant', content: msg.content || null, tool_calls: toolCalls });

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args = {};
      try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}
      if (!args.project && projectAlias) args.project = projectAlias;

      if (name === 'write_file' && args.path) { writtenFiles.push(args.path); edited = true; }

      if (name === 'download_file' && args.path && writtenFiles.includes(args.path)) {
        console.log(`   ⚡ Auto-uploading ${args.path}...`);
        try {
          const uploadRes = await getMcpClient().callTool({ name: 'upload_file', arguments: { project: projectAlias, path: args.path, revision: args.revision } });
          const uploadText = uploadRes.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
          console.log(`   ↳ ${uploadText.slice(0, 200)}`);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: uploadText });
          messages.push({ role: 'user', content: `Uploaded ${args.path}. Now call finish_revision and set_current_revision.` });
          edited = true;
        } catch (err) { messages.push({ role: 'tool', tool_call_id: tc.id, content: `Error: ${err.message}` }); }
        continue;
      }

      if (MUTATING.has(name)) edited = true;
      if (name === 'finish_revision') published = true;
      console.log(`   🔧 ${name}(${JSON.stringify(args).slice(0, 100)})`);
      let result;
      try {
        const res = await getMcpClient().callTool({ name, arguments: args });
        result = res.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        console.log(`   ↳ ${result.slice(0, 200)}`);
      } catch (err) { result = `Error: ${err.message}`; console.error(`   ❌ ${err.message}`); }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
  }
  console.log(`⚠️ Max turns (${CONFIG.maxTurns}) reached.`);
  return { ok: edited && published, summary: '', edited };
}

module.exports = { runAgent };
