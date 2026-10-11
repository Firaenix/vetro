# Dashboard review — 11 October 2026

Branch: `codex/dark-dashboard`.

The dashboard uses a dark, neutral palette, a fixed left navigation column on desktop, small SVG navigation icons and native app icons when available. No gradients, decorative animation, external fonts or UI dependencies were added. Quick Debloat and its handler were removed.

Product labels, descriptions, confirmations, action results, service errors and the TV probe screen are in English. App names, package IDs and firmware menu identifiers retain the values reported by the TV. Historical investigation notes and the rejected animation experiment are now archived privately; the public performance summary and MQTT setup guide are in English.

## App state

The list separates three facts:

- **App state:** Enabled, Disabled, Mixed or Unknown. Disabled rows and icons are muted. An unread flag is never treated as Enabled.
- **Processes:** Running with a linked process count, Not running, or Unknown. A disabled app can still have running processes. Summary monitor updates retain the last full process sample; samples older than 30 seconds become unknown. The list does not infer memory savings from app flags.
- **Startup:** Boot and Restart flags, independently shown as On, Off, Mixed or Unknown. Group rows do not turn a partial flag into an all-component status. Expanded rows show each component's flags.

CPU and RSS columns remain visible on wider windows. Below 1100 px they are hidden so the three state columns remain in view; resource values are available in the component drawer and Task manager. Category and origin appear beneath the app name. Package and component versions are in the drawer and expanded rows.

Launch is unavailable for disabled apps, unread app flags and components without a launcher entry. Stop is unavailable without a recent linked process. Unknown startup flags are labelled and their controls remain disabled. Existing mutation restrictions, verification and rollback behavior are preserved.

## Grouping check

A read-only inventory from the TV contained **414 app components in 344 packages**, displayed as **336 groups**. Every component was retained exactly once and each package belonged to one group. Cross-package families remain explicit: Alexa, Bixby, AirPlay and SmartThings. Similar names alone do not merge apps.

The AirPlay exact-app-ID rule now resolves the family at package level before grouping, preventing a UI and service in one package from being split. Shared voice infrastructure stays separate. Filtering matches components but retains the whole group for inspection.

The raw grouping audit is retained in the private diagnostics archive.

## Validation

- 41 Node test suites pass, including disabled-but-running, mixed and unknown flags, stale process samples, summary-to-full transitions and expanded table alignment.
- Browser checks used a local, read-only preview with captured TV inventory and monitor data. No app or TV setting was changed.
- Layout checked at 320, 375, 414, 768 and 1280 px. App state, process state and startup flags remained visible without table or page overflow.
- The ACR drawer showed Disabled and Not running, with Open app and Stop unavailable and Enable available. No mutation was sent.
- App-only package builds successfully. At the time of this UI review the package had not been installed. The final 0.2.0 deployment is recorded in the [release audit](RELEASE-AUDIT.md).

Reviewed screenshots: [Debloater](images/debloater.png), [mobile layout](images/mobile.png).
