// The pure half of the mod: which rows it touches, and the text each state
// of a call reads on hover. Plain data in, plain data out; the drawing half
// lives in register.ts. The result shapes are not declared, so every step
// checks its own way in.

export const EDIT_TOOLS: ReadonlyArray<string> = ['Edit', 'MultiEdit', 'Write', 'NotebookEdit']

export const isEditTool = (tool: string): boolean => EDIT_TOOLS.includes(tool)

// The count inks on the row: green for lines that arrive, red for lines
// that go. These are pinned hexes, picked brighter than the theme's own
// diffAddedWord ink (rgb(56,166,96) in the dark preset): the hover diff
// draws the same ink over its dark green line background, which reads
// brighter than bare text on the terminal background does. Swap these for
// the diffAddedWord/diffRemovedWord theme keys to follow the person's
// theme instead.
export const ADDED_COLOR = '#50c850'
export const REMOVED_COLOR = '#dc5a5a'

const splitLines = (text: string): string[] => (text === '' ? [] : text.split('\n'))

const intOf = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) ? value : fallback

const stringFieldOf = (source: unknown, key: string): string | undefined => {
  if (typeof source !== 'object' || source === null) return undefined
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

// One unified-diff hunk, as the file tools carry them in `structuredPatch`.
export interface Hunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

// One hunk from a result's patch, or nothing when the entry is not one.
const hunkOf = (entry: unknown): Hunk | undefined => {
  if (typeof entry !== 'object' || entry === null) return undefined
  const fields = entry as Record<string, unknown>
  if (!Array.isArray(fields.lines)) return undefined
  const lines = fields.lines.filter((line): line is string => typeof line === 'string')
  if (lines.length === 0) return undefined
  return {
    oldStart: intOf(fields.oldStart, 1),
    oldLines: intOf(fields.oldLines, lines.length),
    newStart: intOf(fields.newStart, 1),
    newLines: intOf(fields.newLines, lines.length),
    lines,
  }
}

// The hunks a settled call stored in its result.
export const hunksOfOutput = (output: unknown): Hunk[] => {
  if (typeof output !== 'object' || output === null) return []
  const patch = (output as Record<string, unknown>).structuredPatch
  if (!Array.isArray(patch)) return []
  return patch.map(hunkOf).filter((hunk): hunk is Hunk => hunk !== undefined)
}

// While a call still runs there is no result, so the strings the model asked
// to swap stand in: every line of old_string goes, every line of new_string
// arrives, from line 1 (the real numbers are unknowable yet).
export const hunksOfInput = (input: unknown): Hunk[] => {
  if (typeof input !== 'object' || input === null) return []
  const fields = input as Record<string, unknown>
  const edits: unknown[] = Array.isArray(fields.edits) ? fields.edits : [fields]
  const hunks: Hunk[] = []
  for (const edit of edits) {
    if (typeof edit !== 'object' || edit === null) continue
    const { old_string: oldText, new_string: newText } = edit as Record<string, unknown>
    if (typeof oldText !== 'string' && typeof newText !== 'string') continue
    const gone = typeof oldText === 'string' ? splitLines(oldText) : []
    const come = typeof newText === 'string' ? splitLines(newText) : []
    if (gone.length === 0 && come.length === 0) continue
    hunks.push({
      oldStart: 1,
      oldLines: gone.length,
      newStart: 1,
      newLines: come.length,
      lines: [...gone.map((line) => `-${line}`), ...come.map((line) => `+${line}`)],
    })
  }
  return hunks
}

// The hunks a row counts: the settled patch when it is there, else the swap
// the call is still making. A row with no lines says nothing.
export const countsOf = (tool: string, input: unknown, output: unknown): ChangeCounts | undefined => {
  // A write lands a whole file, so the count is the lines it wrote, green
  // alone: the text it replaced is a replacement, not a line edit.
  if (tool === 'Write') {
    const content = stringFieldOf(output, 'content') ?? stringFieldOf(input, 'content')
    if (content === undefined) return undefined
    const lines = splitLines(content)
    return lines.length === 0 ? undefined : { added: lines.length }
  }
  const settled = hunksOfOutput(output)
  const hunks = settled.length > 0 ? settled : hunksOfInput(input)
  let added = 0
  let removed = 0
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith('+')) added += 1
      else if (line.startsWith('-')) removed += 1
    }
  }
  if (added === 0 && removed === 0) return undefined
  return removed === 0 ? { added } : { added, removed }
}

