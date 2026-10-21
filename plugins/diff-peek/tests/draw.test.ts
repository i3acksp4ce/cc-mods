// The wiring seams: what the engine sees when it draws an edit row, its
// result block, and when the user runs /diff-peek. The pure half is pinned
// in diff.test.ts.
import { expect, mock, test } from 'claude-code/testing'
import { ADDED_COLOR, PAGE_LINES, REMOVED_COLOR } from '../hooks/diff'

const VIEWPORT = { columns: 100, rows: 30, isFullscreen: false }
const COMMAND_RUN = {
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 100 },
}

const EDIT_ROW = {
  tool: 'Edit',
  input: { file_path: 'src/notes.md', old_string: 'one', new_string: 'two' },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  onScreen: null,
}

const SETTLED_OUTPUT = {
  structuredPatch: [{ oldStart: 12, oldLines: 2, newStart: 12, newLines: 2, lines: [' ctx', '-one', '+two'] }],
}

// The engine's own drawing, as a hook behind the mod would return it.
const NATIVE_ROW = () => ({ type: 'Text' as const, props: {}, children: ['engine row'] })

test('a settled edit row draws its own line with colored counts and a hover diff', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  const mounted = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolUse',
    requestId: 't1',
    surface: 'terminal',
    viewport: VIEWPORT,
    props: { tool_use_id: 't1', ...EDIT_ROW, output: SETTLED_OUTPUT },
  })
  // The engine's row is replaced, not wrapped: the line is the mod's alone.
  expect(await mounted.find({ text: /engine row/ })).toBeUndefined()
  expect(await mounted.find({ text: /^Edit$/ })).toBeDefined()
  expect(await mounted.find({ text: /notes\.md/ })).toBeDefined()
  // The counts carry the pinned bright hexes, the pair the person picked to
  // read like the hover diff's ink over its tinted background.
  const plus = await mounted.findAll({ text: /\+1/ })
  expect(plus.some((span) => span.props.color === ADDED_COLOR)).toBe(true)
  const minus = await mounted.findAll({ text: /-1/ })
  expect(minus.some((span) => span.props.color === REMOVED_COLOR)).toBe(true)
  // The folded reveal under the line carries the diff.
  const code = await mounted.find({ type: 'Code' })
  expect(code).toBeDefined()
  expect(code?.props.format).toBe('diff')
  expect(code?.props.source).toContain('@@ -12,2 +12,2 @@')
  expect(code?.props.source).toContain('-one')
  expect(code?.props.source).toContain('+two')
  expect(code?.props.path).toBe('src/notes.md')
  await mounted.unmount()
})

test('a running edit estimates its counts and hover-reads the strings it swaps', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  const mounted = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolUse',
    requestId: 't2',
    surface: 'terminal',
    viewport: VIEWPORT,
    props: { tool_use_id: 't2', ...EDIT_ROW, isRunning: true },
  })
  const plus = await mounted.findAll({ text: /\+1/ })
  expect(plus.some((span) => span.props.color === ADDED_COLOR)).toBe(true)
  const minus = await mounted.findAll({ text: /-1/ })
  expect(minus.some((span) => span.props.color === REMOVED_COLOR)).toBe(true)
  expect(await mounted.find({ text: /…/ })).toBeDefined()
  const code = await mounted.find({ type: 'Code' })
  expect(code?.props.source).toContain('-one')
  expect(code?.props.source).toContain('+two')
  await mounted.unmount()
})

test('rows the mod does not touch draw whole', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  const mounted = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolUse',
    requestId: 't3',
    surface: 'terminal',
    viewport: VIEWPORT,
    props: {
      tool_use_id: 't3',
      ...EDIT_ROW,
      tool: 'Bash',
      input: { command: 'npm test' },
      output: { stdout: 'ok', stderr: '' },
    },
  })
  expect(await mounted.find({ text: /engine row/ })).toBeDefined()
  expect(await mounted.find({ type: 'Code' })).toBeUndefined()
  await mounted.unmount()
})

test('the expanded transcript keeps every row native', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  const mounted = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolUse',
    requestId: 't4',
    surface: 'terminal',
    viewport: VIEWPORT,
    props: { tool_use_id: 't4', ...EDIT_ROW, output: SETTLED_OUTPUT, isExpanded: true },
  })
  expect(await mounted.find({ type: 'Code' })).toBeUndefined()
  expect(await mounted.find({ text: /engine row/ })).toBeDefined()
  await mounted.unmount()
})

test('an edit that ended badly draws its error whole', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  const mounted = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolUse',
    requestId: 't5',
    surface: 'terminal',
    viewport: VIEWPORT,
    props: { tool_use_id: 't5', ...EDIT_ROW, isErrored: true },
  })
  expect(await mounted.find({ type: 'Code' })).toBeUndefined()
  expect(await mounted.find({ text: /engine row/ })).toBeDefined()
  await mounted.unmount()
})

test('the desktop row gains the hover diff as the terminal one does', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  const mounted = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolUse',
    requestId: 't6',
    surface: 'desktop',
    viewport: VIEWPORT,
    props: { tool_use_id: 't6', ...EDIT_ROW, output: SETTLED_OUTPUT },
  })
  expect(await mounted.find({ type: 'Code' })).toBeDefined()
  await mounted.unmount()
})

