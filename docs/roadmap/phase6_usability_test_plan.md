# Phase 6 usability test plan — 5 users, 3 core journeys

Prepared as Phase 6's "one usability pass" line item (`docs/roadmap/ui_ux_elevation_plan.md`). This needs real human participants and a moderator, so it isn't something that can be executed autonomously — this document is the script for whoever on the team runs it. Budget ~30 min per session.

## Recruiting

5 participants, mixed across:
- 2–3 who have never used Greyin or any of its 6 apps before
- 1–2 existing users (any pillar)
- At least 1 participant on mobile (phone-sized viewport), the rest on desktop — Mobile is one of the rubric's unverified dimensions (see the 2026-09-05 re-score), so this pass is also the first real signal on it

Don't recruit engineering team members — they already know where things are.

## Setup

- One seeded DeepEdge employer account (with at least 3 real candidate profiles to browse/search) and one seeded StackWorks builder account with an unscored submission ready to review, prepared in advance so the moderator isn't creating test data live in front of the participant.
- Screen recording + think-aloud protocol: ask the participant to narrate what they're looking for and why, at each step.
- Moderator does not help unless the participant is fully stuck for >90 seconds — note the stuck point either way.

## Journey 1 — Find talent (DeepEdge, employer persona)

**Scenario given to participant:** "You're a hiring manager. You need to find a senior React developer with at least 3 verified outcomes on the platform."

**Task:** Starting from the DeepEdge dashboard, find and open a matching candidate's profile.

**What to observe:**
- Does the participant find the rail's "Browse Candidates" item, or do they reach for `⌘K` / the Search button first?
- Do they notice and use the verified-outcomes filter, or scroll manually looking for a badge?
- Time to first candidate profile opened.

**Success:** Reaches a real candidate profile with ≥3 verified outcomes in under 2 minutes without moderator help.

## Journey 2 — Get verified (StackWorks, builder persona)

**Scenario given to participant:** "You just finished a project for a client through StackWorks. You want your work to count toward your verified track record."

**Task:** Find where a completed project gets submitted for verification, and check its review status.

**What to observe:**
- Do they find "My Applications" / the project's own status page, or look in Profile first?
- Do they understand the AI-scored vs. human-reviewed distinction if they encounter it?
- Do they notice the notification bell / section badge if a status change fires during the session (moderator can trigger one via the seeded account mid-task)?

**Success:** Locates the verification status for a real project and can explain, unprompted, what "AI-scored" vs. "human-reviewed" means.

## Journey 3 — Switch pillar

**Scenario given to participant:** "While you're on DeepEdge, you remember Greyin also has a blog. Go read something on it, then come back to DeepEdge."

**Task:** Navigate to GreyMatters from within DeepEdge, read a post, and return.

**What to observe:**
- Do they use the "Across Greyin" rail section, or `⌘K` search for an article, or scroll the page looking for a link?
- Do they notice they're still logged in on GreyMatters (SSO), or are they surprised/confused by it?
- How do they get back to DeepEdge — rail, browser back button, or typing the URL?

**Success:** Reaches GreyMatters and returns to DeepEdge without moderator help, and can articulate whether the switch felt like "the same product" or "leaving to a different site."

## After each session

Record, per journey: time to complete (or stuck point), whether the rail/⌘K/tour were used or ignored, and one direct quote capturing the participant's own words about the experience.

## Rollup

After all 5: for each journey, note whether ≥4 of 5 participants succeeded without help. A journey under that bar is the concrete input for the next iteration — pick the single biggest stuck point per journey rather than trying to fix everything noticed.

The analytics events shipped alongside this plan (`rail_nav_click`, `pillar_switch`, `notification_bell_open`, `command_palette_open`/`command_palette_navigate`, `tour_started`/`tour_completed`/`tour_skipped` — `analytics_events` table, `116_analytics_events.sql`) can cross-check these sessions' qualitative findings against real usage volume once there's enough traffic to look at.
