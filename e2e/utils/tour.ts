import type { Page } from '@playwright/test'

/**
 * GuidedTour.tsx auto-starts ~600ms after a fresh user's first page load
 * (see cross-platform/guided-tour.spec.ts, the acceptance test for that
 * behavior) and is a full-viewport modal that blocks clicks on anything
 * but the current step's target. A test whose first real action after
 * login lands within that window -- little or no typing/navigation in
 * between to burn off the 600ms -- can race straight into it. Call this
 * right before such an action; it no-ops quickly if the tour never
 * showed up, so it's safe to sprinkle in without slowing down specs
 * where the race can't happen.
 */
export async function dismissGuidedTourIfShown(page: Page) {
  const skip = page.getByTestId('guided-tour-skip')
  try {
    await skip.waitFor({ state: 'visible', timeout: 1500 })
    await skip.click()
  } catch {
    // Never appeared in the window -- nothing to dismiss.
  }
}
