import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { createTestPost, deleteTestPost, getUserIdByEmail } from '../../utils/admin'

/**
 * GreyMatters cross-posting (competitive audit, Aug 2026): GreyMatters'
 * gap against Medium is reach, not writing capability -- a candidate's
 * published articles now surface directly on their open DeepEdge
 * profile, which is where an employer is actually looking. posts.author_id
 * references auth.users, not public.profiles, so createTestPost's default
 * author_id (null) has to be overridden to the candidate's own id.
 */
test('a candidate\'s published GreyMatters article shows on their open DeepEdge profile', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, candidate, '/dashboard')
  const candidateId = await getUserIdByEmail(candidate.email)

  const articleTitle = `E2E Cross-Posting Article ${Date.now()}`
  const { id: postId } = await createTestPost({ title: articleTitle, author_id: candidateId })

  try {
    await page.goto(`/candidates/${candidateId}`)
    await expect(page.getByText('Authored articles on GreyMatters')).toBeVisible()
    await expect(page.getByText(articleTitle)).toBeVisible()
  } finally {
    await deleteTestPost(postId)
  }
})
