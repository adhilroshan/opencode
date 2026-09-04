# OpenCode Fork Stack Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port three historical OpenCode feature PRs onto the current `dev` architecture and verify one local integration branch.

**Architecture:** Use current source files as the compatibility boundary. Port Teams persistence and lifecycle first, background subagents second, and workflows last; each feature ends in a focused verification and commit.

**Tech Stack:** Git, Bun 1.3+, TypeScript, Effect services, OpenCode package tests.

**Spec:** `docs/superpowers/specs/2026-09-04-opencode-fork-stack-port-design.md`

## Global Constraints

- Work only in `/home/ubuntu/projects/opencode-fork` on `feat/my-stack`.
- Keep the current Effect service architecture and `RuntimeFlags` as the source of truth.
- Do not restore deleted legacy modules solely to make an old PR apply.
- Preserve feature boundaries and create a separate commit after each independently verified feature.
- Run package-level typecheck/tests after each port, then the full verification gate.
- Do not push until the branch is clean and all required checks pass.

---

### Task 1: Port Teams Core

**Files:**
- Reference: `pr-12730` commits and `packages/opencode/src/team/*`
- Modify: current bootstrap/runtime-flag integration points identified during port
- Test: `packages/opencode/test/team/*.test.ts`

- [ ] **Step 1: Compare the historical Team modules with current session, storage, bus, and instance APIs.**
- [ ] **Step 2: Port only the Team event, inbox, persistence, recovery, and state-transition behavior that matches current APIs.**
- [ ] **Step 3: Add the Teams experimental flag to `RuntimeFlags.Service` and wire recovery/cleanup into the current bootstrap Effect.**
- [ ] **Step 4: Run `bun typecheck` from `packages/opencode`.**
- [ ] **Step 5: Run `bun test test/team`.**
- [ ] **Step 6: Commit with `git add -A && git commit -m "feat(opencode): port teams core"`.**

### Task 2: Port Background Subagents

**Files:**
- Reference: `pr-13261`
- Modify: current session prompt/event/TUI files selected by API comparison
- Test: current background-subagent tests plus focused package typecheck

- [ ] **Step 1: Compare `pr-13261` against current `SessionPrompt`, event, and TUI session APIs.**
- [ ] **Step 2: Port background execution and completion signaling without reverting current session architecture.**
- [ ] **Step 3: Preserve the existing `experimentalBackgroundSubagents` runtime flag and extend it only where the current behavior requires.**
- [ ] **Step 4: Run `bun typecheck` from `packages/opencode`.**
- [ ] **Step 5: Run the focused background-subagent tests and record any unavailable historical test as a compatibility note.**
- [ ] **Step 6: Commit with `git add -A && git commit -m "feat(opencode): port background subagents"`.**

### Task 3: Port Dynamic Workflows

**Files:**
- Reference: `pr-29789`
- Modify: current workflow, server route, plugin, SDK, and TUI extension points
- Test: current workflow tests and generated-artifact checks where applicable

- [ ] **Step 1: Identify the current equivalents for workflow discovery, execution, HTTP routing, plugin helpers, SDK types, and TUI commands.**
- [ ] **Step 2: Port workflow discovery and execution using current service and route conventions.**
- [ ] **Step 3: Port plugin/SDK/TUI surfaces only where their current package APIs support them.**
- [ ] **Step 4: Regenerate generated artifacts with the repository-prescribed command when public APIs changed.**
- [ ] **Step 5: Run `bun typecheck` from `packages/opencode`.**
- [ ] **Step 6: Run the focused workflow tests.**
- [ ] **Step 7: Commit with `git add -A && git commit -m "feat(opencode): port dynamic workflows"`.**

### Task 4: Full Verification and Native Build

**Files:**
- Modify: none after feature commits

- [ ] **Step 1: Run `bun turbo typecheck` from the repository root.**
- [ ] **Step 2: Run `bun test` from `packages/opencode`.**
- [ ] **Step 3: Run `bun dev --help` from the repository root.**
- [ ] **Step 4: Run `bun packages/opencode/script/build.ts --single` from the repository root.**
- [ ] **Step 5: Verify the Linux binary exists under `packages/opencode/dist`.**
- [ ] **Step 6: Confirm `git status --short` is clean.**
- [ ] **Step 7: Push `feat/my-stack` to `origin` only after all checks pass.**
