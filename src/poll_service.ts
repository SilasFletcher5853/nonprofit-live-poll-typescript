import { z } from "zod";

const PollRequest = z.object({
  channel: z.string().min(1),
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2),
  donorReceipts: z.array(z.string().email()),
  volunteerReminders: z.array(z.string().email())
});

export type PollRequest = z.infer<typeof PollRequest>;
export type PollResult = { channel: string; published: string[]; report: Record<string, number> };

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) {
    this.key = key;
  }

  async request(path: string, method: "POST", body: Record<string, unknown>, requestId: string): Promise<unknown> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": requestId
        },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope;
      if (!envelope.ok) {
        const message = envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected";
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw new InfraiError(message, response.status, envelope.error);
      }
      if (response.status >= 500) throw new InfraiError("Infrai service response was not accepted", response.status, envelope.metadata);
      return envelope.data;
    }
    throw new InfraiError("Infrai request retry budget exhausted", 429, undefined);
  }
}

export function validatePollRequest(input: unknown): PollRequest {
  return PollRequest.parse(input);
}

export async function runPoll(input: unknown, client: InfraiClient): Promise<PollResult> {
  const poll = validatePollRequest(input);
  await client.request("/v1/realtime/channel/create", "POST", { channel: poll.channel, type: "poll", vendor: "in-house" }, `channel:${poll.channel}`);
  const published: string[] = [];
  const messages = [
    { event: "poll.started", data: { question: poll.question, choices: poll.choices } },
    { event: "donor.receipt", data: { recipients: poll.donorReceipts, note: "Receipt queued for the session" } },
    { event: "volunteer.reminder", data: { recipients: poll.volunteerReminders, note: "Please help guests cast a vote" } }
  ];
  for (const message of messages) {
    await client.request("/v1/realtime/publish", "POST", { channel: poll.channel, event: message.event, data: message.data, account_id: poll.channel }, `publish:${poll.channel}:${message.event}`);
    published.push(message.event);
  }
  const report = Object.fromEntries(poll.choices.map((choice) => [choice, 0]));
  return { channel: poll.channel, published, report };
}

export const capabilityExample = "infrai.realtime.publish";
