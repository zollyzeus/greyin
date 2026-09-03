import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'

test('the public People directory lists Builders and Supporters with the right role pill', async ({ page, cleanup }) => {
  const builder = await signUpStackWorksBuilder(page, cleanup)
  const supporter = await signUpStackWorksSupporter(page, cleanup)

  // pillar_memberships' RLS (035) gates on auth.role() = 'authenticated',
  // matching the rest of this codebase's "public-ish" listings (e.g.
  // builder_projects/project_asks) -- a genuinely anonymous request sees
  // nobody, so this needs a logged-in viewer, not just signed-up users.
  await login(page, supporter, '/dashboard')
  await page.goto('/people')

  const builderCard = page.locator('div.bg-white.rounded-lg.shadow-md', { hasText: builder.lastName })
  await expect(builderCard.getByText('Builder', { exact: true })).toBeVisible()
  await expect(builderCard.getByText('No verified outcomes yet')).toBeVisible()

  const supporterCard = page.locator('div.bg-white.rounded-lg.shadow-md', { hasText: supporter.lastName })
  await expect(supporterCard.getByText('Supporter', { exact: true })).toBeVisible()
})
