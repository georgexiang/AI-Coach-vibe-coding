#!/usr/bin/env node
// Local project statusLine: GSD version | Model | Context usage (tokens)

const fs = require('fs');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);

    // --- GSD version ---
    const gsdHook = path.join(__dirname, 'hooks', 'gsd-statusline.js');
    let gsdVersion = '';
    if (fs.existsSync(gsdHook)) {
      const content = fs.readFileSync(gsdHook, 'utf8');
      const match = content.match(/gsd-hook-version:\s*([\d.]+)/);
      if (match) gsdVersion = match[1];
    }
    const gsdInfo = gsdVersion ? `GSD v${gsdVersion}` : 'GSD';

    // --- Model ---
    const model = data.model?.display_name || 'Claude';

    // --- Context usage ---
    const remaining = data.context_window?.remaining_percentage;
    let ctx = '';
    if (remaining != null) {
      const AUTO_COMPACT_BUFFER_PCT = 16.5;
      const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const usedPct = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

      // Progress bar (10 segments)
      const filled = Math.floor(usedPct / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

      // Color by usage
      if (usedPct < 50) {
        ctx = `\x1b[32m${bar} ${usedPct}%\x1b[0m`;
      } else if (usedPct < 65) {
        ctx = `\x1b[33m${bar} ${usedPct}%\x1b[0m`;
      } else if (usedPct < 80) {
        ctx = `\x1b[38;5;208m${bar} ${usedPct}%\x1b[0m`;
      } else {
        ctx = `\x1b[5;31m\u{1F480} ${bar} ${usedPct}%\x1b[0m`;
      }
    }

    // --- GSD update notice ---
    let gsdUpdate = '';
    const homeDir = require('os').homedir();
    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
    const sharedCache = path.join(homeDir, '.cache', 'gsd', 'gsd-update-check.json');
    const legacyCache = path.join(claudeDir, 'cache', 'gsd-update-check.json');
    const cacheFile = fs.existsSync(sharedCache) ? sharedCache : legacyCache;
    if (fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cache.update_available) gsdUpdate = '\x1b[33m\u2B06 update\x1b[0m \u2502 ';
      } catch (e) {}
    }

    // --- Output: [update] GSD vX.Y.Z | Model | context bar ---
    const parts = [`${gsdUpdate}\x1b[36m${gsdInfo}\x1b[0m`, `\x1b[2m${model}\x1b[0m`];
    if (ctx) parts.push(ctx);
    process.stdout.write(parts.join(' \u2502 '));
  } catch (e) {
    // Silent fail
  }
});
