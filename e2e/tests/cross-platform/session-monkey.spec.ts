import type { Page } from '@playwright/test'
import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge } from '../../utils/auth'

/**
 * Randomized, multi-tab, multi-app session-consistency fuzzer -- built at
 * explicit user request ("need to do random monkey-testing before ruling
 * out signin/signout issue") after a user report ("clicked wishlist after
 * signing out from a pillar site... showing signout activated on header
 * but not showing login/account info") that three separate deterministic
 * repro attempts (cross-pillar sign-out then Hub nav, signing out
 * directly on Hub, sign-out then browser back-button/bfcache) all failed
 * to reproduce.
 *
 * Rather than guessing at more specific scripted sequences, this drives
 * a genuinely randomized sequence of realistic actions (sign in, sign
 * out, navigate, reload, switch tabs) across 2 tabs and all 7 apps'
 * *.greyin.net domains (the real shared-SSO-cookie surface), and checks
 * one invariant after every single step: does /dashboard (the one
 * protected route every app has) actually render for that tab if the
 * fuzzer's own tracked ground truth says the shared session is logged
 * in, and actually redirect to /login if it says logged out? A failure
 * here is a direct, load-bearing reproduction of the reported symptom --
 * a tab whose displayed state disagrees with the real session -- not a
 * proxy for it.
 *
 * Seeded (mulberry32) for reproducibility -- a failure prints the exact
 * seed and step log needed to reproduce it deterministically. Increase
 * STEPS or run with a different SEED for a longer/different fuzz run;
 * this default is sized to run in well under a minute against prod.
 */

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Override via SESSION_MONKEY_SEED / SESSION_MONKEY_STEPS for a longer or
// differently-randomized run; the committed defaults just need to be
// reproducible, not the only seed ever exercised.
const SEED = Number(process.env.SESSION_MONKEY_SEED) || 424242
const STEPS = Number(process.env.SESSION_MONKEY_STEPS) || 30

const APPS = [
  { name: 'deepedge', base: 'https://deepedge.greyin.net' },
  { name: 'flexpro', base: 'https://flexpro.greyin.net' },
  { name: 'stackworks', base: 'https://stackworks.greyin.net' },
  { name: 'saltnpepper', base: 'https://saltnpepper.greyin.net' },
  { name: 'greymatters', base: 'https://greymatters.greyin.net' },
  { name: 'longlist', base: 'https://longlist.greyin.net' },
  { name: 'hub', base: 'https://greyin.net' },
]

type Action = 'login' | 'logout' | 'goto-dashboard' | 'goto-home' | 'reload' | 'switch-tab'

async function checkDashboardState(page: Page, app: { name: string; base: string }, expectedLoggedIn: boolean, log: string[]) {
  await page.goto(`${app.base}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForLoadState('networkidle').catch(() => {})
  const url = page.url()
  const onLogin = /\/login/.test(url)
  log.push(`  check(${app.name}): expectedLoggedIn=${expectedLoggedIn} url=${url}`)
  if (expectedLoggedIn) {
    expect(onLogin, `${app.name}/dashboard redirected to login while the fuzzer's tracked session says logged in. Log:\n${log.join('\n')}`).toBe(false)
  } else {
    expect(onLogin, `${app.name}/dashboard did NOT redirect to login while the fuzzer's tracked session says logged out -- this is the reported bug class (stale "still logged in" state). Log:\n${log.join('\n')}`).toBe(true)
  }
}

test('randomized multi-tab session fuzzing finds no stale logged-in/out state', async ({ browser, cleanup }) => {
  test.setTimeout(120_000)
  const rand = mulberry32(SEED)
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

  const user = await (async () => {
    const ctx = await browser.newContext()
    const p = await ctx.newPage()
    const u = await signUpDeepEdge(p, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
    await ctx.close()
    return u
  })()

  const ctx = await browser.newContext()
  // This spec builds its own context instead of going through the login()
  // helper, so opt out of GuidedTour's auto-start here too -- its
  // full-viewport overlay otherwise sits over the /dashboard sign-out
  // control the fuzzer clicks. addInitScript is context-wide and covers
  // every tab and navigation.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('greyin:e2e-no-tour', '1')
    } catch {
      /* storage blocked -- tour just auto-starts, same as a real user */
    }
  })
  const tabs = [await ctx.newPage(), await ctx.newPage()]
  let active = 0
  // Ground truth the fuzzer itself tracks -- the shared .greyin.net
  // cookie means there is exactly one real logged-in/out state across
  // every tab and app at any moment, not one per tab.
  let loggedIn = false
  const log: string[] = [`seed=${SEED} steps=${STEPS} user=${user.email}`]

  for (let step = 0; step < STEPS; step++) {
    const page = tabs[active]
    const app = pick(APPS)
    const possible: Action[] = loggedIn
      ? ['logout', 'goto-dashboard', 'goto-home', 'reload', 'switch-tab']
      : ['login', 'goto-dashboard', 'goto-home', 'reload', 'switch-tab']
    const action = pick(possible)
    log.push(`step ${step}: tab=${active} app=${app.name} action=${action} (loggedIn=${loggedIn})`)

    switch (action) {
      case 'login': {
        await page.goto(`${app.base}/login`, { waitUntil: 'domcontentloaded' })
        await page.locator('#email').fill(user.email)
        await page.locator('#password').fill(user.password)
        await page.getByRole('button', { name: 'Sign in' }).click()
        await page.waitForLoadState('networkidle').catch(() => {})
        loggedIn = true
        break
      }
      case 'logout': {
        await page.goto(`${app.base}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {})
        await page.waitForLoadState('networkidle').catch(() => {})
        // Either SiteHeader's own "Sign Out" or a dashboard's bespoke
        // "Logout" -- both are the same <form action="/auth/logout">
        // pattern cross-platform/logout-flow.spec.ts already established.
        const signOutForm = page.locator('form[action="/auth/logout"] button').first()
        if (await signOutForm.count() > 0) {
          await signOutForm.click()
          await page.waitForLoadState('networkidle').catch(() => {})
          loggedIn = false
        } else {
          log.push(`  (no sign-out control found on ${app.name}/dashboard -- already logged out or page didn't render)`)
        }
        break
      }
      case 'goto-dashboard':
        await page.goto(`${app.base}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {})
        await page.waitForLoadState('networkidle').catch(() => {})
        break
      case 'goto-home':
        await page.goto(app.base, { waitUntil: 'domcontentloaded' }).catch(() => {})
        await page.waitForLoadState('networkidle').catch(() => {})
        break
      case 'reload':
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
        await page.waitForLoadState('networkidle').catch(() => {})
        break
      case 'switch-tab':
        active = 1 - active
        break
    }

    // The actual invariant check -- both tabs, every step, not just the
    // one just acted on (a stale OTHER tab is exactly the reported bug).
    for (let t = 0; t < tabs.length; t++) {
      await checkDashboardState(tabs[t], app, loggedIn, log)
    }
  }
})
