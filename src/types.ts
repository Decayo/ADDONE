/**
 * @arch.id     addone.core
 * @arch.parent addone
 * @arch.role   system
 */
// src/: the TypeScript core, run directly on Node.
/** Stable dotted id with a parent chain: "addone.core.state". CONTEXT.md: Architecture Address. */
export type Address = string;

export type Kind = 'system' | 'actor' | 'module' | 'store' | 'guard' | 'surface' | 'document';

/** Where a node is in the loop. Todo derives from this; it is never stored separately. */
export type Phase = 'architecture' | 'skeleton' | 'implementing' | 'reconciled';

/** How much engineering guarantee a region needs. A skill decides how to meet it. */
export type Assurance = 'low' | 'standard' | 'critical';

/** The model's node. No layout here: positions belong to a View, which is its own SSOT. */
export interface Entity {
  kind: Kind;
  parent: Address | null;
  /** One sentence. Section 55. */
  intent: string;
  /** Absent means "not ours to build" (an actor, an external host). Todo skips it. */
  phase?: Phase;
  assurance?: Assurance;
}

/** Invariant 6: one relation, one object, reviewed on its own. */
export interface Relation { from: Address; to: Address; kind: string }
export interface Forbidden { from: Address; to: Address; reason: string }

/**
 * Binding from an address to a file and symbol. The agent maintains it.
 * `hash` is the content hash of the anchored line at the last sync; a mismatch is the
 * yellow badge, a match the green one. Sync refreshes it; never a human.
 */
export interface Anchor { file: string; symbol?: string; line?: number; hash?: string }

/** Markdown is auxiliary. A doc reference points into a file, at a heading or a line. */
export interface DocRef { file: string; section?: string; line?: number }

/** Compiled into each host's PreToolUse hook. Globs, repo-relative. */
export interface Scope { write: string[]; read: string[]; requires_approval: string[] }

/** Every stage of the loop is a slot. The `open` slot holds one route per destination. */
export type RouteName = 'editor' | 'browser' | 'surface';

export type SlotName =
  | 'surface' | 'host' | 'install' | 'stateMode' | 'writePath' | 'render' | 'watch' | 'enforce' | 'evidence' | 'open';
export type SlotProgress = 'unchosen' | 'chosen' | 'installed' | 'verified';
export interface Slot {
  choice: string;
  options: string[];
  progress: SlotProgress;
  evidence?: string;
  /** `open` only: one entry per route. Placeholders are `{path}` (repo-relative),
   *  `{line}`, `{symbol}`, `{url}`, `{repoRoot}`. An absolute path is never formatted. */
  routes?: Record<RouteName, Record<string, string>>;
}
export interface Config { version: 0; slots: Record<SlotName, Slot> }

/** The LAST panel. Written by apply, in the same step as the mutation. Section 42 change types. */
export interface Last {
  at: string;
  type: 'implementation' | 'contract' | 'architecture' | 'policy';
  address?: Address;
  what: string;
}

/**
 * Invariant 1: the model, one file, with the final key names. `docs` was added later.
 * Views and decisions are their own files and their own SSOTs; they are not in here.
 */
export interface State {
  version: 0;
  project: { name: string; defaults: { assurance: Assurance }; decisions?: string };
  entities: Record<Address, Entity>;
  relations: Relation[];
  forbidden: Forbidden[];
  anchors: Record<Address, Anchor[]>;
  scopes: Record<Address, Scope>;
  docs: Record<Address, DocRef[]>;
  last?: Last;
}

/**
 * One diagram, one file under .addone/views/, renderer-neutral. The agent authors the layout.
 * A view never adds topology: every node it names must exist in the model, or validate
 * marks the view dirty. `map` shows model nodes at positions; `attached` carries an authored
 * body in a declared format. Converting a body between renderers is out of the first slice.
 */
