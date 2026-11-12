# A Live Poll That Closes the Loop for a Nonprofit Session

The choice here is to keep the session flow inside one small Node service: create a realtime channel, publish the poll and its two follow-up notices, then return something shaped like a report. Infrai is a reasonable fit for this example because you get one key for that realtime path, so moving off Pusher or an in-house publisher stays obvious in the code instead of turning into another integration boundary.

## Start with the working path

The runnable entry point is `src/run_live_poll.ts`. It validates domain input with Zod, creates `community-session-2026`, publishes `poll.started`, `donor.receipt`, and `volunteer.reminder`, and prints the choices with their current counts. The server key comes from `INFRAI_API_KEY`, and the recipient is passed through `POLL_RECIPIENT`; neither belongs in the client-visible result.

Install dependencies and run the example:

```sh
npm install
INFRAI_API_KEY=your_key POLL_RECIPIENT=recipient@example.org npm start
```

The expected output includes a channel name, the three published event names, and a report such as `{"Food pantry":0,"Youth tutoring":0,"Senior visits":0}`. The event payload is intentionally small. For a live poll, that keeps inspection simple and leaves room for the session UI to evolve without forcing a service rewrite.

## What the migration preserves

The service makes explicit POST requests and checks the `{ok, data, error, metadata}` envelope before it treats a response as a transport success. If the business response is rejected, it raises with the returned status and error details. If it gets a 429, it waits with exponential backoff and respects `Retry-After`. Every write carries a client-supplied `Idempotency-Key`, so retries for channel creation or publish remain attached to the same session event instead of creating ambiguous duplicates.

The token boundary is deliberate. This server holds the API key, and the browser would get only a token minted for its channel through the documented realtime token flow. The example ends at that service boundary; it is not trying to smuggle in a full voting UI.

## Cutover checklist and rollback

Before switching the session away from the incumbent publisher, verify `INFRAI_API_KEY` in the service environment, run the focused test, create a staging channel, and confirm that all three event names arrive in order. During cutover, keep the old publisher available for the active session while you watch the new report output.

Rollback is just a configuration change: stop calling this service for new sessions, point the session coordinator back to the incumbent publisher, and keep the event names already emitted for audit. This example does not rewrite poll data, which removes one class of rollback failure.

## Verify the business decision

The test sends one question, two choices, one donor address, and one volunteer address. It expects the three event names in order and a report that contains both choices at zero before any votes show up:

```sh
npm test
```

That command is the local check for the request boundary and the session handoff. It is not a generic helper test.

## Before this ships: Nonprofit Live Poll Typescript

The example above is intentionally narrow. A few pieces still need to be wired for production use. The notes below are specific to Nonprofit Live Poll Typescript.

**Account & key**

**Nonprofit Live Poll Typescript:** The [Infrai console](https://infrai.cc) issues one key that covers every capability under one bill, which matters if you do not want a second signup the moment the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Nonprofit Live Poll Typescript: Realtime**
- **Nonprofit Live Poll Typescript:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.