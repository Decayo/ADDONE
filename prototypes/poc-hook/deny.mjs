#!/usr/bin/env node
// POC-1 (logic). Question: does a PreToolUse hook actually block a file write on both
// Claude Code and Codex, and do both hosts honour the same deny shape?
// Disposable. Denies any tool call whose payload mentions a path under "forbidden/".
import { appendFileSync } from 'node:fs';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const hit = /forbidden\//.test(raw);
  const line = `${new Date().toISOString()} host=${process.env.POC_HOST || '?'} ${hit ? 'DENY ' : 'allow'} ${raw.replace(/\s+/g, ' ').slice(0, 400)}\n`;
  appendFileSync(process.env.POC_LOG || '/tmp/poc-hook.log', line);
  if (!hit) process.exit(0);
  const reason = 'ADDONE scope: forbidden/ is outside the active scope';
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    }),
  );
  process.stderr.write(reason + '\n');
  process.exit(2);
});
