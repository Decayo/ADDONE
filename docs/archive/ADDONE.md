> **Archived 2026-08-29.** Vision v0.2, frozen at this text. The living state is
> `CONTEXT.md` (vocabulary, invariants) and `docs/decisions/` (what is settled). Read
> this file for the reasoning behind a primitive, never for what to build next.

# ADDONE
## Architecture-Driven Development for Human–Agent Software Engineering

> **Status:** Vision / Exploration  
> **Version:** v0.2  
> **Working name:** ADDONE
>
> 本文件描述 ADDONE 的核心問題、方法論、抽象與產品方向。
>
> 它不是最終 schema，也不是 implementation spec。
>
> 核心問題只有一個：
>
> **如果 Architecture 不再只是開會後留下的圖，而是 Human、Agent、Code 共同維護的一級工程資產，軟體開發流程會變成什麼樣子？**

---

# 1. Problem

今天軟體團隊真正的開發流程通常是：

```text
Requirement
    ↓
Meeting
    ↓
Architecture Discussion
    ↓
Whiteboard / FigJam / Mermaid
    ↓
Implementation Plan
    ↓
Code
    ↓
Pull Request
    ↓
Architecture documentation slowly diverges
```

真正重要的問題通常發生在前面：

- 這個功能屬於哪裡？
- 誰擁有這個責任？
- 哪些 Component 可以互相知道？
- 哪些 Dependency 是禁止的？
- Folder Structure 應該怎麼長？
- Interface 應該在哪裡？
- 是否需要新的 Abstraction？
- 這次改動是 Implementation Change、Contract Change，還是 Architecture Change？
- 哪些地方可以讓 Agent 自由發揮？
- 哪些地方必須提高驗證與 Review 強度？

但現在 Coding Agent 最常做的是：

```text
search
read
grep
read
edit
edit
edit
```

最後交給工程師：

```text
+ 18 files
+ 742 lines
```

工程師反而被迫下降到 implementation-level 去 reconstruct：

> Agent 到底做了什麼？

---

# 2. Discovery Tax

Coding Agent 還有另一個隱性成本：

# **Discovery Tax**

每個新的 Session 都可能重新：

```text
ls
 ↓
grep
 ↓
read
 ↓
follow imports
 ↓
guess domain boundaries
 ↓
guess folder conventions
 ↓
guess responsibilities
 ↓
finally understand the task
```

最昂貴、能力最強的模型額度，很大一部分浪費在：

> 「這個 Repository 到底在幹嘛？」

而下一個 Session 又可能重新做一次。

ADDONE 希望把這些已經被理解、討論與決定過的資訊：

```text
Human Decisions
Code Evidence
Git History
Contracts
Rules
Architecture
```

編譯成：

# **Compiled Architectural Context**

讓 Agent 一開始就知道：

```text
Where am I?

What does this component mean?

What does it depend on?

What must remain true?

What is unfinished?

What am I allowed to change?

What decisions are still unresolved?
```

---

# 3. Vision

Architecture 不應只是 Documentation。

Architecture 應該成為：

# **Development Interface**

Human 透過 Architecture 表達：

```text
Intent
Ownership
Responsibility
Constraints
Trade-offs
Risk
Decisions
```

Agent 負責：

```text
Repository exploration
Bookkeeping
Signal maintenance
Skeleton generation
Implementation
Context compilation
Anchor synchronization
Diff analysis
Reconciliation
```

核心分工：

> **Human owns architectural intent.**  
> **Agent owns architectural bookkeeping and implementation work.**

---

# 4. Architecture-Driven Development

暫稱這套 Workflow：

# **Architecture-Driven Development**

ADDONE 是其工具與實驗載體。

它不是：

```text
Architecture → blind code generation
```

也不是傳統 Low-Code 或 Model-Driven Development。

它是一個 Loop：

```text
Requirement
    ↓
Architecture Context
    ↓
GRILL
    ↓
Architecture Decisions
    ↓
Physical Structure
    ↓
Semantic Skeleton
    ↓
Spec / Tasks
    ↓
Scoped Implementation
    ↓
Evidence
    ↓
Reconciliation
```

類似 TDD：

```text
Test
 ↓
Code
 ↓
Refactor
```

ADDONE 對 Architecture 的 Loop 是：

```text
Intent
 ↓
Architecture
 ↓
Structure
 ↓
Code
 ↓
Evidence
 ↓
Reconcile
```

---

# 5. Greenfield Is the Native Workflow

很多 Code Intelligence 工具的前提是：

> Codebase 已經存在。

例如：

```text
Code
 ↓
AST / Graph / Index
 ↓
Understanding
```

但很多最重要的 Architecture Decision 發生時：

**根本還沒有 Code。**

因此 ADDONE 最自然的場景其實是 Greenfield：

