# pi-everforest-tui

Everforest Soft themes for [Pi](https://pi.dev), with optional matching TUI polish.

## Included

- `everforest-tui-dark`
- `everforest-tui-light`
- `/everforest-tui` command for a working indicator, status display, and compact footer

The themes load immediately. TUI enhancements are opt-in and persist within the current session branch.

## Install

```bash
pi install npm:pi-everforest-tui
```

From GitHub:

```bash
pi install git:github.com/est7/pi-everforest-tui
```

For local development:

```bash
pi install /absolute/path/to/pi-everforest-tui
```

## Select a theme

Open `/settings` and select `everforest-tui-dark` or `everforest-tui-light`.

For automatic light/dark switching, set this in `~/.pi/agent/settings.json`:

```json
{
  "theme": "everforest-tui-light/everforest-tui-dark"
}
```

## Optional TUI enhancements

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

- `indicator` installs an Everforest pulse while Pi is working.
- `status` adds a ready/working state with the current model.
- `footer` installs a responsive cockpit with project, Git branch, model/context window, context usage, token/cost totals, and extension statuses.
- `rainbow` paints the editor's top and bottom border with a continuous Everforest red-to-purple gradient. When the session has a name, it appears as an accent badge at the top-right of the editor; unnamed sessions show no badge.

## Development

```bash
npm run build:themes
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
