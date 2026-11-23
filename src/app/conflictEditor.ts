import type { ConflictEditor, ConflictFileEditor } from './types'

export function edited(file: ConflictFileEditor) {
  return !!file.snapshot && file.draft !== file.snapshot.current.replaceAll('\r\n', '\n')
}

function hasDraft(file: ConflictFileEditor) {
  return edited(file) || Object.values(file.conversations || {}).some(chat => chat?.prompt || chat?.proposal)
}

export function keepFile(file: ConflictFileEditor) {
  return hasDraft(file) || Object.values(file.conversations || {}).some(chat => chat?.messages.length)
}

export function dirtyFiles(editor?: ConflictEditor) {
  return editor ? [editor, ...(editor.parked?.values() || [])].filter(hasDraft).map(entry => entry.file) : []
}

export function selectConflictFile({ parked: previous, ...current }: ConflictEditor, file: string, resolved = false): ConflictEditor {
  const parked = new Map(previous)
  if (!resolved && keepFile(current)) parked.set(current.file, current)
  const next = parked.get(file) || { file, snapshot: null, draft: '' }
  parked.delete(file)
  return { ...next, parked }
}
