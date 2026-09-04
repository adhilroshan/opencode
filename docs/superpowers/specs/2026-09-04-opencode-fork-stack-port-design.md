# OpenCode Fork Stack Port Design

## Goal

Integrate the Teams core, background-subagent, and Dynamic Workflows features into the September 2026 `dev` baseline, using the historical PRs as source material rather than assuming their branches still merge cleanly.

## Constraints

- Work only in `/home/ubuntu/projects/opencode-fork` on `feat/my-stack`.
- Keep the current Effect service architecture and `RuntimeFlags` as the source of truth.
- Do not restore deleted legacy modules solely to make an old PR apply.
- Preserve feature boundaries and create a separate commit after each independently verified feature.
- Run package-level typecheck/tests after each port, then the full verification gate.
- Do not push until the branch is clean and all required checks pass.

## Architecture

Teams will be ported first because its persistence and lifecycle events are foundational. Its startup recovery and cleanup hooks will be attached to the current `InstanceBootstrap` Effect service and gated through the current runtime flag service. Background subagents will then be reconciled with the current session prompt and event APIs. Dynamic Workflows will be ported last, including server, plugin, SDK, and TUI surfaces only where the current tree has matching extension points.

Historical PR code may be copied selectively, but imports, flags, lifecycle wiring, generated artifacts, and tests must follow the current tree. If a PR depends on an interface removed from `dev`, the port will use the current replacement or record the feature as blocked rather than reintroducing obsolete architecture.

## Verification

Each feature must compile and pass its focused tests before its commit. The final gate is `bun turbo typecheck`, the full `packages/opencode` test suite, and `bun dev --help`. Build output is verified with the native Linux single-binary build; Windows deployment remains a user-side operation.