test('vscode keeps the native row and result, since its panel has no hover', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  const row = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolUse',
    requestId: 't7',
    surface: 'vscode',
    viewport: VIEWPORT,
    props: { tool_use_id: 't7', ...EDIT_ROW, output: SETTLED_OUTPUT },
  })
  expect(await row.find({ type: 'Code' })).toBeUndefined()
  expect(await row.find({ text: /engine row/ })).toBeDefined()
  await row.unmount()
  const block = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolResult',
    requestId: 't7r',
    surface: 'vscode',
    viewport: VIEWPORT,
    props: { tool_use_id: 't7r', tool: 'Edit', output: SETTLED_OUTPUT, isErrored: false, onScreen: null },
  })
  expect(await block.find({ text: /engine row/ })).toBeDefined()
  await block.unmount()
})

test('the result block folds so the diff never prints on its own', async ($, on) => {
  mock.store(on, {})
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['native result block'] }))
  const folded = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolResult',
    requestId: 'r1',
    surface: 'terminal',
    viewport: VIEWPORT,
    props: { tool_use_id: 'r1', tool: 'Edit', output: SETTLED_OUTPUT, isErrored: false, onScreen: null },
  })
  expect(await folded.find({ text: /native result block/ })).toBeUndefined()
  await folded.unmount()
  // A read's result block is not the mod's to fold.
  const read = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolResult',
    requestId: 'r2',
    surface: 'terminal',
    viewport: VIEWPORT,
    props: { tool_use_id: 'r2', tool: 'Read', output: {}, isErrored: false, onScreen: null },
  })
  expect(await read.find({ text: /native result block/ })).toBeDefined()
  await read.unmount()
})

test('a write without a patch hover-reads the text that landed', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  const mounted = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolUse',
    requestId: 't8',
    surface: 'terminal',
    viewport: VIEWPORT,
    props: {
      tool_use_id: 't8',
      tool: 'Write',
      input: { file_path: 'src/notes.md', content: 'stale' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      onScreen: null,
      output: { type: 'update', filePath: 'src/notes.md', content: 'one\ntwo', structuredPatch: [] },
    },
  })
  const code = await mounted.find({ type: 'Code' })
  expect(code?.props.format).toBeUndefined()
  expect(code?.props.source).toBe('one\ntwo')
  await mounted.unmount()
})

test('a long reveal reads a page and grows through the more button', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  const props = {
    tool_use_id: 't9',
    ...EDIT_ROW,
    output: {
      structuredPatch: [
        { oldStart: 1, oldLines: 1, newStart: 1, newLines: 30, lines: [' ctx', ...Array.from({ length: 30 }, (_, i) => `+line ${i + 1}`)] },
      ],
    },
  }
  const mounted = await $.ui.mount({
    plugin: 'diff-peek',
    component: 'ToolUse',
    requestId: 't9',
    surface: 'terminal',
    viewport: VIEWPORT,
    props,
  })
  // The header and the 31 marked lines make 32; a page reads 24 of them.
  const code = await mounted.find({ type: 'Code' })
  expect((code?.props.source as string).split('\n')).toHaveLength(PAGE_LINES)
  const more = await mounted.find({ type: 'Button' })
  expect(more?.props.label).toBe('+8 lines')
  await mounted.press({ key: 'more-t9' })
  await mounted.redraw(props)
  const grown = await mounted.find({ type: 'Code' })
  expect((grown?.props.source as string).split('\n')).toHaveLength(32)
  expect(await mounted.find({ type: 'Button' })).toBeUndefined()
  await mounted.unmount()
})

test('/diff-peek folds the hover away and back', async ($, on) => {
  mock.store(on, {})
  on('ui.render', NATIVE_ROW)
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: { command: 'diff-peek' } }))
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

  const mountRow = (requestId: string) =>
    $.ui.mount({
      plugin: 'diff-peek',
      component: 'ToolUse',
      requestId,
      surface: 'terminal',
      viewport: VIEWPORT,
      props: { tool_use_id: requestId, ...EDIT_ROW, output: SETTLED_OUTPUT },
    })

  const shown = await mountRow('c1')
  expect(await shown.find({ type: 'Code' })).toBeDefined()
  await shown.unmount()

  const off = await $.command.run({ command: 'diff-peek', args: 'off', ...COMMAND_RUN })
  expect(off.text).toBe('hover diff off')
  const hidden = await mountRow('c2')
  expect(await hidden.find({ type: 'Code' })).toBeUndefined()
  expect(await hidden.find({ text: /engine row/ })).toBeDefined()
  await hidden.unmount()

  const back = await $.command.run({ command: 'diff-peek', args: '', ...COMMAND_RUN })
  expect(back.text).toBe('hover diff on')
  const shownAgain = await mountRow('c3')
  expect(await shownAgain.find({ type: 'Code' })).toBeDefined()
  await shownAgain.unmount()

  const bad = await $.command.run({ command: 'diff-peek', args: 'maybe', ...COMMAND_RUN })
  expect(bad.text).toBe('diff-peek takes on, off, or nothing to toggle')
})
