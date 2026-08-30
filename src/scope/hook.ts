/**
 * @arch.id     addone.core.scope
 * @arch.parent addone.core
 * @arch.role   guard
 */
// Turn a session's scope into allow or deny for one path. The hook entry point.
import { todo } from '../todo.ts';

/**
 * Paths a hook payload is about. The two hosts differ here and nowhere else:
 *   Claude Code  tool_input.file_path                      (Write, Edit, MultiEdit)
 *   Codex        tool_input.command holds the whole patch  (*** Add File: / *** Update File: / *** Delete File:)
 *   both         a Bash command may name paths; scan it for repo-relative tokens
 * TODO: parse JSON, branch on which field exists, return repo-relative paths.
 */
export function pathsOf(payload: string): string[] {
  return todo('pathsOf payload');
}

/**
 * Proven shape: prototypes/poc-hook/deny.mjs (POC-1, both hosts denied).
 * stdin → pathsOf → session.current → load scopes → check each path → verdict.
 *   allow: exit 0
 *   deny:  print {hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason}}
 *          to stdout, reason to stderr, exit 2. Same bytes work on both hosts.
 * No session file → exit 0 before reading anything else (invariant 5).
 */
export function main(): void {
  return todo('hook main');
}
