const labels: Record<string, string> = { merge: 'Merge', rebase: 'Rebase', 'cherry-pick': 'Cherry-pick', revert: 'Revert' }

/** Git operation names come from git.cjs in lower case; the UI shows them like the action buttons (Merge, Rebase…). */
export const operationLabel = (operation: string | null | undefined) => operation ? labels[operation] || operation : ''
