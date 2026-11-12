import test from "node:test";
import assert from "node:assert/strict";
import { InfraiClient, runPoll } from "./poll_service.ts";

test("a valid session publishes the poll, receipt, and reminder, then returns zeroed choices", async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const client = new InfraiClient("test-key");
  client.request = async (path, _method, body) => {
    calls.push({ path, body });
    return {};
  };
  const result = await runPoll({
    channel: "test-session",
    question: "Where should volunteers help?",
    choices: ["Meals", "Mentoring"],
    donorReceipts: ["donor@example.org"],
    volunteerReminders: ["helper@example.org"]
  }, client);
  assert.deepEqual(result.published, ["poll.started", "donor.receipt", "volunteer.reminder"]);
  assert.deepEqual(result.report, { Meals: 0, Mentoring: 0 });
  assert.equal(calls[0].path, "/v1/realtime/channel/create");
  assert.equal(calls[1].body.event, "poll.started");
});
