# diff-peek

A mod for Claude Code that folds the diff Claude prints under an edit's
tool row into a hover. The row keeps a compact line of its own; the result
block under it, where the diff prints, goes away. Rest the pointer on the
row and the diff unfolds beneath it; move the pointer off and it folds
back.

## Install

From a Claude Code session:

```
/plugin marketplace add i3acksp4ce/cc-mods
/plugin install diff-peek@cc-mods
```

The mod needs Claude Code v2.1.287 or later. Hover needs a pointer, so the
reveal works in the terminal and the Desktop app. In VS Code, whose panel
ignores hover, rows stay native with their own diff.

## Use it

- Rest the pointer on an edit row (`Edit`, `MultiEdit`, `Write`,
  `NotebookEdit`) and the diff unfolds beneath it.
- The line counts on the row (`+12 -3`) come from the stored patch once
  the call has finished, and from the strings being swapped while it runs.
- A long diff reads one page of 24 lines at a time; a dim `+N lines`
  button opens the next page in place.
- A write whose diff never came (the previous content was too large to
  diff, or the diff timed out) hover-reads the text that landed as plain
  source instead.
- `/diff-peek` takes `on`, `off`, or nothing to toggle the hover. The
  choice survives across sessions.

The expanded transcript (ctrl+o, `--verbose`) and rows that ended in an
error or an interrupt keep Claude Code's own drawing, so nothing is ever
hidden there.

## How it works

- A `ui.render` hook on `ToolUse` draws the edit row itself: the tool
  name, the file's tail, and the counts. The engine's own row claims the
  full width, so drawing the line is what lets the hover zone hug the
  text; the row's box carries a hover scope.
- The folded reveal beneath shares the scope
  (`display: 'none'`, `hover: { display: 'flex', scope }`) and draws the
  diff with a `Code` element in `format: 'diff'`, read from the call's
  `structuredPatch`.
- A `ui.render` hook on `ToolResult` folds the result block for the same
  rows, so the diff shows on hover and never on its own.

The hooks module is plain TypeScript. The engine loads it directly, hot
reloads on save under `--plugin-dir`, and needs no build step.

## Test it

From the repo root:

```
claude plugin validate ./plugins/diff-peek
claude plugin test ./plugins/diff-peek
```

`validate` prints the events the mod handles and the mods API calls it
makes. `test` runs the suite under `tests/`, which pins the row drawing,
the reveal, the paging, the folding, and the `/diff-peek` command across
the terminal, Desktop, and VS Code surfaces.

## License

[MIT](../../LICENSE)
