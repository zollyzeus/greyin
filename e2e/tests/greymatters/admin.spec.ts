import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, getPostIdBySlug } from '../../utils/admin'

test('an admin can unpublish a post and delete a comment', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpGreyMatters(authorPage, cleanup)
  await login(authorPage, author, '/dashboard')

  const title = `E2E Admin Moderation Post ${Date.now()}`
  await authorPage.goto('/posts/new')
  await authorPage.locator('#title').fill(title)
  await authorPage.locator('#content').fill('Created to exercise admin moderation.')
  await authorPage.locator('#status').selectOption('published')
  await authorPage.getByRole('button', { name: 'Save Post' }).click()
  await authorPage.waitForURL('/posts')
  await authorPage.getByRole('link', { name: 'Edit' }).first().click()
  await authorPage.waitForURL(/\/posts\/.+\/edit/)
  const postSlug = authorPage.url().split('/posts/')[1].replace('/edit', '')
  // posts.author_id is ON DELETE SET NULL, not CASCADE, so deleting the
  // author alone would leave this post behind — track it explicitly.
  cleanup.trackEntity('posts', await getPostIdBySlug(postSlug))
  await authorCtx.close()

  const commenterCtx = await browser.newContext()
  const commenterPage = await commenterCtx.newPage()
  const commenter = await signUpGreyMatters(commenterPage, cleanup)
  await login(commenterPage, commenter, '/dashboard')
  await commenterPage.goto(`/posts/${postSlug}`)
  const commentText = `E2E moderation comment ${Date.now()}`
  await commenterPage.locator('textarea[name="content"]').fill(commentText)
  await commenterPage.getByRole('button', { name: 'Post Comment' }).click()
  await expect(commenterPage.getByText(commentText)).toBeVisible()
  await commenterCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpGreyMatters(adminPage, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  await expect(adminPage.getByText(title)).toBeVisible()
  await expect(adminPage.getByText(commentText)).toBeVisible()

  adminPage.once('dialog', (d) => d.accept())
  await adminPage.getByText(commentText).locator('xpath=ancestor::div[contains(@class, "justify-between")][1]').getByRole('button', { name: 'Delete' }).click()
  await adminPage.waitForURL('/admin')
  await expect(adminPage.getByText(commentText)).not.toBeVisible()

  const postRow = adminPage.getByText(title).locator('xpath=ancestor::div[contains(@class, "justify-between")][1]')
  await postRow.getByRole('button', { name: 'Unpublish' }).click()
  await adminPage.waitForURL('/admin')

  // Re-locate after the redirect reloaded the page — confirm the status
  // badge actually flipped, not just that the button click navigated back.
  await expect(adminPage.getByText(title).locator('xpath=ancestor::div[contains(@class, "justify-between")][1]')).toContainText('archived')

  await adminPage.goto(`/posts/${postSlug}`)
  await expect(adminPage.getByText('This page could not be found', { exact: false })).toBeVisible()

  await adminCtx.close()
})

test('an admin can promote another user to admin and it grants real access', async ({ browser, cleanup }) => {
  const targetCtx = await browser.newContext()
  const targetPage = await targetCtx.newPage()
  const target = await signUpGreyMatters(targetPage, cleanup)
  const targetId = await getUserIdByEmail(target.email)
  await targetCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpGreyMatters(adminPage, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  await adminPage
    .locator(`input[name="user_id"][value="${targetId}"]`)
    .locator('xpath=..')
    .locator('select[name="role"]')
    .selectOption('admin')
  await adminPage
    .locator(`input[name="user_id"][value="${targetId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Update' })
    .click()
  await adminPage.waitForURL('/admin?role_updated=1')
  await expect(adminPage.getByText('Role updated.')).toBeVisible()
  await adminCtx.close()

  const targetCtx2 = await browser.newContext()
  const targetPage2 = await targetCtx2.newPage()
  await login(targetPage2, target, '/dashboard')
  await targetPage2.goto('/admin')
  await expect(targetPage2).toHaveURL('/admin')
  await targetCtx2.close()
})
