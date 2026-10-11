# Community report analysis

The issue form is `.github/ISSUE_TEMPLATE/log_report.yml`. It requests model, firmware, Vetro version and one JSON upload. GitHub issue forms support an upload field; see the [official form schema](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema#upload). If that preview feature is unavailable, use the fallback issue instructions in the root README.

`analyze-log.yml` runs for opened/edited issues matching the report title and heading. It checks out the default branch's parser with a pinned checkout action and no persisted credentials. Issue text is read through `GITHUB_EVENT_PATH`, never interpolated into shell commands. No pull-request code, attached script, executable or archive is run.

The parser accepts schema version 1 or legacy UTF-8 text, maximum 2 MiB. Prefer the redacted JSON. It supports a GitHub file attachment or one fenced JSON block. Only recognized HTTPS GitHub attachment paths and explicit CDN redirect hosts are accepted; custom ports, other destinations, compressed responses and multiple reports are rejected. Downloads are bounded and never receive the comment token. These URL restrictions are implementation choices, not a guaranteed permanent GitHub URL contract; update them only after reviewing a legitimate failed host.

The comment step alone receives the scoped token (`contents: read`, `issues: write`). It posts/updates only its own marked bot comment. Raw values, user-provided errors and attachment URLs are not quoted in the output. Model/firmware use a restricted token format. Unknown root/network/background states stay unknown; UID 0 at capture time does not establish persistence. Model matching is a comparison to one tested TV, not certification. The analysis is deterministic Python; no LLM receives the report.

Local use:

```sh
python3 .github/scripts/parse_log.py --file /path/to/vetro-diagnostics.json --output /tmp/diagnostic-comment.md
python3 .github/scripts/test_parse_log.py
```

Hosted activation: merge files into the default branch, enable Issues and Actions, and permit the scoped workflow token to write issue comments. Open a disposable issue with a reviewed diagnostic fixture and verify the upload, comment and edited-issue update. No GitHub remote is configured locally, so that hosted test has not been performed. Private repositories may restrict unauthenticated attachments; use a reviewed inline JSON block rather than forwarding tokens to arbitrary hosts.

Primary references: [issue triggers](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issues), [script-injection guidance](https://docs.github.com/en/actions/concepts/security/script-injections), [file attachments](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files).