export interface ChangeCounts {
  added: number
  /** Lines that go; absent on a write, which lands a whole file and removes nothing. */
  removed?: number
}

// The unified-diff text a Code element reads under `format: 'diff'`: one @@
// header per hunk, then the hunk's marked lines. The reveal pages long text,
// and a tree draws its first 100,000 characters, so a diff past the cap cuts
// at a line end and says so as a context line, which the reader still parses.
const MAX_CHARS = 60_000

export const unifiedDiff = (hunks: ReadonlyArray<Hunk>): string | undefined => {
  if (hunks.length === 0) return undefined
  const text = hunks
    .map(
      (hunk) =>
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${hunk.lines.join('\n')}`,
    )
    .join('\n')
  if (text.length <= MAX_CHARS) return text
  const cut = text.slice(0, MAX_CHARS)
  const lastLineEnd = cut.lastIndexOf('\n')
  return `${lastLineEnd < 0 ? cut : cut.slice(0, lastLineEnd)}\n (diff-peek: truncated)`
}

// The text a source view draws, cut at a line end past the cap like the
// diff text is.
export const clippedText = (text: string): string => {
  if (text.length <= MAX_CHARS) return text
  const cut = text.slice(0, MAX_CHARS)
  const lastLineEnd = cut.lastIndexOf('\n')
  return lastLineEnd < 0 ? cut : cut.slice(0, lastLineEnd)
}

// What a row reads on hover: the stored patch when the call has one, else
// the strings the model asked to swap, else the text a write landed whose
// patch never came (the previous content was too large to diff, or the
// diff timed out).
export interface PopupView {
  kind: 'diff' | 'source'
  source: string
}

export const popupView = (input: unknown, output: unknown): PopupView | undefined => {
  const settled = unifiedDiff(hunksOfOutput(output))
  if (settled !== undefined) return { kind: 'diff', source: settled }
  const swapped = unifiedDiff(hunksOfInput(input))
  if (swapped !== undefined) return { kind: 'diff', source: swapped }
  const content = stringFieldOf(output, 'content') ?? stringFieldOf(input, 'content')
  if (content !== undefined) return { kind: 'source', source: clippedText(content) }
  return undefined
}

// The reveal reads this many lines a page, and a more button opens the next
// one: a region inside the transcript has no scroll of its own.
export const PAGE_LINES = 24

// The lines one page draws, and how many wait behind the button; the last
// page reads to the end.
export const pageOf = (source: string, pages: number): { source: string; remaining: number } => {
  const lines = source.split('\n')
  const shown = lines.slice(0, Math.max(1, pages) * PAGE_LINES)
  return { source: shown.join('\n'), remaining: lines.length - shown.length }
}

// The file the row edited: the result's own field first, then the input's.
export const pathOf = (input: unknown, output: unknown): string | undefined => {
  for (const source of [output, input]) {
    if (typeof source !== 'object' || source === null) continue
    const fields = source as Record<string, unknown>
    for (const key of ['filePath', 'file_path', 'notebook_path', 'path']) {
      const value = fields[key]
      if (typeof value === 'string' && value !== '') return value
    }
  }
  return undefined
}

// What the row names as its subject: the path from the workspace root when
// the file sits under it, else the absolute path, so a file outside never
// reads as if it were inside. Both draw with forward slashes, the way a
// path reads in a repo.
export const subjectOf = (input: unknown, output: unknown, root: string | undefined): string => {
  const path = pathOf(input, output)
  if (path === undefined) return ''
  return relativeOf(path, root) ?? forwardSlashes(path)
}

const forwardSlashes = (path: string): string => path.replace(/\\/g, '/')

// The path from the workspace root, when the file sits under it. Case folds
// on both sides: Windows spells one directory in any case.
export const relativeOf = (path: string, root: string | undefined): string | undefined => {
  if (root === undefined || root === '') return undefined
  const parts = path.replace(/\\/g, '/')
  const base = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const lower = parts.toLowerCase()
  const lowerBase = base.toLowerCase()
  if (lower === lowerBase || !lower.startsWith(`${lowerBase}/`)) return undefined
  return parts.slice(base.length + 1)
}

// The subject is the only part cut, so the tool name and the counts stay
// readable.
export const clip = (text: string, room: number): string => {
  if (text.length <= room) return text
  return room <= 1 ? '…' : `${text.slice(0, room - 1)}…`
}