```text
Requirement
 ↓
GRILL
 ↓
Architecture
 ↓
Skeleton
 ↓
Code
```

Architecture precedes implementation.

---

# 6. Existing Codebase Is Reconstruction

Existing Project 則走：

```text
Code
 ↓
Evidence Providers
 ↓
Architecture Hypotheses
 ↓
GRILL
 ↓
Human Correction
 ↓
Architecture State
```

這是一個：

# **Architecture Reconstruction**

流程，而不是 ADDONE 的唯一核心。

---

# 7. Evidence Providers

ADDONE 不需要自己重寫所有 Code Intelligence。

以下都可以只是 Evidence Adapter：

```text
grep / search
Git history
Git diff
GitNexus
AST tools
LSP
dependency analyzers
test results
runtime telemetry
OpenTelemetry
Kubernetes
```

概念：

```text
GitNexus ─────┐
AST ──────────┤
Git ──────────┤
grep ─────────┼──→ Evidence
Telemetry ────┤
              ↓
            ADDONE
```

ADDONE Core 關心的是：

> 這些 Evidence 對 Architecture Intent 代表什麼？

而不是自己成為 Polyglot Static Analysis Platform。

---

# 8. Code Is Evidence, Not Truth

Code 不等於 Architecture。

Code 是 Observed Reality 的其中一種 Evidence。

Architecture System 至少存在：

```text
Intended
Observed
Proposed
Historical
```

例如：

```text
INTENDED

Checkout → Payment
```

Observed：

```text
Checkout → Payment
Checkout → Fraud
```

Proposed：

```text
Checkout → RiskGateway → Fraud
         ↓
       Payment
```

最後 Human 要決定：

> Architecture 應該更新？

還是：

> Code 違反了原本的 Intent？

---

# 9. Git Is Also an Evidence Carrier

Architecture Context 不只能存在 Source Comment 或 JSON。

Git 本身也承載：

```text
Commit messages
PR descriptions
Rename history
Architecture diff
Decision history
Author intent
```

例如：

```text
Split payment capture from checkout orchestration.

Reason:
Capture now has independent retry and settlement semantics.
```

這是非常有價值的 Architectural Evidence。

---

## Why Git Is Not the Primary Anchor

Git 很適合回答：

> Why did this become this way?

但 Agent 常常只：

```text
grep
read 50 lines
edit
```

未必會主動追 Git History。

因此 Current Meaning 還是需要更直接的 Architecture Context 或 Signal。

---

# 10. Architecture Signals

Architecture Signal 不是為了重新描述所有 Code。

它只提供：

# **Semantic Landmarks**

例如：

```ts
/**
 * @arch.id billing.capture
 * @arch.parent billing
 * @arch.role application-service
 */
export class CapturePayment {}
```

當 Agent：

```text
grep @arch
```

可以快速看到高價值 Architecture Anchor。

---

# 11. Signals Are Optional Acceleration

`@arch` 不是 Mandatory Requirement。

ADDONE 應支援至少三種模式。

---

## Inline Mode

```ts
/**
 * @arch.id identity.session
 */
export class SessionService {}
```

優點：

```text
fast grep
stable semantic breadcrumb
partial-context friendly
code and architecture evolve together
```

這是推薦模式。

最重要的原因：

> **Inline signals preserve architectural meaning inside the smallest context window an agent is likely to read.**

---

## Sidecar Mode

不修改 Production Source：

```text
.addone/
  anchors.json
```

例如：

```json
{
  "identity.session": {
    "file": "src/identity/session.ts",
    "symbol": "SessionService"
  }
}
```

適合：

- Coding Guideline 禁止額外 Comment
- Generated Code
- Legacy Code
- 需要保持 Source 極度乾淨

---

## Local / Ephemeral Mode

如果團隊不願意 Commit Architecture State，可以使用：

```text
.addone.local/
```

並 Git Ignore。

仍然提供：

```text
local architecture view
local planning
local reconstruction
local agent navigation
```

但失去：

```text
shared architecture state
CI enforcement
PR architecture diff
persistent decisions
cross-developer synchronization
```

---

# 12. Architecture Signals Are Compiled Decisions

傳統 Annotation Tax 的假設是：

> 工程師手動維護 Metadata。

ADDONE 的假設不同：

```text
Human + Agent Discussion
        ↓
Architecture Decision
        ↓
Agent compiles decision
        ↓
signal / sidecar / rule / anchor
```

因此：

# **Architecture Signals are compiled architectural decisions.**

Human 負責：

> 「對，Capture 就屬於 Billing。」

Agent 負責：

```text
add signal
update anchor
update architecture state
update affected projection
```

AI 時代讓這類 bookkeeping 成本顯著降低。

---

# 13. Skill, Project State, and Runtime Enforcement

必須分開三件事情。

---

## Skill = Usage Protocol SSOT

Skill 定義：

