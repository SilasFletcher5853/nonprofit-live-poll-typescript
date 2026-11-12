import { InfraiClient, runPoll } from "./poll_service.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting the session");
const recipient = process.env.POLL_RECIPIENT;
if (!recipient) throw new Error("Set POLL_RECIPIENT before starting the session");

const result = await runPoll({
  channel: "community-session-2026",
  question: "Which program should receive the next volunteer shift?",
  choices: ["Food pantry", "Youth tutoring", "Senior visits"],
  donorReceipts: [recipient],
  volunteerReminders: [recipient]
}, new InfraiClient(key));

console.log(JSON.stringify(result, null, 2));
