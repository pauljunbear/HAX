## Worker Pipeline Relaunch Plan

### Goals

- Restore worker-driven processing without regressions.
- Share pixel buffers between main thread and workers to avoid redundant cloning.
- Deduplicate queued tasks so only the latest payload per key runs.
- Ship with regression tests that cover task scheduling, concurrency, and buffer reuse.

### Architecture Overview

- **SharedBufferController**: orchestrates `SharedArrayBuffer` allocation, reference counting, and teardown.
- **WorkerTaskRegistry**: tracks active tasks by key, handles dedupe (latest-wins) and cancellation tokens.
- **PipelineCoordinator**: public facade for scheduling batch operations, frame sequences, and effect previews.
- **WorkerPool**: extends current `WorkerManager` with warm pool sizing, heartbeat, and adaptive scaling hooks.

### Shared Buffer Strategy

- Prefer `ImageData` backed by `SharedArrayBuffer` where browser permits; fall back gracefully when unavailable.
- Maintain pool of reusable SAB-backed buffers sized by megapixels to avoid churn.
- Encode buffer metadata (width, height, color space) in transfer object; workers reconstruct `ImageData` views only.
- After worker completes, release or recycle buffer via controller; ensure proper locking if multiple consumers.

### Task Deduplication & Scheduling

- Each request computes `taskKey` from effect id + settings hash + image revision id.
- Registry cancels queued tasks with same key before enqueueing new payload; currently running task receives cancel signal via transferable flag.
- Priority queues: UI-critical previews > export frames > background warmups.
- Track in-flight counts per worker to avoid overload; throttle new tasks when queue length exceeds threshold.

### Testing & Verification

- Unit tests for buffer controller (allocation, reuse, SAB fallback).
- WorkerManager integration tests simulating concurrent dedupe, cancellation, and heartbeat recovery.
- End-to-end test ensuring progressive preview uses shared buffer and latest settings.
- Benchmark harness to compare worker pipeline vs main-thread fallback; gate merges on non-regression.

### Rollout Checklist

- Implement controllers and registry behind feature flag (`workerPipelineV2`).
- Ship dual path in staging: opt-in toggle for QA.
- Add telemetry hooks (task duration, queue depth, cancellation count).
- Document recovery plan: automatic fallback to main thread if worker initialization fails.
