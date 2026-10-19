import type { MessageStatus } from '../api/types';
import type { ChatEvent } from './notifications';
import { phoneToChatId } from './phone';

export const LOCAL_ID_PREFIX = 'local-';

export interface Message {
  /** idMessage от GREEN-API; для ещё не подтверждённого сервером — локальный id с префиксом local- */
  id: string;
  text: string;
  direction: 'in' | 'out';
  timestamp: number;
  status?: MessageStatus;
  /** нетекстовое сообщение (фото, файл…): text — подпись-заглушка */
  unsupported?: boolean;
  /** id сообщения, на которое это сообщение отвечает */
  quotedId?: string;
}

export interface Chat {
  chatId: string;
  title?: string;
  /** номер собеседника, 79991234567 */
  phone?: string;
  messages: Message[];
  unread: number;
  /** когда чат появился в списке — нужен для сортировки пустых чатов */
  createdAt?: number;
}

export interface ChatState {
  chats: Record<string, Chat>;
  activeChatId: string | null;
}

export type ChatAction =
  | { type: 'chatOpened'; chatId: string; phone?: string; timestamp?: number }
  | { type: 'chatClosed' }
  | { type: 'eventReceived'; event: ChatEvent }
  | { type: 'sendStarted'; chatId: string; localId: string; text: string; timestamp: number }
  | { type: 'resendStarted'; chatId: string; localId: string }
  | { type: 'sendSucceeded'; chatId: string; localId: string; idMessage: string }
  | { type: 'sendFailed'; chatId: string; localId: string };

export const initialChatState: ChatState = { chats: {}, activeChatId: null };

// статус исходящего только растёт: поздний «sent» не должен затирать уже пришедший «read»
const STATUS_RANK: Record<MessageStatus, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

/** Время последней активности чата: последнее сообщение, а для пустого — момент создания. */
export const chatActivity = (chat: Chat) => chat.messages.at(-1)?.timestamp ?? chat.createdAt ?? 0;

const getChat = (state: ChatState, chatId: string, createdAt = Date.now()): Chat =>
  state.chats[chatId] ?? { chatId, messages: [], unread: 0, createdAt };

const withChat = (state: ChatState, chat: Chat): ChatState => ({
  ...state,
  chats: { ...state.chats, [chat.chatId]: chat },
});

/**
 * MAX присылает входящие с chatId-идентификатором пользователя, а чат мог быть открыт по номеру (phone@c.us).
 * Чат с тем же номером под другим chatId переносим (или вливаем, если оба уже есть) под chatId пользователя.
 */
const adoptChatByPhone = (state: ChatState, chatId: string, phone: string): ChatState => {
  const byPhone = Object.values(state.chats).find(
    (chat) => chat.chatId !== chatId && (chat.phone === phone || chat.chatId === phoneToChatId(phone)),
  );
  if (!byPhone) return state;

  const target = state.chats[chatId];
  const merged: Chat = target
    ? {
        ...target,
        title: target.title || byPhone.title,
        messages: [...byPhone.messages, ...target.messages].sort((a, b) => a.timestamp - b.timestamp),
        unread: target.unread + byPhone.unread,
      }
    : byPhone;

  const { [byPhone.chatId]: _, ...rest } = state.chats;
  return {
    chats: { ...rest, [chatId]: { ...merged, chatId, phone } },
    activeChatId: state.activeChatId === byPhone.chatId ? chatId : state.activeChatId,
  };
};

/**
 * Чат, где лежит отправляемое сообщение. Пока шёл sendMessage, чат мог переехать под другой chatId
 * (adoptChatByPhone) — тогда ищем по localId, чтобы не создать пустой чат-призрак под старым chatId.
 */
const findChatWithMessage = (state: ChatState, chatId: string, messageId: string): Chat | undefined => {
  const hasMessage = (chat: Chat) => chat.messages.some((message) => message.id === messageId);
  const chat = state.chats[chatId];
  return chat && hasMessage(chat) ? chat : Object.values(state.chats).find(hasMessage);
};

/**
 * Локальная копия, которую подтверждает пришедшее исходящее уведомление: тот же текст, ещё без серверного id.
 * Сначала ищем «отправляется», затем «не отправлено» — после перезагрузки во время отправки
 * сообщение помечено ошибкой, хотя сервер его принял.
 */
