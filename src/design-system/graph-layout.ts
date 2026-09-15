type Edge = { from: number; to: number; parent: string }
// Reserve pending parents when appending an unfiltered history; never invent filtered ancestry.
export function layoutGraph(commits: { sha: string; parents: string[] }[], continuous = false) {
  const positions = new Map(commits.map((commit, index) => [commit.sha, index]))
  const lanes: (string | null)[] = []
  return commits.map((commit, index) => {
    const incoming = lanes.slice()
    let lane = lanes.indexOf(commit.sha)
    if (lane < 0) { lane = lanes.indexOf(null); if (lane < 0) lane = lanes.length }
    lanes[lane] = null
    const edges: Edge[] = []
    const outside: string[] = []
    for (const parent of new Set(commit.parents)) {
      const position = positions.get(parent)
      if (position === undefined) { outside.push(parent); if (!continuous) continue }
      else if (position <= index) { outside.push(parent); continue }
      let target = lanes.indexOf(parent)
      if (target < 0) { target = !edges.length && lanes[lane] === null ? lane : lanes.indexOf(null); if (target < 0) target = lanes.length; lanes[target] = parent }
      edges.push({ from: lane, to: target, parent })
    }
    const through = incoming.flatMap((sha, from) => sha && sha !== commit.sha ? [{ from, to: lanes.indexOf(sha), parent: sha }] : [])
    const width = Math.max(lane + 1, incoming.length, lanes.length)
    while (lanes.length && lanes.at(-1) === null) lanes.pop()
    return { sha: commit.sha, lane, incoming, edges, through, outside, width }
  })
}


/** Only propagate refs along actual, loaded parent edges; lane colors are not branch identity. */
export function graphBranches(commits: { sha: string; parents: string[] }[], refs: { name: string; sha: string; ref?: string }[]) {
  const positions = new Map(commits.map((commit, index) => [commit.sha, index]))
  const branches = new Map(commits.map(commit => [commit.sha, new Set<typeof refs[number]>()]))
  for (const ref of refs) if (!ref.ref || /^refs\/(heads|remotes)\//.test(ref.ref)) branches.get(ref.sha)?.add(ref)
  commits.forEach((commit, index) => {
    for (const parent of commit.parents) {
      if ((positions.get(parent) ?? -1) <= index) continue
      for (const ref of branches.get(commit.sha)!) branches.get(parent)!.add(ref)
    }
  })
  return branches
}