export type ViewId = string;
export type ViewKind = 'map' | 'attached';
export type DiagramType = 'architecture' | 'sequence' | 'lifecycle' | 'dataflow' | 'workflow';
export interface View {
  id: ViewId;
  kind: ViewKind;
  /** The node this view belongs to. In the tree it appears under that node. */
  address: Address;
  type: DiagramType;
  title: string;
  /** map only: which model nodes are shown, and where. Boundaries come from their parents. */
  nodes?: Record<Address, { row: number; col: number }>;
  /** attached only. */
  body?: { format: 'archify-v1' | 'mermaid'; source: unknown };
  /** Views that are not children but worth a jump: an api service's sequence, for example. */
  related?: ViewId[];
}

/** An open decision is state, one file under .addone/decisions/, counted up the tree. */
export interface Decision {
  id: string;
  feature: string;
  address?: Address;
  status: 'open' | 'settled';
  question: string;
  options?: string[];
  chosen?: string;
  reason?: string;
}

/** Everything load() returns. State is the model; views and decisions are their own SSOTs. */
export interface Workspace {
  state: State;
  views: Record<ViewId, View>;
  decisions: Decision[];
  config: Config;
}

/** What select() hands to render: the smallest slice one task needs. Section 16, 17. */
export interface SubState {
  focus: Address;
  breadcrumb: Address[];
  depth: number;
  entities: Record<Address, Entity>;
  relations: Relation[];
  forbidden: Forbidden[];
  anchors: Record<Address, Anchor[]>;
  docs: Record<Address, DocRef[]>;
  /** Views on the focus and its subtree, plus their related views. */
  views: View[];
  /** Open decisions in the subtree. The wait-list count, which cascades up the tree. */
  open: number;
  scope?: Scope;
  last?: Last;
}

/**
 * The second layer: what the append step paints onto a rendered map. Derived from the workspace
 * and git at render time; never stored. POC-3 proved every field lands without a fork.
 */
/** A third state beside match and drift. The file is gone, so the badge is red and no link is emitted. */
export type AnchorState = 'match' | 'drift' | 'missing';

/** What a click means. A link is a kind plus a target; the route's adapter decides how to open it. */
export type LinkKind = 'code' | 'doc' | 'commit' | 'pr' | 'issue' | 'view';
export interface Link {
  kind: LinkKind;
  /** Repo-relative for code and doc; a URL for commit, pr, issue; a view id for view. */
  target: string;
  line?: number;
  symbol?: string;
}

export interface Layer {
  phases: Record<Address, Phase | undefined>;
  anchors: Record<Address, Array<Anchor & { state: AnchorState }>>;
  links: Record<Address, Array<{ label: string } & Link>>;
  /** Open decisions per node, for the grey semi-transparent mark. */
  open: Record<Address, number>;
}

/** Exports come from the canonical artifact only, never from the appended page. */
export type ExportFormat = 'json' | 'png' | 'svg';

/** `cli apply` is the only way state changes. This list is the whole vocabulary of the skill. */
export type Mutation =
  | { op: 'add-entity'; id: Address; entity: Entity }
  | { op: 'move-entity'; id: Address; parent: Address }
  | { op: 'remove-entity'; id: Address }
  | { op: 'add-relation'; relation: Relation }
  /** `kind` is optional: leave it out only when the pair carries exactly one relation. */
  | { op: 'remove-relation'; relation: Pick<Relation, 'from' | 'to'> & { kind?: string } }
  | { op: 'add-forbidden'; forbidden: Forbidden }
  | { op: 'set-phase'; id: Address; phase: Phase }
  | { op: 'set-scope'; id: Address; scope: Scope }
  | { op: 'set-anchors'; id: Address; anchors: Anchor[] }
  | { op: 'add-doc'; id: Address; doc: DocRef }
  | { op: 'set-view'; view: View }
  | { op: 'remove-view'; id: ViewId }
  | { op: 'open-decision'; decision: Decision }
  | { op: 'settle-decision'; id: string; chosen: string; reason: string };

/** CONTEXT.md: Rule kind. An invariant is an error, a policy fails CI, a smell opens a GRILL. */
export interface Diagnostic {
  code: string;
  severity: 'error' | 'policy' | 'smell';
  subject: Address | string;
  message: string;
}

export type Verdict = { allow: true } | { allow: false; reason: string };

/** A session either has an active scope or no guard at all. Invariant 5. */
export interface Session { address: Address; since: string }
