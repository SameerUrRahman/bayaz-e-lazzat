# Backlog

## Ride settings (user-configurable)
Let the user tune the ride instead of hardcoding it in `driveAlong.js`:
- **Speed** — cruise speed of the ride (currently `speed = 0.075` m/ms ≈ 270 km/h map-scale)
- **Ride vs fly thresholds** — for what distances a selection rides the streets
  vs flies (currently hardcoded: < 300 m ease, > 9 km or zoom < 12.8 fly)
- **Camera feel** — hover height / chase distance presets (e.g. "low & fast",
  "high & calm"); all named options in `driveAlong` already
- Surface as a small settings popover (gear icon) with parchment styling;
  persist in localStorage

## Mobile & app path
Tested 2026-07-08 on a 375×812 viewport: the map, rides, and 3D buildings all
work — it's a UI-layout problem, not a tech problem.
- **Responsive pass** — header overlaps FilterBar; filters + detail card
  together cover ~65% of a phone screen; DetailCard sits exactly where the
  rider rides (should collapse to a bottom sheet on small screens); overview
  center/zoom needs a mobile framing
- **Touch gaps** — tour/ride cancel listens to `dragstart`/`wheel` only;
  pinch-zoom (`zoomstart` from touch) should also cancel
- **PWA** — manifest + icons + service worker → installable from the browser,
  near-zero code change; the realistic "app" v1
- **Capacitor wrap** (later, only if store presence matters) — same codebase
  in a WebView, ships to Play Store
- Not worth it: React Native + MapLibre Native — would mean rewriting the
  whole camera/marker/recolor system

## Existing (from earlier sessions)
- Push to GitHub + deploy on Vercel
- Replace seed data with real researched spot list (more than 10)
