import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * Salary trend watch/alerts (063_salary_trend_alerts.sql, competitive
 * audit Aug 2026) -- a low-effort return trigger tied to the existing
 * salary-trends feature. Covers the UI-reachable part deterministically:
 * watching a role, the confirmation banner, and the idempotent
 * already-watching state. The underlying sweep_salary_trend_alerts()
 * comparison/notification logic itself was verified directly via SQL
 * against seeded salary_trends data (see migration commit notes) --
 * exercising the full alert-fires-on-a-15%-move path end-to-end would
 * require real k-anonymized (n>=3) trend data, which nothing in the
 * current UI flow reliably seeds from a single e2e run.
 */
test('a candidate can watch a salary trend and see it persist as already-watching', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, candidate, '/dashboard')

  const role = `E2E Watch Role ${Date.now()}`
  await page.goto(`/salary-trends?role=${encodeURIComponent(role)}`)
  await expect(page.getByRole('button', { name: 'Watch this trend' })).toBeVisible()

  await page.getByRole('button', { name: 'Watch this trend' }).click()
  await page.waitForURL(/watched=1/)
  await expect(page.getByText('You’ll be notified here when this trend moves by 15% or more.')).toBeVisible()
  await expect(page.getByText('You’re watching this trend — we’ll notify you of a material move.')).toBeVisible()

  // Idempotent -- revisiting the same role shows the already-watching
  // state without a duplicate watch row (UNIQUE constraint, 063).
  await page.goto(`/salary-trends?role=${encodeURIComponent(role)}`)
  await expect(page.getByText('You’re watching this trend — we’ll notify you of a material move.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Watch this trend' })).not.toBeVisible()
})
