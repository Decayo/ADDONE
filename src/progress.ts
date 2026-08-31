/**
 * Feedback while `doctor` measures. Three probes dominate the wall clock on a normal
 * machine (`code --status` ~2.7s, `gemini --version` ~1.5s, `opencode --version` ~0.5s),
 * and a terminal that prints nothing for that long reads as hung. Miller's 1968 limits,
 * still the ones everyone cites: under one second and thought is unbroken, past that it
 * needs a sign of life.
 *
 * One line at the bottom, rewritten in place, naming what is still running, so the reader
 * sees not only that work is happening but which probe is the slow one.
 */
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
/** Return to column 0 and erase to the end. Never a cursor-up: a wrapped line occupies
 *  two rows and moving up one would overwrite the wrong text. */
const CLEAR_LINE = '\r\x1b[K';
const TICK_MS = 80;

/** What a probe reports to. `SILENT` is the whole interface when nobody is watching. */
export interface Watch {
  /** Announce a running probe. Call the returned function when it finishes. */
  start(label: string): () => void;
}

export const SILENT: Watch = { start: () => () => {} };

/**
 * Animation belongs to a person at a terminal. A pipe, a file, a CI log, a screen reader
 * and `--json` all want the text and nothing else. This is separate from `NO_COLOR`,
 * which governs colour and says nothing about motion.
 */
export function wantsProgress(argv: string[]): boolean {
  if (argv.includes('--no-progress') || argv.includes('--json')) return false;
  const ci = process.env.CI;
  if (ci !== undefined && ci !== '' && ci !== '0') return false;
  if (process.env.TERM === 'dumb') return false;
  return process.stdout.isTTY === true;
}

export interface Ticker extends Watch {
  /** Erase the line and give the cursor back. Safe to call twice. */
  stop(): void;
}

export function ticker(): Ticker {
  const running = new Set<string>();
  let frame = 0;
  let live = true;

  const draw = (): void => {
    if (running.size === 0) return;
    const width = (process.stdout.columns ?? 80) - 1;
    const line = `${FRAMES[frame++ % FRAMES.length]} measuring ${[...running].join(', ')}`;
    process.stdout.write(CLEAR_LINE + line.slice(0, Math.max(0, width)));
  };

  const stop = (): void => {
    if (!live) return;
    live = false;
    clearInterval(timer);
    process.stdout.write(CLEAR_LINE + SHOW_CURSOR);
  };

  process.stdout.write(HIDE_CURSOR);
  const timer = setInterval(draw, TICK_MS);
  // The report, not the animation, decides when the process may end.
  timer.unref();
  // A hidden cursor that survives the process is a broken terminal, so give it back on
  // the way out however we leave.
  process.once('SIGINT', () => {
    stop();
    process.exit(130);
  });
  process.once('exit', stop);

  return {
    start(label) {
      running.add(label);
      return () => running.delete(label);
    },
    stop,
  };
}
