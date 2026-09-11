import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getUserIdByEmail, getGreyinScoreRow, getPostIdBySlug } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GreyMatters is the one pillar whose Verified-Expert-gated authorship
 * used to contribute zero evidence back into greyin_scores -- publishing
 * a post now triggers a real AI quality score (local Ollama fallback,
 * 048_ai_quality_scores.sql) that both displays on the post/profile AND
 * feeds this author's greymatters_score, a genuine 4th platform input
 * alongside StackWorks/FlexPro/Salt & Pepper. The score itself is
 * non-deterministic (a real local model), so this only asserts the
 * pattern and that it shows up in greyin_scores, not an exact number.
 */
test('publishing a post triggers an AI quality score that shows on the post, the profile, and feeds greyin_scores', async ({ page, cleanup }) => {
  const author = await signUpGreyMatters(page, cleanup)
  await login(page, author, '/dashboard')

  const title = `E2E AI Quality Post ${Date.now()}`
  await page.goto('/posts/new')
  await page.locator('#title').fill(title)
  await page.locator('#excerpt').fill('Exercises the AI quality scoring pipeline end to end.')
  await page.locator('#content').fill(
    'This post walks through setting up a small REST API with input validation, ' +
    'structured error handling, and a couple of unit tests covering the happy path ' +
    'and the most common failure mode.'
  )
  await page.locator('#status').selectOption('published')
  await page.getByRole('button', { name: 'Save Post' }).click()
  await page.waitForURL('/posts')

  // /posts (the author's own management list) only links to the edit
  // page, not the public post -- pull the slug out of that link rather
  // than assuming the title text itself is clickable.
  const editHref = await page
    .locator('a', { hasText: 'Edit' })
    .first()
    .getAttribute('href')
  const slug = editHref!.replace('/posts/', '').replace('/edit', '')

  await page.goto(`/posts/${slug}`)
  await expect(page.getByText(/AI quality: \d+\/100/)).toBeVisible({ timeout: 30_000 })

  await page.goto('/profile')
  await expect(page.getByText(/\d+ scored posts? · avg \d+\/100/)).toBeVisible()

  // The real point of this pillar becoming a 4th input, not just a
  // displayed number: confirm it actually landed in greyin_scores.
  const userId = await getUserIdByEmail(author.email)
  const scoreRow = await getGreyinScoreRow(userId)
  expect(scoreRow?.greymatters_evidence).toBeGreaterThanOrEqual(1)
  expect(scoreRow?.greymatters_score).toBeGreaterThanOrEqual(0)

  // Phase B2 ("11 new AI enhancements" plan) -- the same scoring call
  // now also emits an authenticity_flag, informational-only for admins.
  // Pattern-only assertion (real, non-deterministic LLM output): the
  // column is populated with one of the two valid values, not left null.
  const postId = await getPostIdBySlug(slug)
  const authRes = await fetch(`${SUPABASE_URL}/rest/v1/ai_quality_scores?post_id=eq.${postId}&select=authenticity_flag`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  })
  const [authRow] = await authRes.json()
  expect(['likely_original', 'possibly_ai_generated']).toContain(authRow?.authenticity_flag)
})
