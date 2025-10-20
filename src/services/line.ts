import { env } from '../env.js';

const LINE_PUSH_ENDPOINT = 'https://api.line.me/v2/bot/message/push';

export interface LinePushRequest {
  to: string;
  messages: string[];
}

export interface LineClient {
  pushMessage: (payload: LinePushRequest) => Promise<void>;
}

class HttpLineClient implements LineClient {
  constructor(private readonly accessToken: string) {}

  async pushMessage(payload: LinePushRequest): Promise<void> {
    const response = await fetch(LINE_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`
      },
      body: JSON.stringify({
        to: payload.to,
        messages: payload.messages.map((message) => ({ type: 'text', text: message }))
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LINE push failed: ${response.status} ${body}`);
    }
  }
}

export const noopLineClient: LineClient = {
  async pushMessage() {
    // intentionally left blank
  }
};

export function isLinePushEnabled(): boolean {
  return Boolean(
    env.ENABLE_LINE_PUSH && env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_CHANNEL_SECRET
  );
}

export function createLineClient(): LineClient {
  if (!isLinePushEnabled()) {
    return noopLineClient;
  }
  return new HttpLineClient(env.LINE_CHANNEL_ACCESS_TOKEN ?? '');
}

export async function sendLineMessage(
  client: LineClient,
  payload: LinePushRequest
): Promise<void> {
  if (!isLinePushEnabled()) {
    return;
  }

  try {
    await client.pushMessage(payload);
  } catch (error) {
    console.error('LINE push failed', error);
  }
}
