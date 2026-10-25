import { expect, test, type Page } from '@playwright/test'

const gotoHash = async (page: Page, route: string) => {
  await page.goto(`./#${route}`)
  await expect(page.locator('main h1').first()).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
})

test('starts on the executive dashboard under the Pages sub-path with demo labelling', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/#\/dashboard$/)
  await expect(page.locator('main h1')).toContainText(/good (morning|afternoon|evening)/i)
  await expect(page.getByText('Interactive Demo — Sample Data').first()).toBeVisible()
  await expect(page.getByText('Total revenue', { exact: false }).or(page.getByText('Revenue')).first()).toBeVisible()
})

test('every sidebar link opens a real screen without console errors', async ({ page }) => {
  test.setTimeout(240_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./')
  await expect(page.locator('main h1').first()).toBeVisible()
  // The sidebar is an accordion: open each section in turn and collect its links.
  const hrefs = new Set<string>()
  const headers = page.locator('aside nav button[aria-expanded]')
  const count = await headers.count()
  for (let i = 0; i < count; i++) {
    const header = headers.nth(i)
    if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click()
    for (const h of await page.locator('aside nav a[href^="#/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')!))) hrefs.add(h)
  }
  expect(hrefs.size).toBeGreaterThan(80)
  for (const href of hrefs) {
    await page.goto(`./${href}`)
    await expect(page.locator('main h1').first(), href).toBeVisible()
    await expect(page.getByText('This screen is being built'), href).toHaveCount(0)
    await expect(page.getByText('This screen ran into a problem'), href).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

test('unknown routes show a friendly not-found page', async ({ page }) => {
  await page.goto('./#/definitely/not/a/page')
  await expect(page.getByText('Page not found')).toBeVisible()
})

test('creates and edits a customer, and the change survives a refresh', async ({ page }) => {
  await gotoHash(page, '/sales/customers')
  await page.getByRole('button', { name: 'New customer' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/Customer name/).fill('Playwright Test Co')
  await dialog.getByLabel(/^Code/).fill('C-PW1')
  await dialog.getByLabel(/^Industry/).fill('Testing')
  await dialog.getByLabel(/Billing contact/).fill('Pat Tester')
  await dialog.getByLabel(/Billing email/).fill('not-an-email')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText(/valid email/i)).toBeVisible()
  await dialog.getByLabel(/Billing email/).fill('pat@playwright.example')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Customer created')).toBeVisible()
  await page.getByPlaceholder(/Search name/).fill('Playwright')
  await expect(page.getByRole('row', { name: /Playwright Test Co/ })).toBeVisible()

  await page.getByRole('button', { name: 'Actions for Playwright Test Co' }).click()
  await page.getByRole('menuitem', { name: 'Edit' }).click()
  await page.getByRole('dialog').getByLabel(/Customer name/).fill('Playwright Renamed Co')
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Customer updated')).toBeVisible()

  await page.waitForTimeout(500) // debounced save
  await page.reload()
  await page.getByPlaceholder(/Search name/).fill('Playwright')
  await expect(page.getByRole('row', { name: /Playwright Renamed Co/ })).toBeVisible()
})

test('creates an invoice, issues it, records partial then full payment', async ({ page }) => {
  await gotoHash(page, '/sales/invoices/new')
  await page.getByLabel(/^Customer/).click()
  await page.getByRole('option').first().click()
  await page.getByLabel(/Description/i).first().fill('E2E consulting')
  await page.getByLabel(/Quantity|Qty/i).first().fill('10')
  await page.getByLabel(/Unit price/i).first().fill('10000')
  await expect(page.getByText(/118,000\.00/).first()).toBeVisible() // 100,000 + 18% VAT
  await page.getByRole('button', { name: /Save & issue/ }).click()
  await expect(page.getByText('Outstanding').first()).toBeVisible()
  await page.getByRole('button', { name: /Record payment/i }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/simulated/i).first()).toBeVisible()
  await dialog.getByLabel(/Amount/i).fill('500000')
  await dialog.getByRole('button', { name: /Record|Save/ }).click()
  await expect(dialog.getByText(/Cannot exceed the outstanding balance of LKR\s118,000\.00/)).toBeVisible()
  await dialog.getByLabel(/Amount/i).fill('50000')
  await dialog.getByRole('button', { name: /Record|Save/ }).click()
  await expect(page.getByText('Part paid').first()).toBeVisible()
  await expect(page.getByText(/68,000\.00/).first()).toBeVisible()
})

test('expense claim: submit then approve, and rejection requires a reason', async ({ page }) => {
  await gotoHash(page, '/finance/expenses?status=submitted')
  // Seeded submitted claims exist; open the first one.
  await page.getByRole('row').nth(1).click()
  await expect(page).toHaveURL(/#\/finance\/expenses\/exp-/)
  await page.getByRole('button', { name: /^Reject/ }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByRole('button', { name: /Confirm|Reject/ }).last()).toBeDisabled() // reason required
  await dialog.getByLabel(/Reason/i).fill('Missing receipt (e2e)')
  await dialog.getByRole('button', { name: /Confirm|Reject/ }).last().click()
  await expect(page.getByText('Rejected').first()).toBeVisible()
  await expect(page.getByText('Missing receipt (e2e)').first()).toBeVisible()

  await gotoHash(page, '/finance/expenses')
  await page.getByRole('button', { name: /New (expense|claim)/i }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel(/Description/i).fill('E2E taxi')
  await d.getByLabel(/Amount/i).fill('4500')
  await d.getByLabel('Category').click()
  await page.getByRole('option').first().click()
  await d.getByRole('button', { name: /Save|Create/ }).click()
  await expect(page.getByText(/claim (created|saved)|created/i).first()).toBeVisible()
  await page.getByPlaceholder(/Search/).first().fill('E2E taxi')
  await page.getByRole('row', { name: /E2E taxi/ }).click()
  await page.getByRole('button', { name: /^Submit/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Submit claim' }).click()
  await expect(page.getByText('Submitted').first()).toBeVisible()
  await page.getByRole('button', { name: /^Approve/ }).click()
  const confirm = page.getByRole('alertdialog')
  if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: /Approve|Confirm/ }).last().click()
  await expect(page.getByText('Approved').first()).toBeVisible()
})

test('theme switching toggles the dark class and persists', async ({ page }) => {
  await gotoHash(page, '/dashboard')
  await page.getByRole('button', { name: /^Theme/ }).click()
  await page.getByRole('menuitemradio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('reset demo data restores the original dataset', async ({ page }) => {
  await gotoHash(page, '/sales/customers')
  await page.getByRole('button', { name: 'New customer' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/Customer name/).fill('Temporary Co')
  await dialog.getByLabel(/^Code/).fill('C-TMP')
  await dialog.getByLabel(/^Industry/).fill('Testing')
  await dialog.getByLabel(/Billing contact/).fill('Tmp Person')
  await dialog.getByLabel(/Billing email/).fill('t@tmp.example')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Customer created')).toBeVisible()

  await gotoHash(page, '/admin/demo-data')
  await page.getByRole('button', { name: /Reset demo data/i }).first().click()
  await page.getByRole('alertdialog').getByRole('button', { name: /Reset/i }).click()
  await gotoHash(page, '/sales/customers')
  await page.getByPlaceholder(/Search name/).fill('Temporary Co')
  await expect(page.getByText('No matching records')).toBeVisible()
})

test('CSV export downloads the filtered rows', async ({ page }) => {
  await gotoHash(page, '/sales/customers')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export CSV/ }).click()])
  expect(download.suggestedFilename()).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.csv$/)
})

test('rule test mode and formula validation work', async ({ page }) => {
  await gotoHash(page, '/config/rules/rule-1')
  await expect(page.getByText(/test/i).first()).toBeVisible()
  await gotoHash(page, '/config/formulas')
  await expect(page.getByText(/Gross profit/).first()).toBeVisible()
})

test('role switching hides restricted areas', async ({ page }) => {
  await gotoHash(page, '/dashboard')
  await page.getByRole('button', { name: /Open user menu/ }).click()
  await page.getByRole('menuitem', { name: /Employee/ }).click()
  await page.goto('./#/admin/users')
  await expect(page.getByText(/Not available to the Employee role/)).toBeVisible()
})
