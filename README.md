# pi-everforest-tui

Everforest Soft themes for [Pi](https://pi.dev), with optional matching TUI polish.

## Included

- `everforest-tui-dark`
- `everforest-tui-light`
- `/everforest` searchable command center for loaded extensions, prompts, and skills
- `/everforest-tui` interactive settings for the working indicator, status, footer, and editor chrome
- `/everforest-theme-lab` live palette and component-state preview

The themes load immediately. TUI enhancements are opt-in and persist within the current session branch.

## Install

```bash
pi install npm:pi-everforest-tui
```

From GitHub:

```bash
pi install git:github.com/est7/pi-everforest-tui
```

For local development, load the package directly from its repository:

```bash
cd /absolute/path/to/pi-everforest-tui
pi -e .
```

Use `pi --no-extensions -e .` for an isolated smoke test without globally configured extensions. Standalone TUI enhancements remain opt-in; enable them with `/everforest-tui` or `/everforest-tui all on`.

## Select a theme

Open `/settings` and select `everforest-tui-dark` or `everforest-tui-light`.

For automatic light/dark switching, set this in `~/.pi/agent/settings.json`:

```json
{
  "theme": "everforest-tui-light/everforest-tui-dark"
}
```

## TUI commands

Open the searchable command center:

```text
/everforest
```

Open interactive TUI settings:

```text
/everforest-tui
```

Direct commands remain available for scripts and quick changes:

```text
/everforest-tui indicator on
/everforest-tui status on
/everforest-tui footer on
/everforest-tui rainbow on
/everforest-tui all on
```

Disable one feature:

```text
/everforest-tui footer off
```

Reset all enhancements:

```text
/everforest-tui reset
```

- `indicator` installs an Everforest pulse with phase-aware working messages for thinking and active tools.
- `status` shows only active working, thinking, and tool-use phases; idle stays quiet and model metadata remains in the main footer.
- `footer` installs a responsive cockpit with project, Git branch, model/context window, context usage, token/cost totals, and whole-segment extension status fitting.
- `rainbow` paints the editor's top and bottom border with a continuous Everforest red-to-purple gradient. When the session has a name, it appears as an accent badge at the top-right of the editor; unnamed sessions show no badge. The wrapper composes with an existing custom editor and restores it only while Everforest still owns the editor surface.

Preview the active theme's semantic palette, Markdown, tool states, diffs, syntax, and thinking levels:

```text
/everforest-theme-lab
```

## Development

```bash
npm run build:themes
npm run typecheck
npm test
npm run validate
npm run pack:dry-run
```

Before publishing, visually inspect both themes, tool states, diffs, markdown, each thinking level, and all optional TUI features.

## Palette source

The base colors follow the Everforest Soft palettes used by Ghostty and the upstream Everforest project:

- https://github.com/sainnhe/everforest
- https://github.com/ghostty-org/ghostty/tree/main/src/apprt/gtk/class/terminal-window

## License

MIT