```text
如何 init
如何 context
如何 grill
如何 plan
如何 skeleton
如何 scope
如何 implement
如何 reconcile
如何 carve
```

也就是：

> **How ADDONE is used.**

它是使用方法與 Workflow Protocol 的 SSOT。

---

## `.addone/` = Project Architecture State

它記錄：

> **This project has decided what?**

例如：

```text
architecture
contracts
anchors
rules
decisions
scopes
views
profiles
```

這才是 Project Persistent State。

---

## Hook / Runtime = Enforcement

Skill 說明：

> 應該怎麼做。

Hook / Runtime 確保：

> 關鍵規則真的有被執行。

例如：

```text
scope guard
pre-edit check
architecture context preload
post-change reconciliation
```

---

# 14. Session-Scoped Activation

Architecture Workflow 不應污染所有 Agent Conversation。

如果使用者只是純討論：

```text
Explain repository pattern
```

不應突然觸發：

```text
ARCHITECTURE SCOPE VIOLATION
```

因此 Enforcement 應：

```text
explicitly activated
session scoped
project aware
```

例如第一次：

```text
/addone-plan
```

後：

```text
✓ Architecture state loaded
✓ Project mode detected
✓ Scope hook enabled
✓ Reconciliation enabled
```

---

# 15. Skill Tells; Hooks Guarantee

簡化：

```text
Skill
=
How to behave

Hooks
=
Ensure critical behavior happens

Project State
=
What the project currently means
```

---

# 16. CONTEXT

ADDONE 的第零 Primitive：

# **CONTEXT**

目的：

> Compile the smallest relevant architectural context for the current task.

例如：

```text
addone context payment.jp.sms
```

輸出：

```text
PAYMENT.JP.SMS

Purpose
  Handle Japan SMS verification fallback.

Parent
  payment.jp-verification

Children
  unicode-normalization

Contracts
  sms-verification

Allowed dependencies
  payment-provider
  fraud

Forbidden
  identity.persistence

Engineering profile
  assurance: medium
  coding profile: project-default

Anchors
  JapanSmsVerifier

Status
  Architecture approved
  Implementation incomplete

Recent decisions
  ADR-018

Open questions
  Provider retry ownership
```

Agent 不需要先讀整個 Repository。

---

# 17. Context Compression

Architecture Hierarchy 不只是畫圖。

它也是：

# **Context Compression**

例如：

```text
payment
├── authorization
├── capture
└── refund
```

便宜模型：

```text
context payment --depth 1
```

只看整體。

真正工作在 Capture：

```text
context payment.capture --depth 3
```

才展開：

```text
contracts
rules
anchors
history
scope
risk
```

這使 Semantic Zoom 同時成為 Context Budget Control。

---

# 18. Architecture Address

每個 Architecture Entity 應該有：

# **Semantic Address**

例如：

```text
User
→ Payment
→ Country Verification
→ SMS Workaround
→ Unicode Conversion
```

這不同於：

```text
src/payment/jp/sms/utils/unicode.ts
```

Filesystem Path 告訴你：

> Code 在哪。

Architecture Address 告訴你：

> **這段 Code 在整個系統中代表什麼。**

---

# 19. Stable ID + Parent

JSON 不應使用巨大 Nested Tree：

```json
{
  "user": {
    "payment": {
      "verification": {
        "sms": {
          "unicode": {}
        }
      }
    }
  }
}
```

應使用 Stable ID：

```json
{
  "id": "payment.jp.sms.unicode",
  "parent": "payment.jp.sms"
}
```

Renderer 再重建：

```text
Payment
└── Japan Verification
    └── SMS
        └── Unicode
```

好處：

- relocation Git diff 小
- stable references
- history 可追
- PR breadcrumb 穩定
- deep module 可逐層回溯

---

# 20. Architecture Reconstruction

Existing Repo `init` 不應直接：

```text
AI scans repo
→ confidently generates diagram
```

而應：

```text
Repository
 ↓
Explore likely structure
 ↓
Generate hypotheses
 ↓
Interactive GRILL
 ↓
Human correction
 ↓
Architecture State
```

例如：

```text
I think this repository contains:

Identity
Billing
Checkout

Is this intended?
```

Human：

```text
[Correct]

[Checkout belongs to Commerce]

[Merge Checkout + Billing]

[Let me explain]
```

Architecture 即時更新。

---

# 21. GRILL

`GRILL` 是核心 Primitive。

目的：

# **Resolve Architectural Ambiguity**

例如：

```text
OrderService currently appears to:

- own order state
- create payment
- reserve inventory
- send notification
- write analytics
```

不要讓 Agent 自己猜。

而是：

```text
Which responsibilities belong here?

[Keep all]

[Extract Payment]

[Extract Inventory]

[Extract Notification]

[Discuss]
```

GRILL 的真正價值：

> **Turn ephemeral reasoning into persistent architectural state.**

