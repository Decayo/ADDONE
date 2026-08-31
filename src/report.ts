/**
 * The pure half of `doctor`. Findings in, string out, no IO and no clock, so the whole
 * report can be tested without a machine to measure. Colour is a parameter rather than a
 * lookup at `process.stdout`, for the same reason.
 */
import type { Findings, Group, Row, RowState } from './types.ts';

/** Worse is higher. `unknown` sits under `warn`: nobody looked, which is not a problem yet. */
const SEVERITY: Record<RowState, number> = { ok: 0, unknown: 1, warn: 2, fail: 3 };
const MARK: Record<RowState, string> = { ok: '✓', unknown: '?', warn: '!', fail: '✗' };
const ANSI: Record<RowState, string> = { ok: '32', unknown: '90', warn: '33', fail: '31' };
const DIM = '90';
const RESET = '\x1b[0m';

const ROW_INDENT = '    ';
const FIX_INDENT = '      ';
/** `[✓] ` sits before a group title. */
const GROUP_PREFIX = '[x] '.length;
/** `    ✓ ` sits before a row label. */
const ROW_PREFIX = ROW_INDENT.length + '✓ '.length;
const MIN_LABEL_WIDTH = 10;

function paint(text: string, code: string, colour: boolean): string {
  return colour ? `\x1b[${code}m${text}${RESET}` : text;
}

/** A group reads as badly as its worst row. An empty group is fine by default. */
export function worst(rows: Row[]): RowState {
  return rows.reduce<RowState>((so_far, row) => (SEVERITY[row.state] > SEVERITY[so_far] ? row.state : so_far), 'ok');
}

function everyRow({ groups, can }: Findings): Row[] {
  return [...groups.flatMap((group) => group.rows), ...can];
}

/**
 * One column width for the whole report, so the eye can run down the labels across
 * groups instead of re-finding the column in each one.
 */
function labelWidth(findings: Findings): number {
  const longest = everyRow(findings).reduce((n, row) => Math.max(n, row.label.length), 0);
  return Math.max(MIN_LABEL_WIDTH, longest + 2);
}

/** `✓ label     detail · what it costs`. The consequence stays on the line it belongs to. */
function rowLine(row: Row, width: number, colour: boolean): string {
  const said = [row.detail, row.degraded].filter(Boolean).join(' · ');
  const mark = paint(MARK[row.state], ANSI[row.state], colour);
  return `${ROW_INDENT}${mark} ${row.label.padEnd(width)}${said}`.trimEnd();
}

function fixLine(indent: string, fix: string, colour: boolean): string {
  return `${indent}${paint(`→ ${fix}`, DIM, colour)}`;
}

function groupLines(group: Group, width: number, colour: boolean): string[] {
  const state = worst(group.rows);
  const head = `[${paint(MARK[state], ANSI[state], colour)}] ${group.title}`;
  // A summary starts in the same column as the details under it, so the group's count and
  // the rows it counts read down one line rather than two.
  const gap = Math.max(1, ROW_PREFIX + width - GROUP_PREFIX - group.title.length);
  const lines = [group.summary === undefined ? head : `${head}${' '.repeat(gap)}${group.summary}`];
  for (const row of group.rows) {
    lines.push(rowLine(row, width, colour));
    if (row.fix !== undefined) lines.push(fixLine(FIX_INDENT, row.fix, colour));
  }
  if (group.fix !== undefined) lines.push(fixLine(ROW_INDENT, group.fix, colour));
  return lines;
}

export function render(findings: Findings, colour = false): string {
  const width = labelWidth(findings);
  const blocks = [
    [`addone doctor · ${findings.root}`],
    ...findings.groups.map((group) => groupLines(group, width, colour)),
    ['addone can do here', ...findings.can.map((row) => rowLine(row, width, colour))],
  ];
  return `${blocks.map((block) => block.join('\n')).join('\n\n')}\n`;
}

/**
 * 0 when everything passes or is merely absent, 1 when something is present and broken.
 * An absent capability degrades the tool; it does not mean the run failed.
 */
export function exitCode(findings: Findings): 0 | 1 {
  return everyRow(findings).some((row) => row.state === 'fail') ? 1 : 0;
}
