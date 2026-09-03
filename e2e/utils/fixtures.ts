import { test as base } from '@playwright/test'
import { Cleanup } from './cleanup'

/**
 * Drop-in replacement for `@playwright/test`'s `test`/`expect` — every spec
 * should import from here instead so it gets the `cleanup` fixture. Playwright
 * runs fixture teardown (the code after `await use(...)`) even when the test
 * body throws, so `cleanup.run()` firing here is what makes data isolation
 * unconditional rather than "cleans up on the happy path only".
 */
export const test = base.extend<{ cleanup: Cleanup }>({
  cleanup: async ({}, use) => {
    const cleanup = new Cleanup()
    await use(cleanup)
    await cleanup.run()
  },
})

export { expect } from '@playwright/test'
