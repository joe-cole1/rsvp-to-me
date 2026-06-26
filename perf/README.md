# Performance Tests

Load tests using [Artillery](https://www.artillery.io/). Not included in CI — run manually before launches or after significant backend changes.

## Prerequisites

- App running at the target URL (default: `http://localhost:3000`)
- A published event exists at the slug specified by `PERF_EVENT_SLUG`

## Running

```bash
# Default: targets localhost:3000, uses slug "e2e-test-event"
npm run test:perf

# Custom target
PERF_TARGET_URL=https://staging.example.com PERF_EVENT_SLUG=my-event npm run test:perf
```

## Scenarios

### `event-page.yml`

Tests the public event page under load (the most traffic-heavy endpoint).

- Ramps from 5 → 50 virtual users over 60 seconds
- Sustained at 50 VUs for 120 seconds
- Threshold: p95 < 500ms, p99 < 2000ms

## Notes on Server Actions

Next.js server actions use a special POST format with `Next-Action` headers — they cannot be load-tested with standard Artillery scenarios. To load-test RSVP submission, either add a dedicated REST API route or use a custom Artillery plugin. See the roadmap for tracking this.
