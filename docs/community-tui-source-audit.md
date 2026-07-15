# Community Pi TUI source audit

Date: 2026-07-14

## Purpose

Decide which visible TUI additions belong in `pi-everforest-tui`, which integrations belong in `1st-pi`, and which existing Pi packages should be used instead of reimplemented.

This is a source-level build-vs-buy review, not an endorsement based only on npm descriptions. Packages were inspected from their npm tarballs at the versions listed below; the three packages already bundled by `1st-pi` were inspected from its installed `node_modules`.

## Ownership rule

- **`pi-everforest-tui`** owns reusable presentation: Everforest themes, editor/footer/status surfaces, settings UI, Theme Lab, and generic registration/rendering contracts. It must not import task, agent, or workflow implementations.
- **`1st-pi`** owns curation and composition: package selection, load order, defaults, branding, command shortcuts, and thin adapters to public package events/APIs.
- **External packages** keep ownership of task, agent, workflow, context-analysis, tool-rendering, diff, retry, and Git domain behavior.

## Executive decision

### Directly use from `1st-pi`

| Package | Version reviewed | Decision | Rationale |
|---|---:|---|---|
| `pi-tool-display` | 0.5.0 | Recommended trial dependency | Mature compact tool rendering, adaptive diff rendering, per-tool ownership switches, reload cleanup, settings modal, and a public consumer adapter. It solves a domain that does not belong in the Everforest theme package. Start with `balanced`, disable its native user-message box initially, and avoid loading another tool/diff renderer simultaneously. |
| `@mrclrchtr/supi-context` | 2.4.0 | Recommended optional dependency | Provides a detailed `/supi-context` report, context attribution, a width-aware renderer, and optional agent tool. Use its command as-is; do not copy its analysis engine into either repository. |
| `@tintinweb/pi-subagents` | 0.14.1 installed | Keep | Already owns agent runtime, FleetView, conversation viewer, widget, notifications, settings, and lifecycle events. `1st-pi` may consume its public events for small summaries, but must not build a second Agent Radar. |
| `@tintinweb/pi-tasks` | 0.7.1 installed | Keep | Already owns task storage, tools, menu, settings, dependencies, and persistent widget. It does not expose general task-change events, so do not scrape its storage to build a duplicate board. |
| `@quintinshaw/pi-dynamic-workflows` | 2.13.1 installed | Keep | Already provides compact/detailed progress panels and an interactive `/workflows` navigator. No duplicate workflow progress UI is needed. |

### Use only if the preferred package is not selected

| Package | Version | Decision |
|---|---:|---|
| `@heyhuynhgiabuu/pi-diff` | 0.7.5 | Good standalone diff choice, but do not load with `pi-tool-display`. It wraps `write`/`edit` and adds an edit guard, so it is more than a visual renderer. |
| `pi-claude-style-tools` | 1.0.67 | Alternative to `pi-tool-display`, not an additional dependency. It has grouped rows and live previews but uses broader container patches and does not expose the same consumer API. Prefer `pi-tool-display` for composability and ownership controls. |

### Do not directly install into `1st-pi`

| Package | Version | Reason |
|---|---:|---|
| `pi-zentui` | 0.8.0 | Replaces footer/editor and patches selector/user-message rendering; directly conflicts with `pi-everforest-tui`. Useful source reference only. |
| `@aphotic/pi-flow-ux` | 0.10.0 | Installs editor/header and deliberately suppresses the native footer. Directly conflicts with both Everforest TUI and the `1st-pi` header. Useful source reference only. |
| `pi-powerline-footer` | 0.7.0 | Large all-in-one editor/footer/fixed-screen/bash-mode system that would replace the surfaces this project owns. Current peer range is also capped below Pi 0.81. |
| `@talex-touch/pi-powerline-footer` | 0.1.30 | Customized fork with the same ownership conflict. |
| `pi-archimedes` | 1.7.1 | Meta-suite registers core, footer, diff tools, subagent, todo, ask, notify, and image paste. It duplicates both Everforest surfaces and packages already selected by `1st-pi`. Its npm metadata also omits a license identifier, so source copying is not approved by this audit. |
| `pi-spark` | 0.19.1 | Broad experience suite with editor/footer/fullscreen plus provider-credit and recap features; about 3.6 MB unpacked and carries gRPC dependencies. Too broad for the desired package boundary. |
| `@juanibiapina/pi-extension-settings` | 0.8.0 | Useful centralized registry, but it adds a second settings file and has a strict load-order contract. Everforest has standalone/session-default precedence requirements, so it should own its small settings surface instead. |
| `pi-skill-gate` | 0.9.0 | Good skill-specific UI, but Pi already provides slash discovery and `pi config`; it is not needed for the Everforest scope. |

