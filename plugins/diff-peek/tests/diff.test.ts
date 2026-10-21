// The pure half: which rows the mod touches, and the text each state of a
// call reads on hover. The drawn tree is pinned in draw.test.ts.
import { expect, test } from 'claude-code/testing'
import {
  PAGE_LINES,
  clip,
  countsOf,
  fileHref,
  hunksOfInput,
  hunksOfOutput,
  isEditTool,
  pageOf,
  pathOf,
  pathTail,
  popupView,
  subjectOf,
} from '../hooks/diff'

test('the mod touches the file-editing tools and nothing else', () => {
  for (const tool of ['Edit', 'MultiEdit', 'Write', 'NotebookEdit']) {
    expect(isEditTool(tool)).toBe(true)
  }
  expect(isEditTool('Bash')).toBe(false)
  expect(isEditTool('Read')).toBe(false)
  expect(isEditTool('mcp__zai__analyze_image')).toBe(false)
})

test('a settled edit reads its hunks from the stored patch', () => {
  expect(
    hunksOfOutput({
      structuredPatch: [
        { oldStart: 12, oldLines: 4, newStart: 12, newLines: 6, lines: [' ctx', '-gone', '+here', '+too'] },
        { lines: ['+sole'] },
      ],
    }),
  ).toEqual([
    { oldStart: 12, oldLines: 4, newStart: 12, newLines: 6, lines: [' ctx', '-gone', '+here', '+too'] },
    { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['+sole'] },
  ])
  expect(hunksOfOutput({ structuredPatch: [] })).toEqual([])
  expect(hunksOfOutput({ structuredPatch: [{ lines: [] }, 'junk', 7] })).toEqual([])
  expect(hunksOfOutput({ structuredPatch: 'nope' })).toEqual([])
  expect(hunksOfOutput({})).toEqual([])
  expect(hunksOfOutput(undefined)).toEqual([])
})

test('a running edit builds its hunks from the strings it swaps', () => {
  expect(hunksOfInput({ old_string: 'one', new_string: 'one\ntwo' })).toEqual([
    { oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: ['-one', '+one', '+two'] },
  ])
  expect(
    hunksOfInput({ edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'x\ny', new_string: '' }] }),
  ).toEqual([
    { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-a', '+b'] },
    { oldStart: 1, oldLines: 2, newStart: 1, newLines: 0, lines: ['-x', '-y'] },
  ])
  expect(hunksOfInput({})).toEqual([])
  expect(hunksOfInput('nope')).toEqual([])
})

test("a write's content is no swap, so hunksOfInput leaves it out", () => {
  expect(hunksOfInput({ file_path: 'a.md', content: 'one\ntwo' })).toEqual([])
})

test('a row reads the stored patch, then the swap, then the landed text', () => {
  const patch = {
    structuredPatch: [{ oldStart: 12, oldLines: 2, newStart: 12, newLines: 2, lines: [' ctx', '-one', '+two'] }],
  }
  expect(popupView({ old_string: 'x', new_string: 'y' }, patch)).toEqual({
    kind: 'diff',
    source: '@@ -12,2 +12,2 @@\n ctx\n-one\n+two',
  })
  expect(popupView({ file_path: 'a.md', old_string: 'one', new_string: 'two' }, undefined)).toEqual({
    kind: 'diff',
    source: '@@ -1,1 +1,1 @@\n-one\n+two',
  })
  expect(popupView({ content: 'live' }, { structuredPatch: [], content: 'landed' })).toEqual({
    kind: 'source',
    source: 'landed',
  })
  expect(popupView({ file_path: 'a.md', content: 'live' }, undefined)).toEqual({
    kind: 'source',
    source: 'live',
  })
  expect(popupView({}, {})).toBeUndefined()
  expect(popupView(undefined, undefined)).toBeUndefined()
})

test('a write whose patch is missing hover-reads the text that landed', () => {
  expect(
    popupView({ file_path: 'a.md' }, { type: 'update', filePath: 'a.md', content: 'one\ntwo', structuredPatch: [] }),
  ).toEqual({ kind: 'source', source: 'one\ntwo' })
})

test('a source view past the cap cuts at a line end', () => {
  const view = popupView({}, { content: `${'a'.repeat(59_998)}\nrest-of-the-line` })
  expect(view?.kind).toBe('source')
  expect(view?.source.length).toBeLessThanOrEqual(60_000)
  expect(view?.source).not.toContain('rest-of-the-line')
})

