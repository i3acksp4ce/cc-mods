// The hooks module: the one file the engine follows, so every call that
// touches `$` lives here. diff.ts beside it holds the pure half: which rows
// the mod touches and the text each one reads on hover.

import type { Register } from 'claude-code'
import {
  ADDED_COLOR,
  REMOVED_COLOR,
  clip,
  countsOf,
  fileHref,
  isEditTool,
  pageOf,
  pathOf,
  popupView,
  subjectOf,
} from './diff'

// The switch /diff-peek writes; the store keeps the choice across sessions.
const ENABLED_KEY = 'enabled'

// How many pages of a reveal the pointer has opened, by the tool call it
// belongs to; a reload drops them, and the map trims like the transcript.
const pagesOf = new Map<string, number>()
const PAGE_MAP_LIMIT = 400

function trimTo<V>(map: Map<string, V>, limit: number): void {
  while (map.size > limit) {
    const oldest = map.keys().next()
    if (oldest.done === true) break
    map.delete(oldest.value)
  }
}

// The engine keeps a column clear at each transcript edge, and tool rows sit
// deeper in it, so the row's budget gives that width up; the viewport is
// absent until the terminal has been measured.
const TOOL_GUTTER = 4
const FALLBACK_COLUMNS = 120

export const register: Register = on => {
  // An edit row is the mod's own drawing, so the line hugs its words and the
  // hover scope lights on the text alone: the engine's own row would claim
  // the full width, and a box around it can never be narrower than that.
  // The folded reveal beneath shares the scope and unfolds while the pointer
  // rests on the line. VS Code ignores hover, so there the row stays native
  // with its own diff; so does the expanded transcript (ctrl+o, --verbose),
  // and a call that ended in an error or an interrupt keeps its own ending.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const row = e.props
    if (e.surface === 'vscode') return next(e)
    if (row.isExpanded === true) return next(e)
    if (!isEditTool(row.tool) || row.isErrored || row.isInterrupted) return next(e)
    if ((await $.store.get(ENABLED_KEY)) === 'off') return next(e)
    const view = popupView(row.input, row.output)
    if (view === undefined) return next(e)
    const counts = countsOf(row.tool, row.input, row.output)
    // The subject is the only part cut, so name and counts stay readable.
    const spent =
      (counts === undefined
        ? 0
        : (counts.added > 0 ? ` +${counts.added}`.length : 0) +
          (counts.removed !== undefined && counts.removed > 0 ? ` -${counts.removed}`.length : 0)) +
      (row.isRunning ? 2 : 0) +
      4
    const room = Math.max(
      (e.viewport?.columns ?? FALLBACK_COLUMNS) - TOOL_GUTTER - row.tool.length - spent,
      8,
    )
    const shown = clip(subjectOf(row.input, row.output), room)
    // The reveal reads one page at a time: a region in the transcript has
    // no scroll, so a long diff grows through the more button instead.
    const pages = pagesOf.get(row.tool_use_id) ?? 1
    const shownPage = pageOf(view.source, pages)
    const path = pathOf(row.input, row.output)
    const group = `diff-peek-${row.tool_use_id}`
    const href = fileHref(path ?? '')
    const { Box, Button, Code, Link, Text } = $.ui.resolve(e)
    return Box({
      flexDirection: 'column',
      alignItems: 'flex-start',
      children: [
        Box({
          hover: { scope: group },
          flexDirection: 'row',
          children: [
            Text({ children: [row.tool] }),
            ...(shown === ''
              ? []
              : [
                  Text({ children: [' '] }),
                  ...(href === undefined
                    ? [Text({ children: [shown] })]
                    : [Link({ href, children: [Text({ children: [shown] })] })]),
                ]),
            ...(counts === undefined
              ? []
              : [
                  ...(counts.added > 0
                    ? [Text({ color: ADDED_COLOR, children: [` +${counts.added}`] })]
                    : []),
                  ...(counts.removed !== undefined && counts.removed > 0
                    ? [Text({ color: REMOVED_COLOR, children: [` -${counts.removed}`] })]
                    : []),
                ]),
            ...(row.isRunning ? [Text({ dimColor: true, children: [' …'] })] : []),
          ],
        }),
        Box({
          width: '100%',
          display: 'none',
          hover: { scope: group, display: 'flex' },
          flexDirection: 'column',
          paddingLeft: 4,
          children: [
            Code({
              source: shownPage.source,
              ...(view.kind === 'diff' ? { format: 'diff' as const } : {}),
              ...(path === undefined ? {} : { path }),
            }),
            ...(shownPage.remaining === 0
              ? []
              : [
                  Button({
                    key: `more-${row.tool_use_id}`,
                    label: `+${shownPage.remaining} lines`,
                    plain: true,
                    dimColor: true,
                    onPress: () => {
                      pagesOf.set(row.tool_use_id, pages + 1)
                      trimTo(pagesOf, PAGE_MAP_LIMIT)
                      $.ui.invalidate('ui.render')
                    },
                  }),
                ]),
          ],
        }),
      ],
    })
  })

  // The result block under the row is where the diff prints; for the rows
  // above it folds away, so the diff shows on hover and never on its own.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const row = e.props
    if (e.surface === 'vscode') return next(e)
    if (row.isExpanded === true) return next(e)
    if (!isEditTool(row.tool) || row.isErrored) return next(e)
    if ((await $.store.get(ENABLED_KEY)) === 'off') return next(e)
    const { Box } = $.ui.resolve(e)
    return Box({})
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'diff-peek',
      description: 'Show or hide the hover diff under edit tool rows',
      argumentHint: '[on|off]',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'diff-peek' }, async ($, e) => {
    const wanted = (e.args ?? '').trim()
    if (wanted !== '' && wanted !== 'on' && wanted !== 'off') {
      return { text: 'diff-peek takes on, off, or nothing to toggle' }
    }
    const current = (await $.store.get(ENABLED_KEY)) === 'off' ? 'off' : 'on'
    const value = wanted === '' ? (current === 'on' ? 'off' : 'on') : wanted
    await $.store.set(ENABLED_KEY, value)
    $.ui.invalidate('ui.render')
    return { text: `hover diff ${value}` }
  })
}
