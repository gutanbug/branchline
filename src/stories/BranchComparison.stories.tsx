import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BranchComparison, CommitGraph } from '../design-system'
const common = { sha: 'a'.repeat(40), parents: [] as string[], message: '공통 기반', author: '개발자', date: '2026-09-14T00:00:00Z' }
const source = { ...common, sha: 'b'.repeat(40), parents: [common.sha], message: '로그인 오류 수정' }
const target = { ...common, sha: 'c'.repeat(40), parents: [common.sha], message: '배포 설정 변경' }
const graph = (commit: typeof common) => <CommitGraph label={commit.message} density="compact" commits={[commit, common]} selected={null} onSelect={() => {}} continuous />
const meta = { title: 'Patterns/BranchComparison', component: BranchComparison, args: { source: { name: 'feature/login', sha: source.sha, count: 1, graph: graph(source) }, target: { name: 'main', sha: target.sha, count: 1, graph: graph(target) }, bases: [common.sha], onBase: fn() } } satisfies Meta<typeof BranchComparison>
export default meta
type Story = StoryObj<typeof meta>
export const Diverged: Story = { play: async ({ canvasElement, args }) => { const canvas = within(canvasElement); await expect(canvas.getByRole('region', { name: '가져올 브랜치 그래프' })).toBeVisible(); await expect(canvas.getByRole('region', { name: '반영할 브랜치 그래프' })).toBeVisible(); await userEvent.click(canvas.getByRole('button', { name: /양쪽에서 보기/ })); await expect(args.onBase).toHaveBeenCalledWith(common.sha) } }
export const NoCommonHistory: Story = { args: { bases: [], shallow: true } }
export const Narrow: Story = { decorators: [Story => <div style={{ width: 480, maxWidth: '100%' }}><Story /></div>] }
