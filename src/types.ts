/**
 * The shapes `doctor` passes from measurement to rendering. Nothing here touches the
 * filesystem or a process: `doctor.ts` produces these, `report.ts` consumes them.
 */

/**
 * How one row reads.
 *
 * `unknown` is not a failure. It means nobody has established this field yet, so the
 * honest thing to print is a question mark rather than a guess. A group is never failed
 * by an `unknown` row.
 */
export type RowState = 'ok' | 'warn' | 'fail' | 'unknown';

export interface Row {
  /** The left column. Padded to a common width across the whole report. */
  label: string;
  /** What was measured. Omitted when the label says everything. */
  detail?: string;
  state: RowState;
  /**
   * For `warn` only: what stops working because this is absent. Rendered on the same
   * line, because an absent capability and its consequence belong together.
   */
  degraded?: string;
  /** One line the reader can paste into a shell. Rendered under the row. */
  fix?: string;
}

export interface Group {
  /** The subsystem: machine, agent hosts, editor, browser, state. */
  title: string;
  /** A one-line count or summary, printed beside the title. */
  summary?: string;
  rows: Row[];
  /** Advice for the group as a whole, when repeating it per row would be noise. */
  fix?: string;
}

export interface Findings {
  /** The directory the report was taken in. */
  root: string;
  groups: Group[];
  /** The closing block: what `addone` can do in this repo right now. */
  can: Row[];
}
