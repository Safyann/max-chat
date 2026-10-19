import type { MessageStatus, MessageWebhook, StatusWebhook, WebhookBody } from '../api/types';

export type ChatEvent =
  | {
      kind: 'message';
      chatId: string;
      chatName?: string;
      /** номер собеседника (MAX присылает его во входящих отдельно от chatId) */
      phone?: string;
      id: string;
      text: string;
      direction: 'in' | 'out';
      timestamp: number;
    }
  | {
      kind: 'status';
      chatId: string;
      id: string;
      status: Exclude<MessageStatus, 'pending'>;
    };

const MESSAGE_WEBHOOKS = new Set(['incomingMessageReceived', 'outgoingMessageReceived', 'outgoingAPIMessageReceived']);

const extractText = ({ messageData }: MessageWebhook) => {
  switch (messageData.typeMessage) {
    case 'textMessage':
      return messageData.textMessageData?.textMessage;
    case 'extendedTextMessage':
    // ответ с цитатой («Ответить» в WhatsApp): текст лежит там же, где у extendedTextMessage
    case 'quotedMessage':
      return messageData.extendedTextMessageData?.text;
    default:
      return undefined;
  }
};

/**
 * Превращает тело уведомления GREEN-API в событие чата.
 * Всё, кроме текстовых сообщений и статусов исходящих, возвращает null — по заданию работаем только с текстом.
 */
export const parseWebhook = (body: WebhookBody): ChatEvent | null => {
  if (MESSAGE_WEBHOOKS.has(body.typeWebhook)) {
    const webhook = body as MessageWebhook;
    const text = extractText(webhook);
    if (text === undefined) return null;

    const { senderData } = webhook;
    const isIncoming = webhook.typeWebhook === 'incomingMessageReceived';
    return {
      kind: 'message',
      chatId: senderData.chatId,
      // в исходящих senderName — это мы сами, поэтому имя собеседника берём только из входящих
      chatName: isIncoming ? senderData.senderContactName || senderData.chatName || senderData.senderName : undefined,
      phone: isIncoming && senderData.senderPhoneNumber ? String(senderData.senderPhoneNumber) : undefined,
      id: webhook.idMessage,
      text,
      direction: isIncoming ? 'in' : 'out',
      timestamp: webhook.timestamp * 1000,
    };
  }

  if (body.typeWebhook === 'outgoingMessageStatus') {
    const webhook = body as StatusWebhook;
    return { kind: 'status', chatId: webhook.chatId, id: webhook.idMessage, status: webhook.status };
  }

  return null;
};
