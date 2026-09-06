#!/bin/bash
# ============================================================
# Brand sync check -- UI/UX elevation plan, Phase 3
# ============================================================
#
# The platform's icon/color drift (39 files, fixed across three
# separate waves per docs/ui_ux_elevation_plan.md) is a hand-copy
# problem: PILLARS in EcosystemWidget.tsx is the single most-referenced
# canonical source (every app's SiteHeader "More Platforms" dropdown,
# WorkspaceShell's "Across Greyin" section, and AuthLayout's brand panel
# all key off it), duplicated by hand into all 6 apps per this
# codebase's established no-shared-package convention. This script is
# the "real sync mechanism" the plan asked for -- not a build step,
# just a one-command check to run before calling any cross-app rollout
# done, so a fourth drift wave is caught immediately instead of found
# by accident later.
#
# Usage: bash deployment/check-brand-sync.sh

set -e

APPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps" && pwd)"
APPS=(deepedge flexpro stackworks saltnpepper-community greymatters-blog longlist)

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

fail=0
reference_hash=""
reference_app=""

echo "Checking PILLARS array is byte-identical across all 6 apps..."
echo ""

for app in "${APPS[@]}"; do
  file=$(find "$APPS_DIR/$app/src" -iname "EcosystemWidget.tsx" 2>/dev/null | head -1)
  if [ -z "$file" ]; then
    echo -e "${RED}✗${NC} $app: EcosystemWidget.tsx not found"
    fail=1
    continue
  fi

  # Extract just the PILLARS data block (key/label/description/url/color
  # object literals) -- deliberately ignores surrounding comments, which
  # are allowed to differ per app (each has its own rationale for why a
  # given color was picked, see e.g. longlist's own copy).
  hash=$(grep -A8 "^export const PILLARS" "$file" | md5sum | awk '{print $1}')

  if [ -z "$reference_hash" ]; then
    reference_hash="$hash"
    reference_app="$app"
    echo -e "${GREEN}✓${NC} $app (reference)"
  elif [ "$hash" == "$reference_hash" ]; then
    echo -e "${GREEN}✓${NC} $app matches $reference_app"
  else
    echo -e "${RED}✗${NC} $app PILLARS data has drifted from $reference_app -- diff:"
    diff <(grep -A8 "^export const PILLARS" "$APPS_DIR/$reference_app/src/components/EcosystemWidget.tsx" 2>/dev/null || grep -A8 "^export const PILLARS" "$APPS_DIR/$reference_app/src/app/components/EcosystemWidget.tsx") \
         <(grep -A8 "^export const PILLARS" "$file") || true
    fail=1
  fi
done

echo ""
if [ "$fail" -eq 0 ]; then
  echo -e "${GREEN}All 6 apps' PILLARS data is in sync.${NC}"
else
  echo -e "${RED}Brand drift detected -- see above.${NC}"
fi

# ------------------------------------------------------------
# Second check: each app's own PILLARS hex color (the value every
# *other* app's copy uses to represent it) must match the Tailwind
# "from-" color on that app's own AuthLayout brand panel. This is
# the exact shape of the real bug found during Phase 3 (StackWorks'
# reset-password pages carried a stray blue-50/indigo-100 gradient
# left over from a copy-paste, instead of its own teal/emerald) --
# except this direction of the check catches it from the "source of
# truth" side rather than needing every page individually diffed.
#
# Only covers the specific Tailwind classes actually in use below;
# extend the map if a future palette pick isn't in it yet.
# ------------------------------------------------------------
echo ""
echo "Checking each app's AuthLayout brand color matches its own PILLARS hex..."
echo ""

declare -A TW_HEX=(
  [indigo-600]="#4F46E5" [sky-600]="#0284C7" [purple-600]="#9333EA"
  [orange-600]="#EA580C" [teal-600]="#0D9488" [amber-700]="#A16207"
)
declare -A APP_KEY=(
  [deepedge]=deepedge [flexpro]=flexpro [stackworks]=stackworks
  [saltnpepper-community]=saltnpepper [greymatters-blog]=greymatters [longlist]=longlist
)

for app in "${APPS[@]}"; do
  al=$(find "$APPS_DIR/$app/src" -iname "AuthLayout.tsx" | head -1)
  ew=$(find "$APPS_DIR/$app/src" -iname "EcosystemWidget.tsx" | head -1)
  key="${APP_KEY[$app]}"

  from_class=$(grep -m1 -oE "from-[a-z]+-[0-9]+" "$al" | head -1 | sed 's/^from-//')
  pillars_hex=$(grep -A8 "^export const PILLARS" "$ew" | grep "key: '$key'" | grep -oE "#[0-9A-Fa-f]{6}")
  expected_hex="${TW_HEX[$from_class]}"

  if [ -z "$expected_hex" ]; then
    echo -e "${RED}✗${NC} $app: AuthLayout uses '$from_class', not in the known-color map -- add it before trusting this check"
    fail=1
  elif [ "$(echo "$expected_hex" | tr a-z A-Z)" == "$(echo "$pillars_hex" | tr a-z A-Z)" ]; then
    echo -e "${GREEN}✓${NC} $app: AuthLayout ($from_class) matches its own PILLARS color ($pillars_hex)"
  else
    echo -e "${RED}✗${NC} $app: AuthLayout uses $from_class ($expected_hex) but its PILLARS entry says $pillars_hex -- drift!"
    fail=1
  fi
done

echo ""
if [ "$fail" -eq 0 ]; then
  echo -e "${GREEN}No brand drift detected.${NC}"
else
  echo -e "${RED}Brand drift detected -- see above.${NC}"
  exit 1
fi