討論可能最後編譯成：

```text
Decision
Rule
Relation
Anchor
Scope
Contract
```

---

# 22. No Implementation Before Architectural Closure

Coding Agent 常見問題：

```text
ignore folder structure
create abstractions prematurely
write hundreds of lines before agreement
touch unrelated domains
```

因此 ADDONE 原則：

# **No implementation before architectural closure.**

但 closure 之後不是繼續寫文件。

而是：

# **Materialize the Skeleton**

---

# 23. Logical and Physical Architecture

Architecture Discussion 必須同時包含：

### Logical

```text
Identity
├── Authentication
└── Session
```

### Physical

```text
src/
└── identity/
    ├── authentication/
    │   ├── password.ts
    │   └── passwordless.ts
    └── session/
        └── service.ts
```

因為 Folder Structure 本身就是 Architecture 的一種 materialization。

---

# 24. SKELETON

第二個核心 Primitive：

# **SKELETON**

Architecture 確定後，Agent 先建立：

```text
folders
dummy files
interfaces
class shells
method signatures
pseudo code
TODO
architecture signals
```

例如：

```ts
/**
 * @arch.id identity.passwordless
 * @arch.parent identity.authentication
 */
export class PasswordlessService {
  // TODO: issue challenge
  // TODO: verify challenge
  // TODO: emit assertion
}
```

這時不填完整 Business Logic。

---

# 25. Development Phases

```text
PHASE 0
Understand

PHASE 1
Architecture

PHASE 2
Physical Structure

PHASE 3
Semantic Skeleton

PHASE 4
Spec / Tasks

PHASE 5
Implementation

PHASE 6
Reconciliation
```

昂貴的 Implementation 發生以前，Human 可以先修正：

```text
ownership
boundary
folder structure
contracts
risk
scope
```

---

# 26. Architecture Scope

第三個核心 Primitive：

# **SCOPE**

Architecture 一旦確立，可以 compile 成 Agent Write Boundary：

```json
{
  "scope": "identity.passwordless",
  "write": ["src/identity/passwordless/**"],
  "read": ["src/identity/**", "src/shared/**"],
  "requires_approval": ["src/billing/**"]
}
```

如果 Agent 突然修改：

```text
src/billing/payment.ts
```

則：

```text
ARCHITECTURE SCOPE EXPANSION REQUIRED

Current:
identity.passwordless

Requested:
billing.payment
```

Agent 必須解釋，Human 再決定是否擴 Scope。

---

# 27. Architecture as Agent Control Plane

因此 Architecture 不只告訴 Agent：

> 系統是什麼。

也開始決定：

> Agent 可以做什麼。

```text
Architecture
    ↓
Task Scope
    ↓
Agent Permissions
```

這是 Architecture 從 Documentation 進入 Control Plane 的關鍵。

---

# 28. Architecture Rules

Architecture 可以表達：

> What must remain true?

例如：

```text
Frontend must not access Database directly.

Domain cannot depend on Infrastructure.

Billing cannot access Identity internals.
```

違反：

```text
ARCHITECTURE POLICY VIOLATION
```

並可以直接 CI Fail。

---

# 29. Three Kinds of Rules

必須區分：

## Structural Invariant

例如：

```text
duplicate id
multiple primary parent
invalid relation
```

→ Error。

---

## Architecture Policy

團隊明確禁止：

```text
frontend → database
domain → infrastructure
```

→ CI Fail。

---

## Architecture Smell

例如：

```text
13 cross-domain dependencies
3500 LOC component
20 public operations
high fan-out
```

→ GRILL / Warning。

不能全部當 Error。

否則 ADDONE 會變成 annoying architecture linter。

---

# 30. Engineering Intent Profiles

Architecture State 不應詳細描述：

> C++ memory-safe code 到底要怎麼寫。

它應描述：

> 這個區域需要什麼程度的工程保證。

例如：

```json
{
  "coding_profile": "project-default",
  "assurance": "medium"
}
```

或者：

```json
{
  "assurance": "critical",
  "risk": ["memory-safety"]
}
```

Skill / Rule Pack 再決定：

```text
critical + cpp + memory-safety
→ stronger checks
→ sanitizer
→ leak checks
→ stricter review
```

核心分離：

```text
Architecture State
=
WHAT level of engineering behavior is expected

Skill / Profile
=
HOW the Agent realizes it
```

---

# 31. Coding Style Is Scoped Too

Global：

```json
{
  "project": {
    "defaults": {
      "coding_profile": "python-project"
    }
  }
}
```

Local：

```json
{
  "entities": {
    "native.decoder": {
      "coding_profile": "cpp-native",
      "assurance": "critical"
    }
  }
}
```

Agent Prompt 可以由 Architecture Address compile：

```text
Global Guidance
+
Ancestor Profiles
+
Local Overrides
+
Current Scope
```

