import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

/**
 * SEO / distribution (competitive audit, Aug 2026): DeepEdge's
 * biggest gap against Indeed is reach, not features -- job postings
 * weren't indexable as jobs at all. Covers both new surfaces: the
 * sitemap listing a real open job, and JobPosting schema.org JSON-LD
 * on the job detail page (what Google for Jobs actually keys off).
 */
test('sitemap.xml lists a real open job, and its detail page carries JobPosting JSON-LD', async ({ page, cleanup }) => {
  const employer = await signUpDeepEdge(page, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(page, employer, '/employer/dashboard')

  const jobTitle = `E2E SEO Test Role ${Date.now()}`
  await page.getByRole('link', { name: 'Post Job' }).first().click()
  await page.waitForURL('/employer/post-job')
  await page.locator('#title').fill(jobTitle)
  await page.locator('#description').fill('Role used to exercise sitemap and JobPosting structured data.')
  await page.getByRole('button', { name: 'Publish Job' }).click()
  await page.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  const sitemapResponse = await page.request.get('/sitemap.xml')
  expect(sitemapResponse.status()).toBe(200)
  const sitemapXml = await sitemapResponse.text()
  expect(sitemapXml).toContain(`/jobs/${jobId}`)

  await page.goto(`/jobs/${jobId}`)
  const jsonLdText = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(jsonLdText).toBeTruthy()
  const jsonLd = JSON.parse(jsonLdText!)
  expect(jsonLd['@type']).toBe('JobPosting')
  expect(jsonLd.title).toBe(jobTitle)
  expect(jsonLd.hiringOrganization?.['@type']).toBe('Organization')

  const robotsResponse = await page.request.get('/robots.txt')
  expect(robotsResponse.status()).toBe(200)
  expect(await robotsResponse.text()).toContain('sitemap.xml')
})
