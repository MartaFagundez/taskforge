import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const REGION = process.env.AWS_REGION!;
const TOPIC_ARN = process.env.SNS_TOPIC_ARN;

export const sns = new SNSClient({ region: REGION });

export type EventName =
  | 'TaskCreated'
  | 'TaskUpdated'
  | 'TaskDeleted'
  | 'AttachmentAdded'
  | 'AttachmentDeleted';

type EventPayload = Record<string, any>;

export async function publishEvent(event: EventName, payload: EventPayload) {
  if (!TOPIC_ARN) {
    // modo “silencioso”: sin SNS configurado, solo log
    console.log(`[EVENT:${event}]`, payload);
    return { published: false };
  }
  const Message = JSON.stringify({
    event,
    payload,
    ts: new Date().toISOString(),
  });
  const cmd = new PublishCommand({
    TopicArn: TOPIC_ARN,
    Message,
    MessageAttributes: {
      event: { DataType: 'String', StringValue: event },
    },
  });
  await sns.send(cmd);
  return { published: true };
}

// “safe” para no romper la request si SNS falla
export async function publishEventSafe(
  event: EventName,
  payload: EventPayload,
) {
  try {
    return await publishEvent(event, payload);
  } catch (e) {
    console.error(`[EVENT:${event}] publish failed`, e);
    return { published: false, error: String(e) };
  }
}
