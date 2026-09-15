import assert from 'node:assert/strict'
import { writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'

export async function checkAgentChat(app, page, root, cwd, file, accessibility) {
  const original = await readFile(path.join(cwd, file), 'utf8')
  for (const id of ['codex', 'claude', 'gemini']) {
    const executable = path.join(root, `fixture-${id}`)
    await writeFile(executable, `#!${process.execPath}
if(process.argv.includes('--version')) { console.log('fixture 1.0'); process.exit(0); }
let input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data',s=>input+=s); process.stdin.on('end',()=>{
const question=JSON.parse(input.slice(input.indexOf('\\n')+1)).question;
if(question === '기다려') { setInterval(()=>{},1000); return; }
if(question === '잘못된 응답') { console.log('not-json'); return; }
const reply={message:${JSON.stringify(id + ' 수정안입니다. 테스트는 실행하지 않았습니다.')},result:'양쪽 변경을 보존한 결과\\n'};
console.log(JSON.stringify(${JSON.stringify(id)}==='claude'?{structured_output:reply}:${JSON.stringify(id)}==='gemini'?{response:JSON.stringify(reply)}:reply));
});`, { mode: 0o700 })
    await app.evaluate(({ dialog }, executable) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [executable] }) }, executable)
    await page.evaluate(async id => { await window.branchline.agentPath(id); await window.branchline.setAgent(id, true) }, id)
  }
  await page.getByRole('button', { name: 'AI Agents', exact: true }).click()
  await page.getByRole('button', { name: /^내 작업 / }).click()
  const chat = page.getByLabel('Agent에게 전달할 요청', { exact: true })
  await chat.waitFor()
  for (const id of ['codex', 'claude', 'gemini']) {
    await page.getByRole('combobox', { name: '대화 Agent', exact: true }).selectOption(id)
    await chat.fill(`${id} 양쪽 변경을 보존해줘`)
    await chat.dispatchEvent('compositionstart', { data: '가' })
    await chat.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })
    assert.equal(await page.getByRole('button', { name: '응답 중단' }).count(), 0)
    await chat.dispatchEvent('compositionend', { data: '가' })
    await page.getByRole('button', { name: '선택한 Agent에 전송', exact: true }).click()
    await page.getByRole('log').getByText(`${id} 수정안입니다. 테스트는 실행하지 않았습니다.`, { exact: true }).waitFor()
    assert.equal(await readFile(path.join(cwd, file), 'utf8'), original)
  }
  await page.getByRole('combobox', { name: '대화 Agent', exact: true }).selectOption('codex')
  assert.equal(await page.getByRole('log').getByText('gemini 수정안입니다. 테스트는 실행하지 않았습니다.', { exact: true }).count(), 0)
  await chat.fill('후속 질문 초안')
  await page.getByRole('button', { name: 'AI Agents', exact: true }).click()
  await page.getByRole('button', { name: /^내 작업 / }).click()
  assert.equal(await chat.inputValue(), '후속 질문 초안')
  await chat.fill('기다려')
  await page.getByRole('button', { name: '선택한 Agent에 전송', exact: true }).click()
  await page.getByRole('button', { name: '응답 중단', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: /중단|aborted/ }).waitFor()
  assert.equal(await chat.inputValue(), '기다려')
  await chat.fill('잘못된 응답')
  await page.getByRole('button', { name: '선택한 Agent에 전송', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '유효한 수정안' }).waitFor()
  assert.equal(await chat.inputValue(), '잘못된 응답')
  await page.getByLabel('해결 결과 편집', { exact: true }).fill('AI 응답 후 직접 편집\n')
  await page.getByRole('button', { name: '수정안을 편집 초안으로 가져오기', exact: true }).click()
  await page.getByRole('dialog').getByText(/직접 편집한 내용이 있습니다/).waitFor()
  await accessibility(page)
  if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'agent-proposal-preview.png') })
  await page.getByRole('button', { name: '편집 초안 교체', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(await page.getByLabel('해결 결과 편집', { exact: true }).inputValue(), '양쪽 변경을 보존한 결과\n')
  assert.equal(await readFile(path.join(cwd, file), 'utf8'), original)
  await page.setViewportSize({ width: 760, height: 580 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await accessibility(page)
  if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'agent-chat-narrow.png') })
  await page.setViewportSize({ width: 1440, height: 950 })
  console.log('PASS: three local CLI adapters via actual IPC, separate conversations, prompt retention, IME, cancellation, malformed response, proposal preview and unchanged repository (fake executables, no AI billing)')
}
