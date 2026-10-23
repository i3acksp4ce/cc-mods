# diff-peek

Folds the diff Claude prints under an edit's tool row into a hover. The row
keeps the engine's own drawing; the result block under it, where the diff
prints, goes away. Rest the pointer on the 🔽 before the tool name and the
diff unfolds beneath it; move the pointer off and it folds back.

## How it works

- A `ui.render` hook on `ToolUse` draws the edit row itself: a 🔽, the tool
  name in bold, the file's path from the workspace root in parentheses
  (absolute when it sits outside), and the line counts (`+12 -3`) in pinned
  bright hexes (`#50c850`, `#dc5a5a`), tuned to read like the hover diff's
  ink over its tinted background. The engine's own row would claim the full
  width, so drawing the line is what lets the hover zone shrink to the
  emoji; the emoji's box carries the hover scope.
- The folded reveal beneath shares the scope
  (`display: 'none'`, `hover: { display: 'flex', scope }`) and draws the
  diff with a `Code` element in `format: 'diff'`, read from the call's
  `structuredPatch`; while the call still runs, it is rebuilt from the
  `old_string` and `new_string` the model asked to swap, and the counts are
  an estimate until the result lands. A write counts the lines it landed,
  in green alone.
- A region inside the transcript has no scroll, so a long reveal reads one
  page of 24 lines at a time and a dim `+N lines` button opens the next
  page in place.
- A write whose patch never came (the previous content was too large to
  diff, or the diff timed out) hover-reads the text that landed as plain
  source instead.
- A `ui.render` hook on `ToolResult` folds the result block for the same
  rows, so the diff shows on hover and never on its own.
- `/diff-peek` takes `on`, `off`, or nothing to toggle the hover, and keeps
  the choice in the mod's store.

Hover needs a pointer, so the terminal and the Desktop app get the reveal.
In VS Code, whose panel ignores hover, rows stay native with their own diff.
The expanded transcript (ctrl+o, `--verbose`) and rows that ended in an
error or an interrupt also stay native.

## Try it

```text
claude --plugin-dir .cc-mods/plugins/diff-peek
```

Ask Claude to edit a file, then rest the pointer on the 🔽 at the start of
the `Edit` row.

## Install

```text
claude plugin install diff-peek@cc-mods
```