因此 Architecture Hierarchy 同時也是：

# **Prompt Scope Hierarchy**

避免 Agent 因為剛讀到某個 Rust-style Package，就開始寫出 Rust-style Python。

---

# 32. Error Handling Is Also Architecture

不同區域不應被 Agent 無限制塞滿：

```text
try
catch
wrap
retry
custom error
logger
fallback
```

Architecture 可以只宣告：

```json
{
  "error_policy": "boundary-owned"
}
```

或者：

```json
{
  "assurance": "low"
}
```

Skill 再理解：

```text
Internal code:
propagate normally

Boundary:
translate errors

Do not wrap errors redundantly.
```

安全性與 Error Handling 詳細做法屬於 Skill / Profile，而不是 Vision Core。

---

# 33. RECONCILE

第四個核心 Primitive：

# **RECONCILE**

Implementation 完成後：

```text
Architecture Intent
        ↓
      compare
        ↑
Observed Evidence
```

可能得到：

```text
Architecture matches implementation.
```

或者：

```text
Observed new relation:

Checkout → Fraud

No intended architecture relation exists.
```

這時 Human / Agent 決定：

```text
Architecture should change
```

或：

```text
Implementation is wrong
```

---

# 34. Sync Is Not Reconcile

`sync`：

```text
line movement
file rename
symbol relocation
anchor refresh
```

屬於 deterministic bookkeeping。

可以 self-heal。

`reconcile`：

```text
new dependency
responsibility moved
domain split
architecture rule violation
```

涉及 Semantic Decision。

不能偷偷改 Intended Architecture。

---

# 35. Architecture IR

Core 不應綁死 Mermaid、C4、Archify 或任何 Renderer。

概念上：

```text
Architecture IR

├── Intent Layer
│   ├── identity
│   ├── responsibility
│   ├── ownership
│   ├── relation
│   ├── constraints
│   └── decisions
│
├── Contract Layer
│   ├── interfaces
│   ├── methods
│   ├── data contracts
│   ├── events
│   └── behavior
│
├── Evidence Layer
│   ├── source anchors
│   ├── inline signals
│   ├── sidecar signals
│   ├── git history
│   ├── code intelligence
│   └── runtime evidence
│
└── Projection Layer
    ├── interactive HTML
    ├── ASCII
    ├── folder structure
    ├── PR diff
    ├── machine context
    └── external renderers
```

---

# 36. Human-Readable IR

傳統 Compiler：

```text
Source
 ↓
IR
 ↓
Machine Code
```

ADDONE 可以理解為：

```text
Human Requirement
       ↓
Human-Readable IR
       ↓
Agent
       ↓
Code
```

JSON 只是 Serialization。

真正重要的是：

```text
Architecture Entity
Decision
Relation
Contract
Invariant
Scope
Risk
Evidence
```

---

# 37. Documentation Explosion

AI 時代新的問題不只是 Code Explosion。

也可能變成：

```text
README.md
PLAN.md
SPEC.md
CONTEXT.md
TASKS.md
IMPLEMENTATION.md
ARCHITECTURE.md
ADR-001.md
...
```

大量 AI 產生的文件沒有人真的仔細讀。

ADDONE 不應追求：

> Generate more documentation.

而是：

> **Turn ephemeral discussion and scattered documents into structured alignment state.**

Markdown 只是 Projection。

---

# 38. Artifact, Not Document

Human 不需要面對一堆長篇 Markdown。

更理想的是：

```text
Architecture Graph
Decision Cards
Tradeoff View
Folder Structure
Contracts
Pseudo Code
Risk
Progress
Evidence Links
```

因此應使用：

# **Interactive Artifact**

而不是把所有內容都理解成 Documentation。

---

# 39. Human + Machine Share the Same Artifact

HTML 不只是給人看。

ADDONE State：

```text
ADDONE IR
  ├── Human Projection
  └── Machine Projection
```

例如 Human 在 HTML：

```text
Payment → Fraud

[Reject]
```

Agent 收到：

```json
{
  "action": "reject_relation",
  "relation": "payment->fraud"
}
```

Agent 不需要靠 Vision 猜 Screenshot。

核心原則：

> **Humans and agents operate on the same architectural state through different projections.**

---

# 40. Interactive HTML

HTML 可以提供：

```text
expand
collapse
semantic zoom
source link
architecture breadcrumb
decision history
risk overlay
current/proposed toggle
architecture diff
approve
reject
comment
```

並可以一路從：

```text
User
 ↓
Payment
 ↓
Country Verification
 ↓
SMS Workaround
 ↓
Unicode Conversion
 ↓
Source
```

向上或向下導航。

---

# 41. PR Architecture Review

傳統 PR：

```text
+463
-81
```

Reviewer 自己 reconstruct intent。

ADDONE 希望先展示：

