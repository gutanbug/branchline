import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { SelectField } from '../design-system'
const options = [{ value: 'origin', label: 'origin' }, { value: 'upstream', label: 'upstream' }]
const meta = { title: 'Components/SelectField', component: SelectField, args: { label: '원격 저장소', value: 'origin', onChange: () => {}, options } } satisfies Meta<typeof SelectField>
export default meta
type Story = StoryObj<typeof meta>
function Example() { const [value, setValue] = useState('origin'); return <SelectField label="원격 저장소" value={value} onChange={setValue} options={options} /> }
export const Default: Story = { render: () => <Example />, play: async ({ canvasElement }) => { const select = within(canvasElement).getByRole('combobox', { name: '원격 저장소' }); await userEvent.selectOptions(select, 'upstream'); await expect(select).toHaveValue('upstream') } }
export const Disabled: Story = { args: { disabled: true } }
export const Empty: Story = { args: { value: '', options: [{ value: '', label: '등록된 원격 없음' }], disabled: true } }
