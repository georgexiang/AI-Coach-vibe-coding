#!/usr/bin/env node
// PostToolUse hook: tracks tool call counts per session for statusline display

const fs = require('fs');
const path = require('path');
const os = require('os');

let input = '';
const timeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(timeout);
  try {
    const data = JSON.parse(input);
    const session = data.session_id || '';
    const toolName = data.tool_name || '';

    if (!session || !toolName || /[/\\]|\.\./.test(session)) {
      process.exit(0);
    }

    const trackFile = path.join(os.tmpdir(), `claude-tools-${session}.json`);

    let tracking = { counts: {}, last_tool: '', updated: 0 };
    try {
      if (fs.existsSync(trackFile)) {
        tracking = JSON.parse(fs.readFileSync(trackFile, 'utf8'));
      }
    } catch (e) {}

    // Normalize tool name (short form)
    const shortName = toolName.replace(/^mcp__[^_]+__/, '').replace(/Tool$/, '');
    tracking.counts[shortName] = (tracking.counts[shortName] || 0) + 1;
    tracking.last_tool = shortName;
    tracking.updated = Math.floor(Date.now() / 1000);

    fs.writeFileSync(trackFile, JSON.stringify(tracking));
  } catch (e) {
    // Silent fail
  }
});