```text
Feature
Japan Payment Support

Architecture Address
User
→ Payment
→ Japan Verification
→ SMS Workaround
→ Unicode Conversion

Change Type
Contract change

Structural Architecture
No structural change

Risk
Medium

Affected Contracts
sms-normalization

[Open Architecture]
[Open Contract]
[Open Source]
[Full Diff]
```

Review 從：

```text
Implementation
→ guess Intent
```

變成：

```text
Intent
→ inspect Implementation when necessary
```

---

# 42. Change Types

不是所有 PR 都是 Architecture Change。

ADDONE 應區分：

```text
Implementation Change

Contract Change

Architecture Change

Architecture Policy Change
```

這可以降低 Review Noise。

---

# 43. Recursive Architecture

Architecture 可以從：

```text
Organization
└── Product
    └── Domain
        └── System
            └── Component
                └── Contract
                    └── Symbol
```

逐層 Drill Down。

每個層級都能：

```text
observe
discuss
decide
scope
diff
trace history
```

---

# 44. Semantic Zoom

HTML 的 Zoom 不只是 Pixel Zoom。

而是：

```text
Domain
 ↓
Component
 ↓
Contract
 ↓
Class
 ↓
Method
 ↓
Pseudo implementation
 ↓
Source
```

不同使用者與 Agent 可以選擇不同抽象深度。

---

# 45. CARVE

第五個核心 Primitive：

# **CARVE**

Existing Implementation 可以反向抽成：

```text
Implementation
      ↓
    CARVE
      ↓
Semantic Skeleton
```

保留：

```text
folder structure
architectural entities
responsibilities
contracts
required interfaces
public methods
constraints
portable behavior
TODO
signals
```

移除：

```text
framework details
business implementation
internal helpers
vendor glue
accidental complexity
```

---

# 46. Intent / Contract / Implementation

ADDONE 可以把 Software 分成：

```text
Intent
────────────
Contract
────────────
Implementation
```

Semantic Skeleton 是：

```text
Intent
+
Contract
```

的 implementation-ready projection。

---

# 47. Architecture-Preserving Transformations

CARVE 讓很多 Feature 其實變成同一類 Operation。

---

## Clone Intent, Not Code

```text
Taiwan Payment
      ↓
    CARVE
      ↓
Payment Skeleton
      ↓
    CLONE
      ↓
Japan Payment
```

不 Copy：

```text
historical hacks
bugs
provider assumptions
framework details
```

只 Copy：

```text
workflow
responsibility
contracts
constraints
required behavior
```

---

## Language Port

```text
Python Video Decoder
      ↓
    CARVE
      ↓
Decoder Skeleton
      ↓
Target: C++
      ↓
Implementation
```

Agent 不再：

> Translate Python into C++.

而是：

> Implement this Decoder Contract in C++.

---

## Framework Migration

```text
NestJS
 ↓
Semantic Skeleton
 ↓
FastAPI
```

---

## Refactor

```text
Existing Implementation
 ↓
Preserve External Contract
 ↓
Change Internal Architecture
```

---

# 48. Portable Tests

不是所有 Test 都能跨 Implementation 保留。

CARVE 應區分：

```text
Portable
├── contract tests
├── golden tests
├── behavior tests
└── architecture tests
```

以及：

```text
Implementation-specific
├── framework tests
├── internal mocks
└── private helper tests
```

Transformation 優先保留 Portable Tests。

---

# 49. Architecture Pressure

ADDONE 可以從 Architecture State 發現 Design Pressure：

```text
payment.capture

LOC: 2800
Public Operations: 21
Cross-domain dependencies: 11
Owned concepts: 8
```

這不代表一定錯。

而是：

```text
Architecture Pressure: HIGH
```

Trigger：

```text
GRILL
```

問：

> 是否應該拆 Responsibility 或抽出新的 Deep Module？

---

# 50. Single Ownership, Explicit Relations

某些欄位應該 Single-Valued：

```text
id
primary parent
domain
kind
owner
```

禁止：

```text
domain = billing,checkout,identity
```

要求：

```text
primary domain = billing
```

但 Relations 可以多條。

每條 Relation 都必須是獨立 Semantic Object。

不要：

```text
depends = "fraud,ledger,identity"
```

而是：

```text
billing → fraud
billing → ledger
billing → identity
```

才能逐條討論與 Review。

---

# 51. Rendering Is Replaceable

ADDONE 不應與特定 Renderer 綁死。

初期可以：

```text
ADDONE State
 ↓
ADDONE IR
 ↓
Renderer Adapter
 ↓
Archify / other renderer
 ↓
Interactive HTML
```

Renderer 是 Projection Layer。

不是 ADDONE 的 Core。

---

# 52. Archify as Initial Renderer

POC 階段完全可以借用現有 Renderer。

目的不是證明：

> ADDONE 可以畫出比 Archify 更漂亮的圖。

