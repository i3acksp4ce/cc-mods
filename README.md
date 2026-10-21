# cc-mods

A marketplace of mods for Claude Code. A mod is a plugin that changes how
Claude Code behaves or looks: it hooks tool calls, prompts, commands, and
the interface, and it runs inside your session with your permissions.

This marketplace ships one mod today:

| Mod                              | What it does                                                  |
| -------------------------------- | ------------------------------------------------------------- |
| [`diff-peek`](plugins/diff-peek) | Folds the diff an edit prints under its tool row into a hover |

## Requirements

Claude Code v2.1.287 or later. Mods need nothing else: no Node.js, no
build step, no dependencies.

## Install

Add the marketplace, then install the mod:

```
/plugin marketplace add i3acksp4ce/cc-mods
/plugin install diff-peek@cc-mods
```

If a session was open while you installed, run `/reload-plugins`.

## Try it

Ask Claude to edit a file, then rest the pointer on its `Edit` row. The
diff unfolds under the row; move the pointer off and it folds back. The
mod's own [README](plugins/diff-peek/README.md) has the full behavior and
the `/diff-peek` toggle.

## Develop

Clone the repo and load a plugin straight from its folder:

```
git clone https://github.com/i3acksp4ce/cc-mods
cd cc-mods
claude --plugin-dir ./plugins/diff-peek
```

The engine reloads the hooks module on every save, so you edit and see
changes in the same session. Two commands check the plugin before you
share a change, and neither needs an install step:

```
claude plugin validate ./plugins/diff-peek
claude plugin test ./plugins/diff-peek
```

`validate` reads the manifest and runs the static analysis the engine runs
at load; it prints the events the mod handles and the mods API calls it
makes. `test` runs the `*.test.ts` files under the plugin.

## Add a mod to this marketplace

A plugin lands under `plugins/<name>` with a `.claude-plugin/plugin.json`,
a `hooks/hooks.json` that names the hooks module, and the hooks module
itself. Add one row to [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json),
run the two checks above, and open a pull request.

## License

[MIT](LICENSE)
