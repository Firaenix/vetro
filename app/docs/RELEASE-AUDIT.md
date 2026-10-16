# Release audit — 2026-10-11

## Scope and results

Release preparation was completed on `codex/public-release`; the publication checkout now uses a fresh `main`. Source review covers app packaging, optional integration, current device observations, diagnostics, issue analysis and distribution hygiene. No TV flags, settings or packages were changed during this audit.

- Before reboot, the TV management endpoint reported the integration running and an authenticated UID-0 agent. A monitor summary was available.
- The owner confirmed a complete power cycle without opening Vetro or launching it from the PC. The first postboot HTTP attempt failed while the TV was starting. A later check reached Vetro; comparison with the private preboot checkpoint confirmed a different boot. Vetro was running and its authenticated agent reported UID 0. See `release-cold-boot.json` for non-identifying results.
- This verifies unattended background service startup and root reacquisition for one cold boot of the currently installed integration. It is not proof across other firmware or repeated boots, and refers to the package installed before the final release update.
- Local integration tests verify peer authentication, UID checks, lifecycle/retry behavior, detached launcher exit and a still-running fixture child. App-only packaging is independently tested.

## Local validation

44 application suites, 6 integration suites and 11 Python parser tests pass. The app-only WGT builds successfully. YAML syntax parses for the issue form and both workflows. The analysis parser rereads the captured 414-component diagnostic report and correctly marks absent platform/root evidence unknown. The 0.2.0 integration was subsequently signed with the owner’s profile and installed; see the installed-version checks below. No hosted Actions run is claimed.

## Issues found and changes

1. Old READMEs contradicted newer code and tests (disabled service, suspended controls, old package ID and polling intervals). Replaced public entry points with current evidence and explicit limits.
2. Tracked raw device reports, certificates and signed test WGTs were unsuitable for publication. Archived approved private material outside the checkout. Historical SDKs, tooling, duplicate payload copies and obsolete research notes were moved to the recoverable private archive. Runtime integration payloads and their source/test code remain intact.
3. Signing builder used shared fallback passwords and implicit local certificates. It now requires explicit certificate and password environment variables. Certificates are supplied by each installer, not distributed.
4. Diagnostic export lacked platform/root status. Added allowlisted current connection/UID/runtime fields; persistence and background-proof fields remain `unknown` because one exported snapshot cannot prove a cold boot.
5. The repository had no issue-analysis pipeline, original-code license or complete attribution. Added MIT for original code, separate upstream notices, a report form, bounded deterministic parser and least-privilege workflow.
6. The current management HTTP server has no browser authentication. No login/security redesign is claimed by this release. Treat it as privileged trusted-LAN software; do not expose it to the Internet. Authentication and restricted access are a public deployment priority.

## Public snapshot versus Git history

The previous private Git directory and a source checkpoint were moved to a recoverable archive outside this checkout. A fresh `main` was initialized from the audited current sources. Old commits, branches, reflogs and device-bound objects are absent from the new repository. This operation preserves the private backup; it does not publish or push anything.

Private certificate material must not be published. If any credential was previously disclosed, deleting a file is not revocation: replace the credential through its issuer. No known public credential disclosure was established here.

## Outstanding validation

- Repeat unattended cold-boot checks on the installed 0.2.1 integration; UI-close continuity is verified.
- Multiple power cycles, firmware updates, changed Developer Mode/Host PC IP and multiple clients.
- Live MQTT with broker/TLS/authentication/discovery cleanup; currently fixture tests only.
- Actual app ads requests through local filtering, both A/AAAA and resolver bypass paths.
- Fixture package reinstall/restore after removal; arbitrary system services remain read-only.
- Validated frame presentation/readiness measurements, repeated ABBA benchmarks and broader devices.
- GitHub-hosted workflow/comment permission/attachment download validation after deployment to the default branch. Local parser tests and HTTP mocks are not a hosted run.
- Public management authentication and a documented supported signing route for each intended TV.

## Packaging policy

Standalone app: feature sources only, unavailable-device platform adapter, no rooting payload/SDB/signing code. Integration: explicit additional adapter and active runtime payloads. The source archive excludes raw diagnostics, certificates, local configs, SDK binaries, obsolete prototype directories and duplicate payload build outputs. Reviewed UI screenshots are retained in `docs/images/`.

A release audit script checks current tracked files, private-key markers, architecture boundaries and private artifacts. An export archive must be inspected independently; neither a successful unit test nor signing establishes root compatibility.

## Excluded local experiments

The abandoned animation experiment and its historical test were moved to the recoverable private archive. The current runner and public snapshot both have 44 application suites. These files are not app features, dependencies or release assets.

## English copy audit

The MQTT setup guide and remaining user-visible service messages are in English. The guide now describes the implemented Last Will and per-TV availability instead of the obsolete limitation. Historical Italian investigation notes are preserved privately; `PERFORMANCE.md` summarizes their performance evidence and limits in English. Original upstream documentation remains unchanged.

## Installed-version checks