而是先驗證：

```text
GRILL
CONTEXT
SKELETON
SCOPE
RECONCILE
CARVE
```

這個 Development Loop 是否真的有價值。

只有當未來需要：

```text
write-back
semantic editing
custom decisions
nested navigation
progress overlay
risk overlay
special interaction
```

既有 Renderer 無法滿足時，才開發 Native Renderer。

---

# 53. ASCII Is First-Class Too

同一份 IR 可以：

```text
Browser
→ HTML

Terminal
→ ASCII

PR
→ ASCII / SVG

Agent
→ structured context
```

例如：

```text
Payment
├── Authorization
├── Capture
└── Refund
```

PR Delta：

```text
+ Checkout -> Fraud
! Payment -> Ledger: sync → async
- Payment -> LegacyFraud
```

HTML 不是唯一 Interface。

---

# 54. Proposed `.addone/` Structure

暫定：

```text
.addone/
├── architecture.json
├── contracts.json
├── anchors.json
├── rules.json
├── profiles.json
├── config.json
│
├── decisions/
├── scopes/
├── views/
├── transforms/
│
└── .cache/
    ├── observed.json
    ├── fingerprints.json
    ├── resolved-anchors.json
    └── render/
```

Tracked：

```text
intent
contracts
rules
stable anchors
profiles
decisions
scopes
views
```

Ignored：

```text
derived observed graph
resolved lines
temporary fingerprints
render cache
```

---

# 55. Minimal JSON Philosophy

JSON 應保存穩定 Intent。

不要保存大量 Prompt Implementation Detail。

例如：

```json
{
  "project": {
    "defaults": {
      "coding_profile": "project-default",
      "assurance": "standard"
    }
  },
  "entities": {
    "payment": {
      "kind": "domain",
      "parent": null,
      "intent": "Own payment lifecycle.",
      "assurance": "critical"
    },
    "payment.jp-verification": {
      "kind": "capability",
      "parent": "payment",
      "intent": "Handle Japan-specific payment verification."
    },
    "payment.jp-verification.sms": {
      "kind": "component",
      "parent": "payment.jp-verification",
      "intent": "Handle SMS fallback verification.",
      "assurance": "medium"
    }
  }
}
```

Skill / Profiles 負責把：

```text
"assurance": "critical"
```

翻譯成具體工程行為。

---

# 56. Core Primitives

ADDONE 目前收斂成：

# `CONTEXT`

Compile the smallest useful architectural context.

# `GRILL`

Resolve architectural ambiguity.

# `SKELETON`

Materialize architecture before implementation.

# `SCOPE`

Compile architecture into Agent boundaries.

# `RECONCILE`

Compare reality with intent.

# `CARVE`

Extract reusable semantic structure from implementation.

---

# 57. Lifecycle

```text
                  CONTEXT
                     │
                   GRILL
                     │
                     ▼
               ARCHITECTURE
             ↙       ↓       ↘
        CONTRACT   SCOPE   PROFILE
             \       │       /
               SKELETON
                   │
                   ▼
              IMPLEMENT
                   │
                   ▼
                EVIDENCE
                   │
                   ▼
               RECONCILE
                   │
                   └────────────→ ARCHITECTURE
```

Existing Implementation：

```text
Implementation
      │
    CARVE
      ▼
Semantic Skeleton
      │
   Transform
      ▼
New Implementation
```

---

# 58. Benchmark

ADDONE 應該被驗證，而不是只靠理念說服人。

至少比較三組：

```text
A. Raw Repository

B. Repository + scattered persistent docs
   / CONTEXT / ADR / grill-with-docs

C. Repository + ADDONE structured architecture context
```

控制：

```text
same model
same task
same tools
same context budget
```

---

# 59. Benchmark Metrics

可以觀察：

```text
Discovery
─────────
Tool calls before valid plan
grep/search count
files read
input tokens
steps before correct entrypoint

Understanding
─────────────
correct domain ownership
correct folder placement
dependency understanding
repeated questions

Implementation
──────────────
scope violations
unnecessary abstractions
architecture violations
rework

Result
──────
tests
code quality
architecture quality
human corrections
PR review burden
```

核心研究問題：

> **Does persistent structured architecture reduce rediscovery and improve agent decisions?**

---

# 60. Dogfood First

ADDONE 第一個真正長期使用的 Project：

> ADDONE itself.

例如開發：

```text
Add Python adapter
```

就必須自己走：

```text
CONTEXT
 ↓
GRILL
 ↓
Architecture
 ↓
SKELETON
 ↓
SCOPE
 ↓
Implementation
 ↓
RECONCILE
```

如果第三、第四個 Feature 之後，作者自己仍主動想使用這套流程，就是最強的早期 Signal。

---

# 61. Second Validation: CARVE

第二個 POC 驗證另一個 Thesis：

