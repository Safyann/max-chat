import type { Credentials } from '../api/types';
import { initialChatState, type ChatState } from './chatReducer';

const CREDENTIALS_KEY = 'max-chat:credentials';
const chatsKey = (idInstance: string) => `max-chat:chats:${idInstance}`;

// хранилище может быть недоступно (приватный режим, запрет cookies) — приложение работает и без него
const read = <T>(storage: Storage, key: string): T | null => {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (storage: Storage, key: string, value: unknown) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
};

// токен держим в sessionStorage: переживает перезагрузку вкладки, но не остаётся в браузере после её закрытия
export const loadCredentials = () => read<Credentials>(sessionStorage, CREDENTIALS_KEY);
export const saveCredentials = (credentials: Credentials) => write(sessionStorage, CREDENTIALS_KEY, credentials);
// apiUrl и idInstance не секретны — запоминаем надолго, чтобы после выхода не вводить их заново
const LAST_LOGIN_KEY = 'max-chat:last-login';
export const loadLastLogin = () => read<Pick<Credentials, 'apiUrl' | 'idInstance'>>(localStorage, LAST_LOGIN_KEY);
export const saveLastLogin = ({ apiUrl, idInstance }: Credentials) =>
  write(localStorage, LAST_LOGIN_KEY, { apiUrl, idInstance });

export const clearCredentials = () => {
  try {
    sessionStorage.removeItem(CREDENTIALS_KEY);
  } catch {
    /* noop */
  }
};

// сообщение, оставшееся «отправляется» после перезагрузки, уже никогда не получит ответ sendMessage
const markInterruptedAsFailed = (chats: ChatState['chats']): ChatState['chats'] =>
  Object.fromEntries(
    Object.entries(chats).map(([chatId, chat]) => [
      chatId,
      {
        ...chat,
        messages: chat.messages.map((message) =>
          message.status === 'pending' ? { ...message, status: 'failed' as const } : message,
        ),
      },
    ]),
  );

export const loadChats = (idInstance: string): ChatState => {
  const stored = read<ChatState['chats']>(localStorage, chatsKey(idInstance));
  return {
    chats: stored ? markInterruptedAsFailed(stored) : initialChatState.chats,
    activeChatId: null,
  };
};
export const saveChats = (idInstance: string, chats: ChatState['chats']) =>
  write(localStorage, chatsKey(idInstance), chats);
