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

/**
 * Publica un evento en SNS.
 * @param event   Nombre del evento
 * @param payload Datos del evento
 * @param cid     Correlation ID (opcional). Si no se pasa pero existe payload.cid, se usa ese.
 */
export async function publishEvent(
  event: EventName,
  payload: EventPayload,
  cid?: string,
) {
  if (!TOPIC_ARN) {
    // modo “silencioso”: sin SNS configurado, solo log
    console.log(`[EVENT:${event}] cid=${cid ?? payload?.cid ?? '-'} `, payload);
    return { published: false };
  }

  const correlationId = cid ?? (payload && payload.cid);
  const Message = JSON.stringify({
    event,
    cid: correlationId ?? null,
    payload,
    ts: new Date().toISOString(),
  });

  const cmd = new PublishCommand({
    TopicArn: TOPIC_ARN,
    Message,
    MessageAttributes: {
      event: { DataType: 'String', StringValue: event },
      ...(correlationId
        ? { cid: { DataType: 'String', StringValue: String(correlationId) } }
        : {}),
    },
  });
  await sns.send(cmd);
  return { published: true, cid: correlationId };
}

// “safe” para no romper la request si SNS falla
export async function publishEventSafe(
  event: EventName,
  payload: EventPayload,
  cid?: string,
) {
  try {
    return await publishEvent(event, payload, cid);
  } catch (e) {
    console.error(
      `[EVENT:${event}] publish failed (cid=${cid ?? payload?.cid ?? '-'})`,
      e,
    );
    return { published: false, error: String(e), cid: cid ?? payload?.cid };
  }
}
