import { useMemo, type ReactNode } from 'react'
import { Disclosure } from './components'

/** Shared path hierarchy for committed and working-file lists. */
export function FilePathList({ paths, view, renderFile }: { paths: string[]; view: 'list' | 'tree'; renderFile: (index: number) => ReactNode }) {
  const tree = useMemo(() => {
    type Folder = { folders: Map<string, Folder>; files: number[] }
    const root: Folder = { folders: new Map(), files: [] }
    paths.forEach((path, index) => {
      let folder = root
      for (const part of path.split('/').slice(0, -1)) {
        if (!folder.folders.has(part)) folder.folders.set(part, { folders: new Map(), files: [] })
        folder = folder.folders.get(part)!
      }
      folder.files.push(index)
    })
    return root
  }, [paths])
  function folders(folder: typeof tree, parent = ''): ReactNode {
    return <ul>{[...folder.folders].sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => <li key={`${parent}/${name}`} className="bl-diff-folder"><Disclosure title={name} initiallyOpen><div className="bl-diff-folder-children">{folders(child, `${parent}/${name}`)}</div></Disclosure></li>)}{folder.files.map(index => <li key={paths[index]}>{renderFile(index)}</li>)}</ul>
  }
  return <div className="bl-file-path-list">{view === 'tree' ? folders(tree) : <ul>{paths.map((path, index) => <li key={path}>{renderFile(index)}</li>)}</ul>}</div>
}
