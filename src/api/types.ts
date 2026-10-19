export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export interface SendMessageResponse {
  idMessage: string;
}

export interface StateInstanceResponse {
  stateInstance: string;
}

export interface DeleteNotificationResponse {
  result: boolean;
  reason?: string;
}

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

interface SenderData {
  chatId: string;
  chatName?: string;
  sender?: string;
  senderName?: string;
  senderContactName?: string;
}

interface MessageData {
  typeMessage: string;
  textMessageData?: { textMessage: string };
  extendedTextMessageData?: { text: string };
}

export interface MessageWebhook {
  typeWebhook: 'incomingMessageReceived' | 'outgoingMessageReceived' | 'outgoingAPIMessageReceived';
  idMessage: string;
  timestamp: number;
  senderData: SenderData;
  messageData: MessageData;
}

export interface StatusWebhook {
  typeWebhook: 'outgoingMessageStatus';
  idMessage: string;
  chatId: string;
  status: Exclude<MessageStatus, 'pending'>;
  timestamp: number;
}

export interface OtherWebhook {
  typeWebhook: string;
}

export type WebhookBody = MessageWebhook | StatusWebhook | OtherWebhook;

export interface Notification {
  receiptId: number;
  body: WebhookBody;
}
