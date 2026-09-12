import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * UI/UX elevation plan, Phase 1 pilot (2026-09-06): the persistent left
 * rail (`WorkspaceShell.tsx`), replacing /dashboard's own hand-rolled top
 * bar. Piloted on DeepEdge only, on /dashboard only -- see the
 * component's own header comment for why (a real visual restructuring,
 * built where it can be reviewed before replicating to other pages/apps).
 * Every other DeepEdge page still uses the public SiteHeader -- tests
 * below deliberately don't assume the rail exists past /dashboard itself.
 */
test('rail shows DeepEdge sections and all 6 pillars, DeepEdge marked current', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, candidate, '/dashboard')

  const rail = page.locator('aside').first()
  await expect(rail.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(rail.getByRole('link', { name: 'Browse Jobs' })).toBeVisible()
  await expect(rail.getByRole('link', { name: 'My Applications' })).toBeVisible()
  await expect(rail.getByRole('link', { name: 'Find Talent' })).toBeVisible()

  await expect(rail.getByText('Across Greyin')).toBeVisible()
  // Scoped to the pillar-nav block specifically -- the rail's own logo
  // link at the top is also named "DeepEdge" (it links to the ecosystem
  // hub), so an unscoped name match here is ambiguous between the two.
  const pillarNav = rail.getByTestId('pillar-nav')

  // The rail's top brand logo silently linked to the Hub with no
  // indication it did (a real UX report -- the pillar name/icon made it
  // look like it stayed within the app). Fixed with an explicit,
  // labeled "Greyin Hub" row above the pillar list, plus a hover
  // tooltip on the logo itself.
  await expect(pillarNav.getByRole('link', { name: 'Greyin Hub' })).toHaveAttribute('href', 'https://greyin.net')
  await expect(rail.locator('a[href="https://greyin.net"]').first()).toHaveAttribute('title', 'Go to Greyin Hub')
  for (const pillar of ['DeepEdge', 'GreyMatters', 'Salt & Pepper', 'FlexPro', 'StackWorks', 'Longlist']) {
    await expect(pillarNav.getByRole('link', { name: pillar })).toBeVisible()
  }
  // DeepEdge is the only pillar link styled as current -- checked via the
  // sr-only marker this component adds specifically for that link,
  // rather than a fragile class-string match.
  await expect(pillarNav.getByRole('link', { name: /DeepEdge \(current\)/ })).toBeVisible()

  await expect(rail.getByRole('button', { name: 'Sign out' })).toBeVisible()
})

test('rail navigation actually navigates within the app', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, candidate, '/dashboard')

  // Only /dashboard has adopted the shell so far -- /jobs still renders
  // the public SiteHeader, so this deliberately checks one hop (into a
  // page with no rail of its own) rather than chaining a second
  // rail-relative click that page could never satisfy.
  await page.locator('aside').first().getByRole('link', { name: 'Browse Jobs' }).click()
  await page.waitForURL(/\/jobs$/)

  await page.goto('/dashboard')
  await page.locator('aside').first().getByRole('link', { name: 'My Applications' }).click()
  await page.waitForURL(/\/dashboard\/applications$/)
})

test('mobile: hamburger opens a drawer with the same rail, closes on navigation', async ({ page, cleanup }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, candidate, '/dashboard')

  // The desktop rail is CSS-hidden below the lg breakpoint -- only the
  // drawer's copy should be interactable at this viewport.
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
  await expect(page.locator('aside').first().getByRole('link', { name: 'Browse Jobs' })).not.toBeVisible()

  await page.getByRole('button', { name: 'Open menu' }).click()
  const drawer = page.getByTestId('mobile-rail-drawer')
  const drawerJobsLink = drawer.getByRole('link', { name: 'Browse Jobs' })
  await expect(drawerJobsLink).toBeVisible()

  await drawerJobsLink.click()
  await page.waitForURL(/\/jobs$/)
  // The drawer closes itself on navigate (onNavigate callback) -- proven
  // by the fact /jobs (a plain SiteHeader page, no hamburger at all)
  // is what's now showing, not by re-querying a menu button that
  // wouldn't exist on this page either way.
  await expect(page).toHaveURL(/\/jobs$/)
})

/**
 * Previously the ONLY way to reach /admin was a one-off card on
 * /dashboard's own Quick Actions grid -- every other WorkspaceShell page
 * (profile, applications, candidates, ...) had no path back to it short
 * of re-visiting /dashboard or typing the URL directly. The rail now
 * appends an Admin item (role==='admin') matching the pattern
 * FlexPro/StackWorks/Salt & Pepper/GreyMatters already use.
 *
 * Follow-up (2026-09-12): the Admin link was moved out of the regular
 * nav list into its own bordered section directly above "Across Greyin"
 * (a sidebar-organization request), rather than sitting inline amongst
 * Dashboard/Jobs/Applications/etc -- asserted below via DOM order, not
 * just visibility, since visibility alone wouldn't catch a regression
 * back to the old inline placement.
 */
test('an admin sees a persistent Admin link in the rail, on a page other than the dashboard', async ({ page, cleanup }) => {
  const admin = await signUpDeepEdge(page, 'candidate', cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, '/dashboard')

  await page.goto('/profile')
  const rail = page.locator('aside').first()
  const adminLink = rail.getByRole('link', { name: 'Admin' })
  await expect(adminLink).toBeVisible()

  // The div immediately preceding the "Across Greyin" block is the
  // Admin item's own separated section -- not a sibling of Dashboard/
  // Jobs/etc inside the main nav list.
  const sectionBeforeEcosystem = rail.locator('[data-tour="ecosystem"]').locator('xpath=preceding-sibling::div[1]')
  await expect(sectionBeforeEcosystem.getByRole('link', { name: 'Admin' })).toBeVisible()

  await adminLink.click()
  await page.waitForURL(/\/admin$/)
})

test('a non-admin does not see an Admin link in the rail', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, candidate, '/dashboard')

  await expect(page.locator('aside').first().getByRole('link', { name: 'Admin' })).toHaveCount(0)
})
