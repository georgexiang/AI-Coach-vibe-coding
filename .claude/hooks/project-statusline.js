#!/usr/bin/env node
// Project Statusline: csa-ppt-plugin + context usage + tools tracking

const fs = require('fs');
const path = require('path');
const os = require('os');

// Discover csa-ppt version from plugin cache
function getCsaPptVersion() {
  const cacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'csa-skills', 'csa-ppt');
  try {
    if (fs.existsSync(cacheDir)) {
      const versions = fs.readdirSync(cacheDir)
        .filter(f => /^\d+\.\d+/.test(f))
        .sort()
        .reverse();
      if (versions.length > 0) return versions[0];
    }
  } catch (e) {}
  return 'unknown';
}

// Read tool call counts from tracking file
function getToolStats(session) {
  if (!session || /[/\\]|\.\./.test(session)) return '';
  const trackFile = path.join(os.tmpdir(), `claude-tools-${session}.json`);
  try {
    if (fs.existsSync(trackFile)) {
      const data = JSON.parse(fs.readFileSync(trackFile, 'utf8'));
      const counts = data.counts || {};
      const parts = [];
      for (const [tool, count] of Object.entries(counts)) {
        parts.push(`${tool}:${count}`);
      }
      if (parts.length > 0) {
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        // Show top 3 tools + total
        const top = parts.sort((a, b) => {
          const ca = parseInt(a.split(':')[1]);
          const cb = parseInt(b.split(':')[1]);
          return cb - ca;
        }).slice(0, 3);
        return `\x1b[36m${top.join(' ')} (${total})\x1b[0m`;
      }
    }
  } catch (e) {}
  return '';
}

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;

    // Plugin identity
    const version = getCsaPptVersion();
    const pluginLabel = `\x1b[1;35mcsa-ppt\x1b[0m \x1b[2mv${version}\x1b[0m`;

    // Context window (used percentage, normalized for autocompact buffer)
    const AUTO_COMPACT_BUFFER_PCT = 16.5;
    let ctx = '';
    if (remaining != null) {
      const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

      // Write bridge file for gsd-context-monitor compatibility
      const sessionSafe = session && !/[/\\]|\.\./.test(session);
      if (sessionSafe) {
        try {
          const bridgePath = path.join(os.tmpdir(), `claude-ctx-${session}.json`);
          fs.writeFileSync(bridgePath, JSON.stringify({
            session_id: session,
            remaining_percentage: remaining,
            used_pct: used,
            timestamp: Math.floor(Date.now() / 1000)
          }));
        } catch (e) {}
      }

      const filled = Math.floor(used / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

      if (used < 50) {
        ctx = `\x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 65) {
        ctx = `\x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 80) {
        ctx = `\x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = `\x1b[5;31m\uD83D\uDC80 ${bar} ${used}%\x1b[0m`;
      }
    }

    // Tools tracking
    const tools = getToolStats(session);

    // Assemble: csa-ppt v1.0.10 │ ████░░░░░░ 35% │ Read:5 Edit:2 (7)
    const parts = [pluginLabel];
    if (ctx) parts.push(ctx);
    if (tools) parts.push(tools);

    process.stdout.write(parts.join(' \x1b[2m\u2502\x1b[0m '));
  } catch (e) {
    // Silent fail
  }
});
