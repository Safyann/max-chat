import type { MessageStatus } from '../api/types';
import type { ChatEvent } from './notifications';

export interface Message {
  /** idMessage от GREEN-API; для ещё не отправленного — локальный id */
  id: string;
  text: string;
  direction: 'in' | 'out';
  timestamp: number;
  status?: MessageStatus;
}

export interface Chat {
  chatId: string;
  title?: string;
  messages: Message[];
  unread: number;
}

export interface ChatState {
  chats: Record<string, Chat>;
  activeChatId: string | null;
}

export type ChatAction =
  | { type: 'chatOpened'; chatId: string }
  | { type: 'chatClosed' }
  | { type: 'eventReceived'; event: ChatEvent }
  | { type: 'sendStarted'; chatId: string; localId: string; text: string; timestamp: number }
  | { type: 'sendSucceeded'; chatId: string; localId: string; idMessage: string }
  | { type: 'sendFailed'; chatId: string; localId: string };

export const initialChatState: ChatState = { chats: {}, activeChatId: null };

// статус исходящего только растёт: поздний «sent» не должен затирать уже пришедший «read»
const STATUS_RANK: Record<MessageStatus, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

const getChat = (state: ChatState, chatId: string): Chat =>
  state.chats[chatId] ?? { chatId, messages: [], unread: 0 };

const withChat = (state: ChatState, chat: Chat): ChatState => ({
  ...state,
  chats: { ...state.chats, [chat.chatId]: chat },
});

const updateMessage = (chat: Chat, id: string, update: (message: Message) => Message): Chat => ({
  ...chat,
  messages: chat.messages.map((message) => (message.id === id ? update(message) : message)),
});

export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'chatOpened': {
      const chat = getChat(state, action.chatId);
      return { ...withChat(state, { ...chat, unread: 0 }), activeChatId: action.chatId };
    }

    case 'chatClosed':
      return { ...state, activeChatId: null };

    case 'eventReceived': {
      const { event } = action;
      const chat = getChat(state, event.chatId);

      if (event.kind === 'status') {
        return withChat(
          state,
          updateMessage(chat, event.id, (message) =>
            STATUS_RANK[event.status] > STATUS_RANK[message.status ?? 'pending']
              ? { ...message, status: event.status }
              : message,
          ),
        );
      }

      // исходящее через API уже лежит в чате после sendSucceeded — повторно не добавляем
      if (chat.messages.some((message) => message.id === event.id)) return state;

      const message: Message = {
        id: event.id,
        text: event.text,
        direction: event.direction,
        timestamp: event.timestamp,
        status: event.direction === 'out' ? 'sent' : undefined,
      };
      const isActive = state.activeChatId === event.chatId;
      return withChat(state, {
        ...chat,
        title: event.chatName || chat.title,
        messages: [...chat.messages, message].sort((a, b) => a.timestamp - b.timestamp),
        unread: event.direction === 'in' && !isActive ? chat.unread + 1 : chat.unread,
      });
    }

    case 'sendStarted': {
      const chat = getChat(state, action.chatId);
      const message: Message = {
        id: action.localId,
        text: action.text,
        direction: 'out',
        timestamp: action.timestamp,
        status: 'pending',
      };
      return withChat(state, { ...chat, messages: [...chat.messages, message] });
    }

    case 'sendSucceeded': {
      const chat = getChat(state, action.chatId);
      // уведомление outgoingAPIMessageReceived могло прийти раньше ответа sendMessage — тогда убираем локальную копию
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
      const chat = getChat(state, action.chatId);
      return withChat(state, updateMessage(chat, action.localId, (message) => ({ ...message, status: 'failed' })));
    }
  }
};