Vetro 0.2.0, source revision `f85e0fadc34296a0ea9af0b5b567bf3454a0e8c9`, was signed and installed on the test TV. The native installer returned success, the served dashboard matched the source exactly, and `/status` confirmed that revision with an authenticated UID-0 agent. The live diagnostic download returned all 14 sections and the expected version/revision. Closing the foreground app left the background service and root agent running. App disabled/boot/restart flags, remote rules, custom DNS resolvers and filter domains matched their pre-install snapshots. See `release-installed.json`. A cold boot of this new version has not been tested.

## Debloater correction and device round trip

The drawer previously hid actions below metadata and restricted disable/enable to five known system components. Removable user packages incorrectly received the same restriction. The backend and browser now share eligibility checks: installed removable user components can be disabled/enabled; protected components and unverified system components remain restricted. Uninstall eligibility follows package removability and protects all package siblings. Busy requests are serialized; stop verification forces a new process sample.

On 2026-10-11 a signed disposable `vtrtestapp` web package was installed on the test TV. API disable/enable and browser disable/enable succeeded with registry readback. Browser start-at-boot on/off, launch, stop and package uninstall succeeded. Uninstall was independently checked against the refreshed inventory, native package list and installation directory. The fixture and its temporary files were removed. All original app disabled/boot/restart flags, remote rules and custom DNS matched the pre-fix snapshot. A live-update regression also corrected stale explanations alongside Stop now. The 44 app suites, 6 integration suites and 11 parser tests pass.

Actions are above collapsible package details. Disabled controls give a reason, verified changes remain visible in the drawer and session action history, and errors retain the drawer. This test does not validate arbitrary system-package removal, reinstatement after uninstall, or another cold boot.

The corrected Vetro 0.2.1 build (`6a0c8cd`) was then signed and installed. Its served dashboard exactly matched the source. Original app flags, remapper rules and custom DNS were preserved. See the updated `release-installed.json` for the installed source revision and diagnostic results. Cold boot of this version remains untested.

## Browser confirmation correction

The owner reported that Disable and Uninstall worked in the embedded browser but silently did nothing in another PC browser because the native confirmation did not appear. A regression test suppresses `confirm()` and reproduces the missing confirmation. Vetro 0.2.2 replaces native dialogs with an in-page confirmation, explicit Cancel/Confirm controls, package scope and focus management. Dashboard HTML is served with `Cache-Control: no-store`. The latest read-only device check confirms the owner removed the e-Manual web package; its separate system companion remains.

The installed 0.2.2 dashboard exactly matched the source and returned the no-store header. Browser Cancel did not change the fixture; Confirm disable produced verified Disabled state, Enable returned it to Enabled, and Confirm uninstall removed it from the inventory, native package list and filesystem. No browser console errors were observed. Native-dialog suppression is also covered by the regression test. Whole-TV app flag preservation is not asserted for this update because other app actions occurred concurrently. See `confirmation-validation.json`. The 44 application suites pass.

### Persistent remote interception — 2026-10-11

Fixed the remote interception setting resetting to off when Vetro restarted. The Remote panel now uses a persistent switch. Vetro restores the selected physical remote after the platform adapter connects and retries after helper disconnects. Editing rules reapplies the saved preference with the updated physical shortcuts; listening is temporary. Explicit off also survives a restart.

The signed update was installed on the Q80A test TV. The served dashboard exactly matched the build; app flags, remapper rules and DNS configuration were preserved. Actual service restarts verified both saved on and saved off. After the owner rebooted the TV without manually opening Vetro, the service and authenticated UID-0 agent returned automatically, with the filter connected and both saved key codes blocked. Two distinct TV boots were verified privately. The filter was observed connected at approximately 115 and 118 seconds of uptime. After automatic restoration on the second boot, the owner confirmed that the Prime Video button opened Stremio. Native key behavior remains during the startup window before Vetro and the helper are ready. The TizenTube key was blocked and its launch action reported no error, but the owner saw YouTube; TizenTube behavior was not validated. This is evidence for this TV and these reboots, not a guarantee for all firmware or an unplugged cold boot. All 45 app suites and 6 integration suites passed. See `remote-persistence-verified.json`.

## Quick settings installation — 2026-10-16

Vetro 0.2.3 from `quick-settings`, revision `0ced7e21dbfc98cb83d39dcc09d3a61132a7b298`, was signed and installed on the test TV. The transferred WGT matched its local SHA-256. Updating the running application closed the install HTTP connection; a subsequent independent `/status` check confirmed the new version, exact source revision, running service and authenticated UID-0 agent. No second install was submitted.

The live browser dashboard was opened to Quick settings and Debloater. The reviewed screenshots `images/quick-settings.jpg` and `images/debloater-current.jpg` show the installed UI, not a mockup. No device controls were changed to stage these screenshots. This confirms installation and UI availability; it is not a new cold-boot, resource-saving, voice-service or tracking-blocking validation. The 51 application suites, 6 integration suites and 11 parser tests pass locally.
