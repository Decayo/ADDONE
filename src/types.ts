/**
 * @arch.id     addone.core
 * @arch.parent addone
 * @arch.role   system
 */
// src/: the TypeScript core, run directly on Node.
/** Stable dotted id with a parent chain: "addone.core.state". CONTEXT.md: Architecture Address. */
export type Address = string;

export type Kind = 'system' | 'actor' | 'module' | 'store' | 'guard' | 'surface' | 'document';

/** Decision [J]. Todo derives from this; it is never stored separately. */
export type Phase = 'architecture' | 'skeleton' | 'implementing' | 'reconciled';

/** How much engineering guarantee a region needs. A skill decides how to meet it. */
export type Assurance = 'low' | 'standard' | 'critical';

export interface Entity {
  kind: Kind;
  parent: Address | null;
  /** One sentence. Section 55. */
  intent: string;
  /** Absent means "not ours to build" (an actor, an external host). Todo skips it. */
  phase?: Phase;
  assurance?: Assurance;
  /** Decision [N]: authored by the agent, stored here, read by render. */
  layout?: { row: number; col: number };
}

/** Invariant 6: one relation, one object, reviewed on its own. */
export interface Relation { from: Address; to: Address; kind: string }
export interface Forbidden { from: Address; to: Address; reason: string }

/** Binding from an address to a file and symbol. The agent maintains it. */
export interface Anchor { file: string; symbol?: string; line?: number }

/** Decision [B] and [J] step 7: compiled into the host hook. Globs, repo-relative. */
export interface Scope { write: string[]; read: string[]; requires_approval: string[] }

/** Decision [M]: every stage of the loop is a slot. */
export type SlotName = 'host' | 'install' | 'stateMode' | 'writePath' | 'render' | 'watch' | 'enforce' | 'evidence';
export type SlotProgress = 'unchosen' | 'chosen' | 'installed' | 'verified';
export interface Slot { choice: string; options: string[]; progress: SlotProgress; evidence?: string }
export interface Config { version: 0; slots: Record<SlotName, Slot> }

/** The LAST panel. Written by apply, in the same step as the mutation. Section 42 change types. */
export interface Last {
  at: string;
  type: 'implementation' | 'contract' | 'architecture' | 'policy';
  address?: Address;
  what: string;
}

/** Invariant 1: the only source of truth. One file today (decision [E]); keys are final. */
export interface State {
  version: 0;
  project: { name: string; defaults: { assurance: Assurance }; decisions?: string };
  entities: Record<Address, Entity>;
  relations: Relation[];
  forbidden: Forbidden[];
  anchors: Record<Address, Anchor[]>;
  scopes: Record<Address, Scope>;
  last?: Last;
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
  scope?: Scope;
  last?: Last;
}

/** Decision [H]: the only way state changes. The list is the whole vocabulary of the skill. */
export type Mutation =
  | { op: 'add-entity'; id: Address; entity: Entity }
  | { op: 'move-entity'; id: Address; parent: Address }
  | { op: 'remove-entity'; id: Address }
  | { op: 'add-relation'; relation: Relation }
  | { op: 'remove-relation'; relation: Pick<Relation, 'from' | 'to'> }
  | { op: 'add-forbidden'; forbidden: Forbidden }
  | { op: 'set-phase'; id: Address; phase: Phase }
  | { op: 'set-layout'; id: Address; layout: { row: number; col: number } }
  | { op: 'set-scope'; id: Address; scope: Scope }
  | { op: 'set-anchors'; id: Address; anchors: Anchor[] }
  | { op: 'record-decision'; feature: string; decision: string; body: string };

/** CONTEXT.md: Rule kind. An invariant is an error, a policy fails CI, a smell opens a GRILL. */
export interface Diagnostic {
  code: string;
  severity: 'error' | 'policy' | 'smell';
  subject: Address | string;
  message: string;
}

export type Verdict = { allow: true } | { allow: false; reason: string };

/** Decision [J]: a session either has an active scope or no guard at all. Invariant 5. */
export interface Session { address: Address; since: string }
