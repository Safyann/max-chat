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
      unsupported?: boolean;
      quotedId?: string;
    }
  | {
      kind: 'status';
      chatId: string;
      id: string;
      status: Exclude<MessageStatus, 'pending'>;
    };

const MESSAGE_WEBHOOKS = new Set(['incomingMessageReceived', 'outgoingMessageReceived', 'outgoingAPIMessageReceived']);

// по заданию поддерживается только текст, но молча терять фото или голосовое нельзя — показываем заглушку
const MEDIA_LABELS: Record<string, string> = {
  imageMessage: '🖼 Фото',
  videoMessage: '🎬 Видео',
  documentMessage: '📎 Файл',
  audioMessage: '🎤 Аудио',
  stickerMessage: 'Стикер',
  locationMessage: '📍 Геолокация',
  contactMessage: '👤 Контакт',
  pollMessage: '📊 Опрос',
};

const extractText = ({ messageData }: MessageWebhook): { text: string; unsupported?: boolean } => {
  switch (messageData.typeMessage) {
    case 'textMessage':
      return { text: messageData.textMessageData?.textMessage ?? '' };
    case 'extendedTextMessage':
    // ответ с цитатой («Ответить»): текст лежит там же, где у extendedTextMessage
    case 'quotedMessage':
      return { text: messageData.extendedTextMessageData?.text ?? '' };
    default: {
      const label = MEDIA_LABELS[messageData.typeMessage] ?? 'Сообщение';
      const caption = messageData.fileMessageData?.caption;
      return {
        text: `${label} — откройте в приложении MAX${caption ? `\n${caption}` : ''}`,
        unsupported: true,
      };
    }
  }
};

/**
 * Превращает тело уведомления GREEN-API в событие чата.
 * Служебные уведомления (смена состояния инстанса, звонки и т. п.) возвращают null.
 */
export const parseWebhook = (body: WebhookBody): ChatEvent | null => {
  if (MESSAGE_WEBHOOKS.has(body.typeWebhook)) {
    const webhook = body as MessageWebhook;
    const { text, unsupported } = extractText(webhook);
    const { senderData } = webhook;
    const isIncoming = webhook.typeWebhook === 'incomingMessageReceived';
    return {
      kind: 'message',
      chatId: senderData.chatId,
      // в исходящих senderName — это мы сами, поэтому имя собеседника берём только из входящих;
      // chatName первым: в группе sender* — это участник, а не название группы
      chatName: isIncoming ? senderData.chatName || senderData.senderContactName || senderData.senderName : undefined,
      phone: isIncoming && senderData.senderPhoneNumber ? String(senderData.senderPhoneNumber) : undefined,
      id: webhook.idMessage,
      text,
      direction: isIncoming ? 'in' : 'out',
      timestamp: webhook.timestamp * 1000,
      unsupported,
      quotedId: webhook.messageData.extendedTextMessageData?.stanzaId,
    };
  }

  if (body.typeWebhook === 'outgoingMessageStatus') {
    const webhook = body as StatusWebhook;
    return { kind: 'status', chatId: webhook.chatId, id: webhook.idMessage, status: webhook.status };
  }

  return null;
};
