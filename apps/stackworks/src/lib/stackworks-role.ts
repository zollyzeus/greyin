/**
 * Builder eligibility is derived, not stored as a single flag: an
 * existing Salt & Pepper member (years_experience >= 12) is automatically
 * a Builder on stackworks via SSO, with zero stackworks-specific signup step.
 * stackworks_role only records which track someone picked when they
 * signed up directly on stackworks itself.
 */
export function isBuilder(profile: { years_experience: number | null; stackworks_role: string | null }): boolean {
  return (profile.years_experience ?? 0) >= 12 || profile.stackworks_role === 'builder'
}
