# Changelog

## Unreleased

- **Quick settings** is the first panel: switches for HbbTV, ACR viewing data, domain blocking, Alexa, Google Assistant, Bixby and voice services, with in-page confirmation for voice switches (the remote microphone button stops working). Groups apply the disabled flag to every installed member in one step, verify it in the registry, roll back on failure and stop members still running.
- **Install leftovers** cleanup ported from Apps2Samsung (MIT): package files in the install staging folder, deleted one at a time, with bytes freed and storage before and after. Refused while an installation is running.
- **App catalog** from the firmware manifests: area, role and purpose for each package; references from other packages, event and key-sequence launches and microphone/camera/location access in the component drawer. `app/scripts/build-app-catalog.py` regenerates `service/app-facts.js` from a private dump.
- **Debloater** layout: role filters with counts, one State column, Startup listing only flags that are on, CPU/RAM only while sampled, duplicate names disambiguated, startup flags as switches.
- The Remote panel polls only while listening; stopping capture returns to the saved interception choice.
- Navigation grouped by task; HbbTV, domain blocking and MQTT use switches; privacy values use words instead of Yes/No.
- Dashboard live sampling starts off. **Start live** samples the TV for 2 minutes and stops by itself; opening a component drawer takes one sample when process data is stale.
- CPU, network and paging rates restart after a gap of more than 60 seconds instead of reporting an average over the idle period.

## 0.2.3 — unreleased

- English-only service messages: MQTT validation and event log, MQTT rule results, local domain filter errors.
- Removed an unused MQTT storage publication that telemetry never supplied.
- Read-only startup delay recorder (`app/scripts/boot-test.py`) with fixture tests and [instructions](app/docs/BOOT-TEST.md). The TV address comes from `--base` or `TV_IP`; no device address is built in.
- English benchmark script messages and report text.
- README corrections: saved remote interception resumes automatically after rule edits, helper reconnection and service restarts; current test-suite count; final RAM difference matches the performance summary.

Not yet installed or verified on the test TV.

## Source preview — 2026-10-11

- Minimal dark dashboard with English product copy and explicit app/process/startup states.
- Grouped component inventory with package/family boundaries and unknown-state handling.
- Redacted JSON diagnostic downloader and current platform/root status fields.
- Issue form, deterministic community report analysis and bot-comment workflow.
- Separate app-only and privileged integration packaging, with integration-boundary tests.
- Explicit signing credentials, original-code MIT license and upstream notices.
- Public installation/compatibility documentation with measured performance limitations.
- Private raw reports, device certificates and signed test packages excluded from the current tracked snapshot.

Vetro 0.2.0 is installed on the test TV. Dashboard contents, all 14 diagnostic sections and continued background operation after closing the app are verified. Unattended cold boot of this version remains to be tested. Private historical Git data is archived outside the fresh publication repository.