## Approved copy/adapt candidates

All approved candidates are MIT-licensed in the reviewed package metadata and/or included license. Any copied code must retain the required copyright/license notice and identify the upstream file and version in source comments.

### 1. Working phase coordinator

**Source:** `@aphotic/pi-flow-ux@0.10.0`, `extensions/working.ts`  
**Target:** `pi-everforest-tui`

Adapt the state-machine technique, not the complete extension:

- track in-flight tools by `toolCallId` instead of a depth counter;
- coalesce `toolcall_end`, `tool_execution_start`, and `tool_execution_update`;
- ignore late events after a turn ends;
- isolate UI listeners so one failure does not break agent events;
- cleanly restore host working UI on shutdown.

This is a strong basis for a generic `idle / active / thinking / toolUse` presentation state. Do not copy its animated model gleam/rainbow behavior; the Everforest editor should remain static while typing and animate only while waiting.

### 2. Editor factory ownership and composition

**Source:** `pi-zentui@0.8.0`, `extensions/zentui/index.ts`  
**Target:** `pi-everforest-tui`

Adapt:

- symbol-tagged editor factories;
- distinction between standalone and wrapper installation;
- restoration only when the currently installed factory is still ours;
- next-tick reconciliation when another extension replaces the editor;
- preservation of the previous editor factory.

This is materially safer than assuming the Everforest editor is the only editor extension.

Do **not** copy Zentui's prototype patches, fixed-editor implementation, terminal mouse handling, or entire footer subsystem.

### 3. Atomic user settings storage

**Source:** `@aphotic/pi-flow-ux@0.10.0`, `extensions/settings.ts`  
**Target:** `pi-everforest-tui`

Adapt the small persistence pattern:

- normalize unknown JSON against typed defaults;
- preserve unrelated keys;
- write to a random temporary file and rename atomically;
- remove temporary files after failure;
- expose snapshot subscriptions.

Everforest still needs its own precedence contract:

1. standalone package defaults;
2. preset defaults emitted during extension loading;
3. optional user preferences;
4. persisted session-branch choices, which win.

### 4. Responsive editor-border fitting

**Preferred source:** Pi's own `examples/extensions/border-status-editor.ts` rather than a community fork.  
**Target:** `pi-everforest-tui`

Use the official `fitBorder` approach as the base, then preserve the package's continuous gradient and named-session badge. Community implementations in `pi-flow-ux` extend the same example with priority dropping, but the initial implementation can remain smaller and independently tested.

### 5. Extension-status placement algorithm

**Source:** `pi-zentui@0.8.0`, `extensions/zentui/footer.ts`  
**Target:** `pi-everforest-tui`, only if configurable placement is approved

The useful isolated idea is budgeting third-party statuses into left/middle/right areas and progressively dropping whole statuses instead of truncating a concatenated line. Do not copy Zentui's full segment/config/runtime subsystem.

## Features to write ourselves in `pi-everforest-tui`

These are small enough, directly tied to the package's identity, and not well served by installing another surface-owning TUI suite.

1. **Everforest Settings overlay** using Pi's built-in `SettingsList`.
2. **Theme Lab** covering theme tokens, Markdown, syntax, tool states, diffs, thinking levels, editor chrome, truecolor, and 256-color fallback.
3. **Generic Command Center shell** using `SelectList`, limited to launching registered actions/commands rather than reimplementing resource management.
4. **Presentation registration contract** for optional command actions, compact status segments, notifications, and future dashboard panels.
5. **Generic phase-aware working presentation**, based on the approved coordinator adaptation.
6. **Responsive footer/editor composition** using Pi core data and public extension statuses only.

A full Cockpit dashboard should wait until these foundations are validated. It should be a generic renderer receiving providers, not a hard dependency on specific task/agent/workflow packages.

