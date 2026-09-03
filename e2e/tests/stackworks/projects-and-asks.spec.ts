import path from 'path'
import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, login } from '../../utils/auth'

test('a Builder posts a project, an ask, and an update', async ({ page, cleanup }) => {
  const builder = await signUpStackWorksBuilder(page, cleanup)
  await login(page, builder, '/dashboard')

  const projectTitle = `E2E StackWorks Project ${Date.now()}`
  await page.goto('/projects/new')
  await page.locator('#title').fill(projectTitle)
  await page.locator('#description').fill('A project used to exercise the stackworks ask/application flow.')
  await page.locator('#tech_stack').fill('TypeScript, Next.js')
  // Progressive-enhancement file upload -- same pattern as freeagent's
  // ImageUploader, just repeatable: the shared test-image.png fixture is
  // enough to prove the upload -> hidden-input -> gallery pipeline works
  // end to end.
  await page.setInputFiles('input[type="file"]', path.join(__dirname, '../../fixtures/test-image.png'))
  // MultiImageUploader renders a <label> (not a <button>) around the
  // hidden file input, and its text stays "Add image" throughout (it's
  // repeatable, not a single-image replace) -- the real signal that the
  // async storage upload finished is the thumbnail it renders once
  // urls.length > 0, so wait for that instead of the always-present label.
  // Bumped from 15s after a prod run showed the upload still genuinely
  // in-flight ("Uploading...") at that mark under concurrent test load,
  // not a missing-element bug -- Supabase Storage upload latency, not
  // this app's code.
  await expect(page.locator('img[alt=""]').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Post Project' }).click()
  await page.waitForURL(/\/projects\/[^/]+$/)

  const projectUrl = page.url()
  await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible()
  await expect(page.locator('img[alt=""]').first()).toBeVisible()

  await page.getByRole('link', { name: 'Post an ask' }).click()
  await page.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await page.locator('#role_title').fill('Frontend — onboarding flow')
  await page.locator('#skills').fill('React, Tailwind')
  await page.locator('#description').fill('Build the first-run onboarding screens.')
  await page.getByRole('button', { name: 'Post Ask' }).click()
  await page.waitForURL(/\/asks\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Frontend — onboarding flow' })).toBeVisible()

  await page.goto(projectUrl)
  await page.locator('textarea[name="body"]').fill('First devlog update.')
  await page.getByRole('button', { name: 'Post Update' }).click()
  await expect(page.getByText('First devlog update.')).toBeVisible()
})