> ADDONE capture 的是真正 Software Design，還是只是 Diagram Metadata？

例如：

```text
Python Video Decoder
      ↓
    CARVE
      ↓
Semantic Skeleton
      ↓
C++ Implementation
      ↓
Portable Contract Tests Pass
```

如果成立，ADDONE IR 就具有跨 Implementation 的實際價值。

---

# 62. Non-Goals for Early Versions

初期不要：

```text
perfect multi-language AST
VS Code-first architecture
Figma Sync
Realtime Collaboration
Hosted SaaS
Own Graph Database
Own Layout Engine
Full Project Management
Organization RBAC
Perfect Runtime Observability
```

Adapter 可以慢慢由自己或 Community 增加。

Core 必須保持小。

---

# 63. Extension Philosophy

ADDONE 不需要自己成為所有 Architecture Knowledge 的專家。

Core 只需要提供：

```text
State
Protocol
Context
Rules
Scope
Evidence
Projection
```

Design Pattern 可以變成：

```text
Pattern Pack
Rule Pack
Profile Pack
Grill Pack
Renderer
Evidence Adapter
Agent Adapter
```

例如：

```text
hexagonal architecture pack
DDD pack
deep-module pack
event-driven pack
C++ safety profile
Python style profile
T3Code adapter
VS Code adapter
```

ADDONE 不告訴世界：

> 什麼才是唯一正確 Architecture。

它提供：

> **一個讓 Architecture 能被保存、討論、約束與演化的地方。**

---

# 64. Product Thesis

最弱：

> Generate beautiful architecture diagrams.

不夠。

稍強：

> Keep architecture diagrams synchronized with code.

仍然偏 Documentation。

真正要驗證的是：

> **Give humans and coding agents a shared architectural model for planning, constraining, implementing, reviewing, transforming, and maintaining software.**

短版：

# **Architecture should be a development interface, not documentation.**

---

# 65. Context Thesis

另一個核心：

# **Stop making every agent rediscover your system from source code.**

ADDONE 希望讓 Agent Session 從：

```text
Where am I?
```

變成：

```text
I know where we are.

Here are the architectural decisions that remain.
```

---

# 66. Documentation Thesis

ADDONE 不應製造更多 AI Prose。

它應該：

> **Turn ephemeral reasoning and scattered documentation into persistent structured alignment state.**

Human 不需要一直讀三千字 AI 文件。

Human 更應該操作：

```text
Architecture
Decision
Contract
Risk
Tradeoff
Scope
```

---

# 67. Methodology Thesis

AI 不只是讓工程師：

> 寫更多 Code。

更大的價值可能是：

> **把低階 implementation 與 bookkeeping 大量交給 Agent，使 Human 的注意力提升到 Architecture Decisions。**

因此：

```text
Human
=
Intent
Trade-off
Ownership
Approval
Review

Agent
=
Explore
Compile Context
Materialize
Implement
Maintain
Reconcile
```

---

# 68. North Star

Git 告訴我們：

> What changed?

Tests 告訴我們：

> Does it work?

ADDONE 應該回答：

> **Does the system still mean what we intended?**

並讓 Architecture 可以：

```text
看
搜尋
展開
討論
決策
約束
實作
驗證
Diff
回溯
重建
Carve
Clone
Transform
```

---

# 69. Final Loop

```text
                 HUMAN INTENT
                      │
                      ▼
                   CONTEXT
                      │
                    GRILL
                      │
                      ▼
               ARCHITECTURE
               ↙     ↓      ↘
         CONTRACT  SCOPE  PROFILE
               \     │      /
                SKELETON
                    │
                    ▼
               IMPLEMENTATION
                    │
                    ▼
                 EVIDENCE
                    │
                    ▼
                RECONCILE
                    │
                    └────────────→ ARCHITECTURE
```

ADDONE 在兩個方向持續工作：

```text
Architecture
     ↓ materialize

Implementation
     ↑ reconcile
```

以及：

```text
Implementation
     ↓ carve

Semantic Skeleton
     ↓ transform

New Implementation
```

---

# 70. Final Vision

Architecture 不再是某次 Meeting 畫完後慢慢腐爛的 Mermaid。

它成為：

# **Living Architecture**

但 ADDONE 真正想改變的並不是 Diagram。

它想建立的是一個 Human 與 Agent 共用的工程中間層：

> **Human intent is compiled into architecture.  
> Architecture is materialized into code.  
> Code returns evidence.  
> ADDONE keeps the loop aligned.**

最後，Human 和 Agent 不再主要透過巨大 Source Diff 或散落文件彼此猜測。

而是先透過：

```text
Architecture
Decision
Contract
Scope
Risk
```

建立最小、可追蹤、可執行的共同理解。

只有當真正需要時，才一路 Drill Down 到 Source Code。

這就是 ADDONE 想驗證的未來開發模式。