import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
let browser
try {
  await server.listen()
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(server.resolvedUrls.local[0] + '?demo=1')
  await page.getByRole('heading', { name: '커밋 그래프' }).waitFor()
  const dialog = page.getByRole('dialog')
  const branchButton = page.getByRole('button', { name: 'Branch', exact: true })
  await branchButton.click()
  await dialog.waitFor()
  // Real browser input exercises native focus trapping and Escape default actions.
  await dialog.getByRole('button', { name: '닫기' }).focus()
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press('Tab')
    assert.equal(await dialog.evaluate(element => document.activeElement === document.body || element.contains(document.activeElement)), true, 'Modal must keep the app behind it inert')
  }
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await branchButton.evaluate(element => element === document.activeElement), true)

  await branchButton.click()
  await dialog.getByLabel('새 브랜치 이름').fill('feature/design-system')
  await dialog.getByRole('button', { name: '예제 생성' }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.match(await page.getByRole('status').innerText(), /feature\/design-system/)

  const filter = page.getByRole('button', { name: '조회 브랜치: 전체' })
  await filter.click()
  const search = page.getByRole('textbox', { name: '브랜치 검색' })
  await search.fill('keyboard')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  const selectedFilter = page.getByRole('button', { name: '조회 브랜치: fix/keyboard-nav' })
  await selectedFilter.waitFor()
  assert.equal(await selectedFilter.evaluate(element => element === document.activeElement), true)
  await selectedFilter.click()
  await page.keyboard.press('Escape')
  await search.waitFor({ state: 'hidden' })
  assert.equal(await selectedFilter.evaluate(element => element === document.activeElement), true)
  await selectedFilter.click()
  await page.getByRole('heading', { name: '커밋 그래프' }).click()
  await search.waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: '전체 브랜치 그래프', exact: true }).click()
  const screenshots = process.env.BRANCHLINE_SCREENSHOTS
  if (screenshots) {
    await mkdir(screenshots, { recursive: true })
    await page.screenshot({ path: `${screenshots}/workspace-desktop.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile viewport must not overflow horizontally')
  if (screenshots) await page.screenshot({ path: `${screenshots}/workspace-mobile.png`, fullPage: true })
  assert.deepEqual(errors, [], 'No browser runtime errors')
  console.log('PASS: native dialog focus / Escape / form, branch keyboard / dismissal, mobile overflow, runtime errors')
} finally {
  await browser?.close()
  await server.close()
}