const findUnconfirmed = (chat: Chat, text: string) => {
  const candidates = chat.messages.filter(
    (message) => message.direction === 'out' && message.id.startsWith(LOCAL_ID_PREFIX) && message.text === text,
  );
  return candidates.find((message) => message.status === 'pending') ?? candidates.find((m) => m.status === 'failed');
};

const updateMessage = (chat: Chat, id: string, update: (message: Message) => Message): Chat => ({
  ...chat,
  messages: chat.messages.map((message) => (message.id === id ? update(message) : message)),
});

export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'chatOpened': {
      const chat = getChat(state, action.chatId, action.timestamp);
      return {
        ...withChat(state, { ...chat, phone: action.phone || chat.phone, unread: 0 }),
        activeChatId: action.chatId,
      };
    }

    case 'chatClosed':
      return { ...state, activeChatId: null };

    case 'eventReceived': {
      const { event } = action;

      if (event.kind === 'status') {
        // статус сообщения из чата, которого нет в списке (например, отправленного с телефона), игнорируем
        const chat = state.chats[event.chatId];
        if (!chat) return state;
        return withChat(
          state,
          updateMessage(chat, event.id, (message) =>
            STATUS_RANK[event.status] > STATUS_RANK[message.status ?? 'pending']
              ? { ...message, status: event.status }
              : message,
          ),
        );
      }

      if (event.phone) state = adoptChatByPhone(state, event.chatId, event.phone);
      const chat = getChat(state, event.chatId, event.timestamp);

      // повторная доставка того же уведомления
      if (chat.messages.some((message) => message.id === event.id)) return state;

      if (event.direction === 'out') {
        const unconfirmed = findUnconfirmed(chat, event.text);
        if (unconfirmed) {
          return withChat(
            state,
            updateMessage(chat, unconfirmed.id, (message) => ({ ...message, id: event.id, status: 'sent' })),
          );
        }
      }

      const message: Message = {
        id: event.id,
        text: event.text,
        direction: event.direction,
        timestamp: event.timestamp,
        status: event.direction === 'out' ? 'sent' : undefined,
        unsupported: event.unsupported,
        quotedId: event.quotedId,
      };
      const isActive = state.activeChatId === event.chatId;
      return withChat(state, {
        ...chat,
        title: event.chatName || chat.title,
        phone: event.phone || chat.phone,
        // очередь уведомлений FIFO, поэтому просто дописываем в конец: время сервера с точностью до секунды
        // и локальное время отправки в мс, сортировка могла поставить быстрый ответ выше вопроса
        messages: [...chat.messages, message],
        unread: event.direction === 'in' && !isActive ? chat.unread + 1 : chat.unread,
      });
    }

    case 'sendStarted': {
      const chat = getChat(state, action.chatId, action.timestamp);
      const message: Message = {
        id: action.localId,
        text: action.text,
        direction: 'out',
        timestamp: action.timestamp,
        status: 'pending',
      };
      return withChat(state, { ...chat, messages: [...chat.messages, message] });
    }

    case 'resendStarted': {
      const chat = findChatWithMessage(state, action.chatId, action.localId);
      if (!chat) return state;
      return withChat(state, updateMessage(chat, action.localId, (message) => ({ ...message, status: 'pending' })));
    }

    case 'sendSucceeded': {
      // если уведомление outgoingAPIMessageReceived пришло раньше ответа sendMessage, локальной копии уже нет
      const chat = findChatWithMessage(state, action.chatId, action.localId);
      if (!chat) return state;
      if (chat.messages.some((message) => message.id === action.idMessage)) {
        return withChat(state, {
          ...chat,
          messages: chat.messages.filter((message) => message.id !== action.localId),
        });
      }
      return withChat(
        state,
        updateMessage(chat, action.localId, (message) => ({ ...message, id: action.idMessage, status: 'sent' })),
      );
    }

    case 'sendFailed': {
      const chat = findChatWithMessage(state, action.chatId, action.localId);
      if (!chat) return state;
      return withChat(state, updateMessage(chat, action.localId, (message) => ({ ...message, status: 'failed' })));
    }
  }
};
