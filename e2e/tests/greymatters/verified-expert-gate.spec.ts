import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { waitForURLResilient } from '../../utils/nav'

test.describe('GreyMatters Verified Expert authorship gate', () => {
  test('an under-12-years signup lands as a follower and cannot create a post', async ({ page, cleanup }) => {
    const follower = await signUpGreyMatters(page, cleanup, 5)
    await login(page, follower, '/dashboard')

    await page.goto('/posts/new')
    await page.locator('#title').fill(`E2E Follower Post Attempt ${Date.now()}`)
    await page.locator('#excerpt').fill('This should never be created.')
    await page.locator('#content').fill('RLS should block this insert.')
    await page.getByRole('button', { name: 'Save Post' }).click()

    await waitForURLResilient(page, /error=/, () =>
      page.getByRole('button', { name: 'Save Post' }).click()
    )
    await expect(page).toHaveURL(/error=/)
    await expect(page.getByText('Only Verified Experts can publish posts.')).toBeVisible()
  })

  test('a 12+-years author can publish a verified-expert-only post, visible to another verified expert but 404 to a follower', async ({ browser, cleanup }) => {
    const authorCtx = await browser.newContext()
    const authorPage = await authorCtx.newPage()
    const author = await signUpGreyMatters(authorPage, cleanup, 15)
    await login(authorPage, author, '/dashboard')

    const title = `E2E Verified Expert Only Post ${Date.now()}`
    await authorPage.goto('/posts/new')
    await authorPage.locator('#title').fill(title)
    await authorPage.locator('#excerpt').fill('Only verified experts should be able to read this.')
    await authorPage.locator('#content').fill('Content gated to the verified expert audience.')
    await authorPage.locator('#status').selectOption('published')
    await authorPage.locator('#view_audience').selectOption('verified_expert')
    await authorPage.getByRole('button', { name: 'Save Post' }).click()
    await authorPage.waitForURL('/posts')

    // /posts (the author's own list) only links to /posts/{slug}/edit, not
    // the public detail page directly -- the slug has a random suffix
    // (see slugify() in the create route) so it can't be predicted from the
    // title, but it's recoverable from that edit link's href.
    const row = authorPage.locator('div', { has: authorPage.getByText(title, { exact: true }) }).first()
    const editHref = await row.getByRole('link', { name: 'Edit' }).getAttribute('href')
    const slug = editHref!.replace('/posts/', '').replace('/edit', '')
    const postUrl = new URL(`/posts/${slug}`, authorPage.url()).toString()

    const followerCtx = await browser.newContext()
    const followerPage = await followerCtx.newPage()
    const follower = await signUpGreyMatters(followerPage, cleanup, 5)
    await login(followerPage, follower, '/dashboard')
    await followerPage.goto(postUrl)
    await expect(followerPage.getByText('404')).toBeVisible()

    const readerCtx = await browser.newContext()
    const readerPage = await readerCtx.newPage()
    const reader = await signUpGreyMatters(readerPage, cleanup, 15)
    await login(readerPage, reader, '/dashboard')
    await readerPage.goto(postUrl)
    await expect(readerPage.getByText(title)).toBeVisible()

    await authorCtx.close()
    await followerCtx.close()
    await readerCtx.close()
  })
})