## Features to implement only as thin `1st-pi` integration

1. Emit Everforest defaults before session restoration.
2. Keep the branded `1st-pi` header local to the preset.
3. Register Command Center shortcuts for `/agents`, `/tasks`, `/workflows`, `/supi-context`, `/tool-display`, `/theme-lab`, and Everforest settings.
4. Optionally translate `subagents:created`, `subagents:started`, `subagents:completed`, `subagents:failed`, `subagents:steered`, and `subagents:compacted` into generic Everforest notifications/status summaries.
5. Consume existing `ctx.ui.setStatus()` output from workflow and other extensions instead of inventing private adapters.
6. Keep task and workflow native widgets enabled; do not render duplicate boards/panels.

### Important integration limitation

- `@tintinweb/pi-subagents` has a documented event bus, so a thin adapter is supported.
- `@tintinweb/pi-tasks` currently listens to subagent events but does not expose a general task-change event API. Use its own widget/menu.
- `@quintinshaw/pi-dynamic-workflows` publishes statuses/widgets and owns a complete navigator, but the reviewed source does not expose a general workflow event API. Consume its statuses; do not read private files or import private modules.

## Tool/diff recommendation

Run one renderer owner only.

Recommended initial `1st-pi` stack:

```text
pi-everforest-tui            editor/footer/theme owner
pi-tool-display              built-in tool + diff rendering owner
@tintinweb/pi-subagents      agent UI owner
@tintinweb/pi-tasks          task UI owner
@quintinshaw/pi-dynamic-workflows  workflow UI owner
@mrclrchtr/supi-context      context report owner
```

Suggested initial `pi-tool-display` posture:

- preset: `balanced`;
- `enableNativeUserMessageBox: false` until coexistence is visually verified;
- use its built-in edit/write diff renderer;
- do not install `pi-claude-style-tools`, `pi-diff`, `pi-pretty`, or another built-in tool owner at the same time;
- validate tool ownership and cleanup across `/reload`.

## License and copying policy

- Direct package use follows each package's declared license and lockfile version.
- Copying is allowed only from sources with an explicit compatible license and must retain attribution/license notices.
- `pi-archimedes` and repositories whose npm/GitHub source lacks an explicit license should be treated as **no-copy**, even if their implementation is instructive.
- Prefer copying a small pure algorithm or lifecycle pattern over vendoring an entire extension.
- Prefer official Pi examples over equivalent community copies when both exist.

## Primary sources

- Pi TUI docs: <https://pi.dev/docs/latest/tui>
- Pi official border-status example: `examples/extensions/border-status-editor.ts` in `@earendil-works/pi-coding-agent@0.80.6`
- `pi-zentui`: <https://github.com/lmilojevicc/pi-zentui>
- `@aphotic/pi-flow-ux`: <https://github.com/davidsunglee/pi-flow/tree/main/packages/pi-flow-ux>
- `pi-powerline-footer`: <https://github.com/nicobailon/pi-powerline-footer>
- `pi-tool-display`: <https://github.com/MasuRii/pi-tool-display>
- `pi-claude-style-tools`: <https://github.com/FammasMaz/pi-cc-tools>
- `pi-diff`: <https://github.com/buddingnewinsights/pi-diff>
- `pi-extension-settings`: <https://github.com/juanibiapina/pi-extension-settings>
- `supi-context`: <https://github.com/mrclrchtr/supi/tree/main/packages/supi-context>
- `pi-skill-gate`: <https://github.com/cullendotdev/pi-skill-gate>
- `pi-subagents`: <https://github.com/tintinweb/pi-subagents>
- `pi-tasks`: <https://github.com/tintinweb/pi-tasks>
- `pi-dynamic-workflows`: <https://github.com/QuintinShaw/pi-dynamic-workflows>

## Next validation gate

Before changing either manifest:

1. Run `pi-tool-display` and `supi-context` with `pi-everforest-tui` in a temporary local stack.
2. Visually inspect light/dark themes, narrow/wide terminals, edit/write/bash/read rendering, named sessions, and `/reload`.
3. Verify package load order and that only one extension owns each of footer, editor, built-in tool renderers, task widget, agent widget, and workflow widget.
4. Only then add selected packages to `1st-pi` dependencies/bundledDependencies.
