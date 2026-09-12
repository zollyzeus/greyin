import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

test.describe('Discussions', () => {
  test('a member can start a discussion, see it in the feed, and reply to it', async ({ browser, cleanup }) => {
    const authorCtx = await browser.newContext()
    const authorPage = await authorCtx.newPage()
    const author = await signUpSaltNPepper(authorPage, cleanup)
    await login(authorPage, author, '/dashboard')

    const title = `E2E Discussion ${Date.now()}`
    await authorPage.goto('/discussions/new')
    await authorPage.locator('#title').fill(title)
    await authorPage.locator('#body').fill('Started by the Playwright e2e suite.')
    await authorPage.getByRole('button', { name: 'Post Discussion' }).click()
    await authorPage.waitForURL(/\/discussions\/(?!new)[^/]+$/)
    await expect(authorPage.getByRole('heading', { name: title })).toBeVisible()

    await authorPage.goto('/discussions')
    await expect(authorPage.getByText(title)).toBeVisible()

    const replierCtx = await browser.newContext()
    const replierPage = await replierCtx.newPage()
    const replier = await signUpSaltNPepper(replierPage, cleanup)
    await login(replierPage, replier, '/dashboard')

    await replierPage.goto('/discussions')
    await replierPage.getByText(title).click()
    await replierPage.waitForURL(/\/discussions\/(?!new)[^/]+$/)

    const replyText = `Great point — e2e reply ${Date.now()}`
    await replierPage.locator('textarea[name="body"]').fill(replyText)
    await replierPage.getByRole('button', { name: 'Post Reply' }).click()
    await expect(replierPage.getByText(replyText)).toBeVisible()
    await expect(replierPage.getByText('1 Reply')).toBeVisible()

    await authorCtx.close()
    await replierCtx.close()
  })
})
