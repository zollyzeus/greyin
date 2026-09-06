import { test, expect } from '../../utils/fixtures'

/**
 * UI/UX elevation plan, 2026-09-06 post-Phase-6 footer restructure.
 * The footer is on every page including logged-out ones (mounted in
 * layout.tsx), so this needs no signup -- it runs against /login.
 */

test('the pillar footer carries every cross-pillar link, the share row, socials, and the Greyin bottom bar', async ({ page }) => {
  await page.goto('/login')
  const footer = page.locator('footer')

  // Cross-pillar row: all 6 pillars + both tracks + Wishlist/Feedback.
  for (const name of ['DeepEdge', 'GreyMatters', 'Salt & Pepper', 'FlexPro', 'StackWorks', 'Longlist']) {
    await expect(footer.getByRole('link', { name, exact: true })).toBeVisible()
  }
  await expect(footer.getByRole('link', { name: 'Pivoting', exact: true })).toHaveAttribute('href', 'https://greyin.net/pivoting')
  await expect(footer.getByRole('link', { name: 'Returning to Work', exact: true })).toHaveAttribute('href', 'https://greyin.net/reentry')
  await expect(footer.getByRole('link', { name: 'Wishlist', exact: true })).toHaveAttribute('href', 'https://greyin.net/wishlist')
  await expect(footer.getByRole('link', { name: 'Feedback', exact: true })).toHaveAttribute('href', /greyin\.net\/feedback\?app=/)

  // Share row -- the three page-share buttons carry this page's URL.
  await expect(footer.getByText('Share this page')).toBeVisible()
  await expect(footer.getByRole('link', { name: 'LinkedIn', exact: true })).toHaveAttribute('href', /linkedin\.com\/sharing\/share-offsite\/\?url=https/)
  await expect(footer.getByRole('link', { name: 'X / Twitter', exact: true })).toHaveAttribute('href', /x\.com\/intent\/post\?url=/)
  await expect(footer.getByRole('link', { name: 'WhatsApp', exact: true })).toHaveAttribute('href', /wa\.me\/\?text=/)

  // Greyin's own social handles (placeholder greyinofficial for now).
  await expect(footer.getByRole('link', { name: 'Greyin on LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/company/greyinofficial')
  await expect(footer.getByRole('link', { name: 'Greyin on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/@greyinofficial')

  // Bottom bar. (DeepEdge's Company column also has a "Contact" link to
  // /enterprise-contact -- the bottom-bar one is last in DOM order.)
  await expect(footer.getByRole('link', { name: 'Greyin', exact: true })).toHaveAttribute('href', 'https://greyin.net')
  await expect(footer.getByText(`© ${new Date().getFullYear()} Greyin. All rights reserved.`)).toBeVisible()
  await expect(footer.getByRole('link', { name: 'Contact', exact: true }).last()).toHaveAttribute('href', /greyin\.net\/feedback\?app=/)
})

test('the Hub footer brand block is track-aware on /pivoting and /reentry, and the Greyin lockup elsewhere', async ({ page }) => {
  const footer = page.locator('footer')

  await page.goto('https://greyin.net/pivoting')
  await expect(footer.getByText('Career changers, matched to employers who want them.')).toBeVisible()

  await page.goto('https://greyin.net/reentry')
  await expect(footer.getByText('A career gap, shown with context', { exact: false })).toBeVisible()

  await page.goto('https://greyin.net/')
  await expect(footer.getByText('One account, six platforms, built for experienced professionals.')).toBeVisible()
})
