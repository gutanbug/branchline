export type AuthorProfile = { id: string; label: string; name: string; email: string }
export type ChangeStats = { working: Record<string, { added: number | null; deleted: number | null; reason?: string }>; staged: Record<string, { added: number | null; deleted: number | null; reason?: string }> }
export type GitFile = { path: string; originalPath: string | null; index: string; working: string; untracked: boolean; conflict: boolean }
export type Commit = { sha: string; parents: string[]; author: string; email: string; date: string; message: string }
export type RemoteCheck = { attemptedAt: number; checkedAt: string | null; configured: boolean; error: string }
export type Tracking = { ref: string; ahead: number | null; behind: number | null }
export type Repository = { path: string; name: string; head: string | null; branch: string | null; token: string; files: GitFile[]; remoteCheck?: RemoteCheck; refs: { ref: string; name: string; sha: string; tracking?: Tracking }[]; shallow: boolean; operation: string | null; checkedAt: string; identity: { name: string | null; email: string | null } }
export type View = 'changes' | 'history' | 'compare' | 'worktrees' | 'sync' | 'stashes' | 'conflicts'
export type WorkingSnapshot = { file: string; current: string; token: string; eol: 'LF' | 'CRLF' | 'mixed' }
export type WorkingEditor = { open: boolean; visit: number; snapshot: WorkingSnapshot | null; draft: string }
export type ConflictSnapshot = { file: string; token: string; base: string | null; ours: string | null; theirs: string | null; current: string; canRestore: boolean; eol: 'LF' | 'CRLF' | 'mixed' }
export type AgentMessage = { role: 'user' | 'assistant'; content: string }
export type AgentConversation = { prompt: string; messages: AgentMessage[]; proposal?: { result: string; token: string; draft: string } }
export type ConflictEditor = { conversations?: Partial<Record<AgentId, AgentConversation>>; snapshot: ConflictSnapshot | null; draft: string; file: string }
export type ConflictInput = { action: 'apply' | 'restore' | 'resolve'; file: string; expected: string; result?: string }
export type Tab = { focusRef?: string; focusSha?: string; focusVisit?: number; stashSha?: string; stashVisit?: number; stashLabel?: string; path: string; view: View; query: string; author: string; file: string; ref: string; after: string; before: string; commitMessage: string; a: string; b: string; mode: string; diffMode: string }
export type History = { commits: Commit[]; hasMore: boolean; offset: number; refSha?: string | null; revisions?: string[] }
export type Comparison = History & { a: string; b: string; bases: string[]; aOnly: number; bOnly: number; diff: string; diffError?: string; shallow: boolean }
export type Worktree = { path: string; branch: string | null; head: string; locked: boolean; prunable: boolean }
export type AgentId = 'claude' | 'codex' | 'gemini'
export type Agent = { id: AgentId; name: string; enabled: boolean; path: string | null; version: string | null; error: string | null; quotaSupport: string }
export type Usage = { account: { email: string | null; type: string; plan: string | null }; windows: { id: string; name: string; usedPercent: number; remainingPercent: number; windowMinutes: number | null; resetsAt: number | null }[]; checkedAt: string }
export type AmendPreview = { sha: string; token: string; message: string; diff: string; stagedDiff: string; published: string[]; stagedFiles: string[] }
export type Mutation = { hunk?: number; preview?: string; includeStaged?: boolean; rewritePublished?: boolean; mainline?: number; parents?: string[]; worktreeMode?: 'new' | 'existing' | 'detached'; operation?: string; action: string; expected: string; file?: string; name?: string; email?: string; base?: string; ref?: string; message?: string; target?: string }
export type SyncInput = { id: string; action: string; expected: string; remote?: string; branch?: string; url?: string; message?: string; includeUntracked?: boolean; restoreIndex?: boolean; stashRef?: string; stashSha?: string }
export type SyncSnapshot = { repository: Repository; remotes: { name: string; fetch: string; push: string; blocked: string }[]; upstream: { ref: string | null; remote: string | null; branch: string | null; ahead: number | null; behind: number | null }; stashes: { sha: string; ref: string; message: string; date: string }[]; offset: number; hasMore: boolean }
export type HostWriteInput = { sourceSha?: string; targetSha?: string; account: string; project: string; action: 'create' | 'comment' | 'approve' | 'request-changes' | 'merge' | 'rerun' | 'cancel'; id?: string; version?: string; title?: string; body?: string; source?: string; target?: string; draft?: boolean; method?: string }
export type HostWritePlan = { id: string; expiresAt: number; label: string; facts: { label: string; value: string }[]; text: string }
export type HostAccount = { authType?: 'oauth' | 'pat'; writeAccess?: boolean; key: string; provider: 'github' | 'gitlab'; host: string; login: string; scope: string; persistent: boolean; expiresAt: number | null; reconnect: boolean }
export type HostAccounts = { accounts: HostAccount[]; warning: string }
export type HostDevice = { id: string; userCode: string; url: string; expiresAt: number; nextAt: number }
export type HostItem = { reviewers?: string[]; assignees?: string[]; id: string; title: string; subtitle: string; url: string; date: string; state: string; body?: string; draft?: boolean; sha?: string; baseSha?: string; source?: string; target?: string; merge?: string; event?: string; conclusion?: string; attempt?: number | null; allowFailure?: boolean; version?: string; truncated?: boolean; unavailable?: boolean; additions?: number | null; deletions?: number | null; generated?: boolean; notes?: HostItem[]; originalSha?: string; path?: string; line?: number | null; originalLine?: number | null; side?: string; replyTo?: string; relation?: string }
export type HostQuery = { ciFilter?: 'all' | 'failed'; reviewRole?: 'all' | 'reviewer' | 'assignee' | 'author'; inactiveDays?: number; titleSearch?: string; account: string; kind: 'projects' | 'project' | 'reviews' | 'review' | 'runs' | 'run' | 'jobs' | ReviewResource; version?: string; target?: 'head' | 'merge'; project?: string; id?: string; page?: number; state?: string; attempt?: number }
export type ReviewResource = 'review-files' | 'review-comments' | 'review-inline' | 'review-approvals' | 'review-checks' | 'review-statuses' | 'review-pipelines'
export type HostResult = { ciSummary?: { inspected: number; unknown: number }; items: HostItem[]; hasMore: boolean; checkedAt: string; warnings?: string[]; version?: string; head?: string; base?: string }
export type FileAction = 'discard' | 'stash-file' | 'trash' | 'ignore-file' | 'ignore-extension' | 'ignore-folder' | 'copy-relative' | 'copy-absolute' | 'reveal' | 'open' | 'patch' | 'blame'
export type DesktopAPI = {
  fileAction(path: string, input: { action: FileAction; file: string; staged: boolean; expected: string }): Promise<{ repository?: Repository; text?: string; pattern?: string; cancelled?: boolean }>
  changeStats(path: string, expected: string): Promise<ChangeStats>
  workingList(path: string, folder: string): Promise<{ path: string; name: string; directory: boolean; disabled?: boolean }[]>
  workingRead(path: string, file: string): Promise<WorkingSnapshot>
  workingSave(path: string, input: { file: string; expected: string; result: string }): Promise<WorkingSnapshot>
  copyBranchName(path: string, ref: string): Promise<null>
  copyCommitSha(path: string, sha: string): Promise<null>
  agentChat(path: string, input: { kind?: 'commit-message'; sha?: string; includeStaged?: boolean; id: string; agent: AgentId; file: string; expected: string; prompt: string; draft: string; previousResult?: string; messages: AgentMessage[] }): Promise<{ message: string; result: string | null; agent: AgentId; file: string; token: string; checkedAt: string }>
  conflictRead(path: string, file: string): Promise<ConflictSnapshot>
  conflictChange(path: string, input: ConflictInput): Promise<{ repository: Repository; snapshot: ConflictSnapshot | null }>
  hostingPrepare(input: HostWriteInput): Promise<HostWritePlan>
  hostingDiscard(id: string): Promise<null>
  hostingWrite(id: string): Promise<{ message: string; id: string }>
  hostingDefaults?(): Promise<{ github: string; gitlab: string; warning?: string }>
  onCloseRequested?(callback: () => void): () => void; closeWindow?(): Promise<null>
  copyMcpConfig(paths: string[]): Promise<null>
  mcpConfig(paths: string[]): Promise<{ mcpServers: { branchline: { command: string; args: string[]; env: { ELECTRON_RUN_AS_NODE: string } } } }>
  hostingPat(input: { origin: string; token: string; persistent: boolean; writeAccess: boolean }): Promise<{ account: string }>
  hostingAccounts(): Promise<HostAccounts>; hostingStart(input: { provider: 'github' | 'gitlab'; clientId: string; persistent: boolean; privateRepos: boolean; writeAccess?: boolean }): Promise<HostDevice>
  hostingPoll(id: string): Promise<{ pending: boolean; nextAt?: number; account?: string; warning?: string }>; hostingCancel(id: string): Promise<null>; hostingVerify(id: string): Promise<null>
  hostingForget(key: string): Promise<HostAccounts>; hostingRead(input: HostQuery): Promise<HostResult>; hostingExternal(account: string, url: string): Promise<null>
  amendPreview(path: string, sha: string): Promise<AmendPreview>
  monitorRemote?(path: string): Promise<RemoteCheck>
  syncState(path: string, offset?: number): Promise<SyncSnapshot>; sync(path: string, input: SyncInput): Promise<Repository>
  cloneDestination(): Promise<string | null>; clone(input: { id: string; url: string; target: string }): Promise<Repository>; cancel(id: string): Promise<null>
  stashDiff(path: string, sha: string): Promise<string>
  bootstrap(): Promise<{ recent: string[]; savedTabs: Record<string, Tab>; tabs: Tab[]; active: string | null; defaultAgent: AgentId; version: string }>
  open(path?: string): Promise<Repository | null>; init(): Promise<Repository | null>; state(path: string): Promise<Repository>
  history(path: string, input: Partial<Tab> & { offset?: number; revisions?: string[] }): Promise<History>
  compare(path: string, input: Partial<Tab> & { offset?: number }): Promise<Comparison>
  diff(path: string, input: { sha?: string; file?: string; staged?: boolean }): Promise<string>
  worktrees(path: string): Promise<Worktree[]>; openWorktree(path: string, target: string): Promise<Repository>
  destination(): Promise<string | null>; mutate(path: string, input: Mutation): Promise<Repository>
  profiles(): Promise<AuthorProfile[]>
  saveProfiles(profiles: AuthorProfile[]): Promise<AuthorProfile[]>
  saveWorkspace(data: { tabs: Tab[]; active: string | null }): Promise<null>
  agents(): Promise<Agent[]>; setAgent(id: AgentId, enabled: boolean): Promise<Agent[]>; agentPath(id: AgentId): Promise<Agent[]>
  defaultAgent(id: AgentId): Promise<AgentId>; usage(id: AgentId): Promise<Usage>; reveal(path: string): Promise<null>
}
declare global { interface Window { branchline?: DesktopAPI } }