test('the reveal reads one page and counts what waits behind the button', () => {
  const ten = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].join('\n')
  expect(pageOf(ten, 1)).toEqual({ source: ten, remaining: 0 })
  const fifty = Array.from({ length: 50 }, (_, i) => `${i + 1}`).join('\n')
  const first = pageOf(fifty, 1)
  expect(first.source.split('\n')).toHaveLength(PAGE_LINES)
  expect(first.remaining).toBe(26)
  const last = pageOf(fifty, 3)
  expect(last.source).toBe(fifty)
  expect(last.remaining).toBe(0)
  // A page count below one still reads a page.
  expect(pageOf(fifty, 0).source.split('\n')).toHaveLength(PAGE_LINES)
})

test('the diff text carries one @@ header per hunk and the marked lines', () => {
  expect(popupView({}, { structuredPatch: [] })).toBeUndefined()
  const hunks = [
    { oldStart: 12, oldLines: 2, newStart: 12, newLines: 3, lines: [' ctx', '-gone', '+here'] },
    { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['+sole'] },
  ]
  expect(popupView({}, { structuredPatch: hunks })).toEqual({
    kind: 'diff',
    source: '@@ -12,2 +12,3 @@\n ctx\n-gone\n+here\n@@ -1,1 +1,1 @@\n+sole',
  })
})

test('a diff past the cap cuts at a line end and says so as a context line', () => {
  const long = { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: [`+${'x'.repeat(70_000)}`] }
  const view = popupView({}, { structuredPatch: [long] })
  expect(view?.kind).toBe('diff')
  expect(view?.source.length).toBeLessThan(100)
  expect(view?.source.endsWith('\n (diff-peek: truncated)')).toBe(true)
})

test('the row names its file from the result first, then the input', () => {
  expect(pathOf({ file_path: 'in.md' }, { filePath: 'out.md' })).toBe('out.md')
  expect(pathOf({ file_path: 'in.md' }, {})).toBe('in.md')
  expect(pathOf({ notebook_path: 'book.ipynb' }, undefined)).toBe('book.ipynb')
  expect(pathOf({}, undefined)).toBeUndefined()
})

test('counts read the settled patch, or estimate from the swap while running', () => {
  expect(countsOf('Edit', {}, { structuredPatch: [{ lines: [' ctx', '-a', '+b', '+c'] }] })).toEqual({
    added: 2,
    removed: 1,
  })
  expect(countsOf('Edit', { old_string: 'x\ny', new_string: 'z' }, undefined)).toEqual({
    added: 1,
    removed: 2,
  })
  // A pure insertion names no removal, and the row draws none.
  expect(countsOf('Edit', {}, { structuredPatch: [{ lines: ['+b', '+c'] }] })).toEqual({ added: 2 })
  expect(countsOf('Edit', {}, { structuredPatch: [] })).toBeUndefined()
  expect(countsOf('Edit', {}, {})).toBeUndefined()
})

test('a write counts the lines it wrote, green alone', () => {
  expect(countsOf('Write', { file_path: 'a.md' }, { content: 'one\ntwo', structuredPatch: [] })).toEqual({
    added: 2,
  })
  expect(countsOf('Write', { file_path: 'a.md', content: 'one\ntwo' }, undefined)).toEqual({ added: 2 })
  expect(countsOf('Write', {}, {})).toBeUndefined()
  expect(countsOf('Write', { content: '' }, undefined)).toBeUndefined()
})

test('the subject names the file the row acts on, tail first', () => {
  expect(pathTail('C:\\w\\src\\notes.md')).toBe('src/notes.md')
  expect(pathTail('notes.md')).toBe('notes.md')
  expect(subjectOf({ file_path: 'a\\b\\c.md' }, {})).toBe('b/c.md')
  expect(subjectOf({}, undefined)).toBe('')
})

test('the subject is the only part cut', () => {
  expect(clip('abcdef', 6)).toBe('abcdef')
  expect(clip('abcdef', 4)).toBe('abc…')
  expect(clip('abcdef', 1)).toBe('…')
})

test('an absolute path links from a file URL, the drive kept whole', () => {
  expect(fileHref('C:\\w\\src\\notes.md')).toBe('file:///C:/w/src/notes.md')
  expect(fileHref('/usr/local/a.md')).toBe('file:///usr/local/a.md')
  expect(fileHref('C:\\my notes\\a b.md')).toBe('file:///C:/my%20notes/a%20b.md')
  // A relative path names no file on its own, so it links from nothing.
  expect(fileHref('src/notes.md')).toBeUndefined()
})
