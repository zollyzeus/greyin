import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * The LLM provider admin panel moved from StackWorks to Greyin Hub
 * 2026-08-24 -- llm_providers/llm_feature_flags (031) are shared tables
 * feeding AI scoring across GreyMatters/Salt & Pepper/FlexPro, not a
 * StackWorks-specific concern, so this is now a cross-app test (signup on
 * one pillar, admin action on Hub) rather than a single-app one. Covers
 * the panel itself (add/disable/delete a provider row, toggle a feature
 * flag) without making any real external call to Anthropic/OpenAI/Ollama
 * -- an ollama-type row only needs a base_url/model string to exist in
 * the form, it's never actually dialed. Same reasoning as this suite's
 * Razorpay checkout mock: nothing here should depend on a live
 * third-party call.
 *
 * Toggles e2e_admin_panel_toggle_test (049), not a real flag like
 * stackworks_verification -- every real flag now has its own spec
 * (verification.spec.ts, greymatters/freeagent/saltnpepper's
 * ai-quality-score.spec.ts) that depends on AI review actually being
 * enabled, and briefly disabling one mid-run is a real race against
 * whichever of those happens to be running concurrently in another
 * worker. This flag is read by no application code, so toggling it has
 * zero effect on anything else.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const stackworksBase = isLocal ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}` : 'https://stackworks.greyin.net'
const hubBase = isLocal ? `http://localhost:${process.env.E2E_HUB_PORT || 3105}` : 'https://greyin.net'

test('an admin can add, disable, and delete an LLM provider, and toggle the verification feature flag', async ({ page, cleanup }) => {
  const admin = await signUpStackWorksBuilder(page, cleanup, stackworksBase)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, `${hubBase}/dashboard`, hubBase)

  await page.goto(`${hubBase}/admin/llm`)

  const label = `E2E Test Ollama ${Date.now()}`
  await page.locator('#provider').selectOption('ollama')
  await page.locator('#label').fill(label)
  await page.locator('#model').fill('llama3.1')
  await page.locator('#base_url').fill('http://e2e-fake-ollama:11434')
  await page.getByRole('button', { name: 'Add provider' }).click()
  await page.waitForURL(`${hubBase}/admin/llm`)

  // Scoped to the provider row's specific class combination -- the
  // feature-flag section's provider-picker <select> also contains an
  // <option> with this label text, so a bare `div.py-3` filter matches
  // both and trips Playwright's strict mode.
  const rowSelector = 'div.flex.items-center.justify-between.gap-4.flex-wrap'
  const row = page.locator(rowSelector, { hasText: label })
  await expect(row).toBeVisible()
  await expect(row.getByText('Enabled', { exact: true })).toBeVisible()

  await row.getByRole('button', { name: 'Disable' }).click()
  await page.waitForURL(`${hubBase}/admin/llm`)
  await expect(page.locator(rowSelector, { hasText: label }).getByText('Disabled', { exact: true })).toBeVisible()

  // Scoped to the dedicated test-only flag row -- the admin panel lists
  // every llm_feature_flags row (5 now), so an unscoped
  // `select[name="enabled"]` locator resolves to all of them at once.
  const flagRow = page.locator('div.py-3', { hasText: 'e2e_admin_panel_toggle_test' })
  const flagForm = flagRow.locator('form[action="/api/admin/llm/feature-flags/update"]')
  await flagForm.locator('select[name="enabled"]').selectOption('false')
  await flagForm.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(`${hubBase}/admin/llm`)
  await expect(flagForm.locator('select[name="enabled"]')).toHaveValue('false')

  await flagForm.locator('select[name="enabled"]').selectOption('true')
  await flagForm.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(`${hubBase}/admin/llm`)

  await page.locator(rowSelector, { hasText: label }).getByRole('button', { name: 'Delete' }).click()
  await page.waitForURL(`${hubBase}/admin/llm`)
  await expect(page.getByText(label)).not.toBeVisible()
})

/**
 * greymatters_post_quality is one of only two feature flags with a real
 * sweep mechanism (post-quality.ts/reply-quality.ts + the
 * instrumentation.ts timer) -- the e2e_admin_panel_toggle_test flag the
 * test above uses has no sweep_interval_minutes field at all (only
 * SWEEPABLE_FEATURE_KEYS rows render one). This is real production
 * configuration, so the original interval is restored before the test
 * ends either way, and only the interval field is touched -- the row's
 * `enabled`/`provider_id` fields are left exactly as the form's own
 * current DOM state already has them, same as the existing test above
 * does for the e2e-only flag.
 */
test('an admin can set the AI sweep interval for a sweepable feature flag and it round-trips', async ({ page, cleanup }) => {
  const admin = await signUpStackWorksBuilder(page, cleanup, stackworksBase)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, `${hubBase}/dashboard`, hubBase)

  await page.goto(`${hubBase}/admin/llm`)

  const flagRow = () => page.locator('div.py-3', { hasText: 'greymatters_post_quality' })
  const flagForm = () => flagRow().locator('form[action="/api/admin/llm/feature-flags/update"]')

  const original = await flagForm().locator('input[name="sweep_interval_minutes"]').inputValue()

  try {
    await flagForm().locator('input[name="sweep_interval_minutes"]').fill('45')
    await flagForm().getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(`${hubBase}/admin/llm`)

    await expect(flagForm().locator('input[name="sweep_interval_minutes"]')).toHaveValue('45')
    await expect(flagRow()).toContainText(/Periodic sweep last ran|Periodic sweep off/)

    // Confirm the round-trip survives a full reload too, not just the
    // redirect's own re-render.
    await page.reload()
    await expect(flagForm().locator('input[name="sweep_interval_minutes"]')).toHaveValue('45')
  } finally {
    await flagForm().locator('input[name="sweep_interval_minutes"]').fill(original)
    await flagForm().getByRole('button', { name: 'Save' }).click()
    await page.waitForURL(`${hubBase}/admin/llm`)
  }
})
