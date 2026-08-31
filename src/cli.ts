#!/usr/bin/env node
/**
 * The entry npm's bin shim points at. Node runs TypeScript directly, so there is no
 * build step and this file is what ships.
 */
import { doctor, findRoot } from './doctor.ts';
import { render, exitCode } from './report.ts';
import { SILENT, ticker, wantsProgress } from './progress.ts';

const USAGE = `addone <command>

  doctor [--json] [--no-progress]   measure this machine and say what addone can do here
`;

/**
 * Colour when a person is reading and has not asked for plain text. `NO_COLOR` and
 * `FORCE_COLOR` are the conventions other tools already follow, so a pipeline or a CI log
 * comes out clean without a flag of ours.
 */
function wantsColour(): boolean {
  const forced = process.env.FORCE_COLOR;
  if (forced !== undefined && forced !== '' && forced !== '0') return true;
  const off = process.env.NO_COLOR;
  if (off !== undefined && off !== '') return false;
  return process.stdout.isTTY === true;
}

async function doctorCommand(args: string[]): Promise<number> {
  const watch = wantsProgress(args) ? ticker() : undefined;
  try {
    const findings = await doctor(findRoot(), watch ?? SILENT);
    // The line is erased before the first byte of the report, so nothing overlaps.
    watch?.stop();
    process.stdout.write(
      args.includes('--json') ? `${JSON.stringify(findings, null, 2)}\n` : render(findings, wantsColour()),
    );
    return exitCode(findings);
  } finally {
    watch?.stop();
  }
}

const COMMANDS: Record<string, (args: string[]) => Promise<number>> = { doctor: doctorCommand };

export async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  if (command === undefined || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  // hasOwn, so `constructor` and `toString` are unknown words rather than something to call.
  if (!Object.hasOwn(COMMANDS, command)) {
    process.stderr.write(`addone: no command ${command}\n${USAGE}`);
    return 1;
  }
  try {
    return await COMMANDS[command](args);
  } catch (error) {
    process.stderr.write(`addone: ${(error as Error).message}\n`);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
