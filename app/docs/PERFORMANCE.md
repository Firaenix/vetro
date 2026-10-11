# Performance measurements

## Exploratory A/B test — 2026-10-11

Test device: Samsung QE50Q80AATXZT, Tizen 6, firmware T-NKM2DEUC-2301.1. Both sequences completed; the owner confirmed that all five apps opened and Netflix scrolled normally.

A re-enabled the five application-disable flags present in the baseline. B restored those exact flags. Startup and autorestart flags, DNS, HbbTV and Vetro version stayed unchanged. Each phase followed a complete power cycle; their initial uptimes differed by less than 0.28 seconds. This was not a factory reset.

| Measurement | A | B |
| --- | ---: | ---: |
| Initial available RAM | 537.0 MiB | 704.6 MiB |
| Median available RAM | 454.3 MiB | 587.9 MiB |
| Minimum available RAM | 304.5 MiB | 318.6 MiB |
| Final available RAM | 433.7 MiB | 476.3 MiB |
| Mean overall CPU | 32.1% | 29.6% |
| Final free swap | 63.4 MiB | 48.8 MiB |
| Median key command acknowledgement | 120.5 ms | 100.7 ms |

B ended with 42.6 MiB more available RAM and 2.5 percentage points less mean CPU, but also less free swap. It started with substantially more available RAM. Only ACR appeared among the five targets in A's samples (peak RSS about 17.5 MiB); none appeared in B. These observations do not attribute all differences to the disabled components or establish smoother navigation.

The sequence in `scripts/benchmark-tv.py` waits 30 seconds, opens YouTube, Stremio, Disney+, Prime Video and Netflix with 25 seconds after each launch, then sends six Down and six Up commands with 0.8-second pauses. It samples CPU, memory, swap, zram, processes and compositor records about every three seconds. Acknowledgement latency adds to the actual spacing of commands. The script does not change flags or power off the TV; it checks expected state and keeps incremental checkpoints. Private baseline files are required for the state-changing companion script.

Launcher acknowledgement is not time to a usable screen. Key acknowledgement is not input-to-photon latency. The compositor returns an unverified `a(usiud)` structure on this firmware; no reliable per-app FPS or below-60-FPS count has been derived. A 60 Hz display does not imply every application continuously generates 60 frames.

## Vetro monitoring overhead

Separate exploratory samples measured combined Vetro service and root-agent CPU:

| View | CPU, as a percentage of one core |
| --- | ---: |
| Dashboard closed | 0.44–0.51% |
| Dashboard summary | 0.72–0.79% |
| Task manager | 2.07% |

These measurements include collection overhead and are not percentages of total four-core capacity. The dashboard requests a summary every five seconds; app/process views request the full monitor every ten seconds. Monitoring pauses in unrelated panels, hidden documents and paused views. Other open browser tabs can still collect data. Storage has a shared 30-second cache; summary and full samples keep independent deltas and reset on boot changes.

## Interpreting counters

Available RAM is more useful than a simple used-RAM total. Zram capacity and logical swap occupancy are different from its physical `mem_used_total`. Major faults include file-backed loading as well as swap; they do not directly measure stall time. Missing VM counters and PSI must remain unavailable, rather than zero. Per-process fault deltas check start time to handle PID reuse.

Linux load includes runnable and uninterruptible tasks. A high load average with modest CPU does not alone identify flash I/O, a broken service or a removable component. A read-only sample found stable uninterruptible threads and little measured storage activity; it did not establish an I/O or logging bottleneck.

The vendor kernel reports Linux 4.1.10 but includes differences from upstream. Upstream 4.1 accepts swappiness 0–100, supports LZO/LZ4 zram and defines CFS shares as relative sibling weights under contention. Modern tuning advice cannot be assumed applicable. CFQ versus noop is workload-dependent; a high weight on an empty group consumes no CPU. No governor, realtime scheduling, swappiness or storage scheduler tuning is offered. Compositor-effect experiments were abandoned after lag and connection-loss reports.

Primary references: [Linux 4.1 reclaim](https://github.com/torvalds/linux/blob/v4.1/mm/vmscan.c), [zram statistics](https://github.com/torvalds/linux/blob/v4.1/Documentation/blockdev/zram.txt), [CFS group scheduling](https://github.com/torvalds/linux/blob/v4.1/Documentation/scheduler/sched-design-CFS.txt), [block statistics](https://github.com/torvalds/linux/blob/v4.1/Documentation/block/stat.txt), [proc counters](https://github.com/torvalds/linux/blob/v4.1/Documentation/filesystems/proc.txt).

## Remaining work

Repeat comparable ABBA trials with the same network, profile, workload, temperature, monitoring and boot age. Confirm each app reaches its usable screen. Validate presentation timestamps or synchronized video before claiming frame-time improvements. Compare monitoring overhead in closed/dashboard/task-manager/dashboard/closed order without changing TV state. Investigate one measured bottleneck at a time, with a baseline and a verified rollback.

Raw device reports and earlier investigation notes are kept in a private archive. This public summary records measured results without device identifiers or obsolete installation instructions.
