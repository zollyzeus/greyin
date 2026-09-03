import path from 'path'
import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * fixtures/test-resume.pdf's text body is "Experienced with React,
 * PostgreSQL and AWS." — three entries from
 * api/candidates/parse-resume/route.ts's KNOWN_SKILLS list, so a real
 * pdf-parse extraction should suggest exactly those three and nothing else.
 */
test('uploading a resume suggests skills extracted from its text', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, candidate, '/dashboard')

  await page.goto('/profile')
  await page.locator('input[type="file"][accept=".pdf"]').setInputFiles(
    path.join(__dirname, '../../fixtures/test-resume.pdf')
  )

  const suggestions = page.locator('text=Found these in your resume')
  await expect(suggestions).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: '+ React' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ PostgreSQL' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ AWS' })).toBeVisible()

  await page.getByRole('button', { name: '+ React' }).click()
  await expect(page.locator('#skills')).toHaveValue('React')

  await page.getByRole('button', { name: 'Save Changes' }).click()
  await page.waitForTimeout(2000)
  await page.reload()
  await expect(page.locator('#skills')).toHaveValue(/React/)
})
