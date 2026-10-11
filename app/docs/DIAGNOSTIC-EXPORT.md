# Diagnostic report export

The Diagnostics panel downloads `vetro-diagnostics.json` through GET `/diagnostics/download`. The report stays on the user's computer. Vetro does not upload it or record watched content.

The `vetro-diagnostics` format has schema version 1. `appVersion` and `sourceRevision` identify the installed package; an unbuilt development checkout may have a null revision. Each of the 14 sections contains `status` (`ok`, `unavailable`, or `timeout`) and, when available, `data`. Readers only inspect existing state; no flags, processes, settings, or services are changed. Reads have a 20-second report deadline and concurrent downloads share the same collection. A timed-out platform read may still finish after the report returns.

Included: current authenticated root-agent connection state (not proof of persistence), platform/runtime status, model and firmware, package and component IDs/versions, classification, declared dependencies, disabled/boot/restart flags, current process names and resource metrics, numeric values of known TV settings, menu capability descriptors, public API probe availability, network connection methods, local filtering state, HbbTV/privacy state, and MQTT connection counters. Catalog availability is not proof that a control works. Process data is a snapshot, not viewing history or a benchmark.

Privacy policy `allowlist-v1` constructs a new object for every section. Unknown fields are dropped. Credentials, IP/MAC addresses, hostname, serial/boot/machine/MQTT identities, custom display names, author fields, SSIDs, configured DNS addresses, MQTT topics/payloads, process arguments/PIDs, URLs, raw error strings, user actions and consent records are excluded. Numeric metrics accept finite numbers only. Known technical string fields have bounded syntax and reject address/URL/user-path patterns.

Installed package IDs and current process names remain useful for analysis and can reveal which software is installed. This is a redacted technical report, not a guarantee against device fingerprinting. Arbitrary user-defined package IDs may themselves contain identifying text; review before sharing. There is no background collection or automatic sharing.

For analysis, check `schemaVersion`, each section status, nullable values, source limitations and incomplete dependencies before recommending changes. Null means unknown, not disabled. Do not infer write support from the firmware catalog. Preserve DNS configuration when changing filtering behavior.

Validation: privacy sentinel tests, partial failures and deadlines, concurrent HTTP downloads, download headers, browser JSON-file contents, and a browser download using captured TV data (414 components). The preview export marks captured data explicitly. A live download from the installed 0.2.0 integration returned all 14 sections, including authenticated root-agent status. One download does not prove cold-boot persistence.
