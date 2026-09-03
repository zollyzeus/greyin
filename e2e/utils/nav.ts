import type { Page } from '@playwright/test'

/**
 * This machine runs the suite alongside a lot of other concurrent work
 * (other dev processes, Docker, etc.), and Chromium's network-change
 * detector occasionally misfires under that load — the page lands on
 * chrome-error://chromewebdata even though the server-side action already
 * succeeded. Retrying the whole test (Playwright's built-in retries) works
 * but re-does an entire signup/checkout flow just to recover from a client-
 * side navigation hiccup. This retries only the specific action that
 * triggered the stuck navigation.
 */
export async function waitForURLResilient(
  page: Page,
  pattern: RegExp | string,
  retryAction: () => Promise<void>,
  attempts = 2
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.waitForURL(pattern, { timeout: 20_000 })
      return
    } catch (err) {
      if (attempt >= attempts) throw err
      await retryAction()
    }
  }
}
