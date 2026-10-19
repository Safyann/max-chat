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
export const clearCredentials = () => {
  try {
    sessionStorage.removeItem(CREDENTIALS_KEY);
  } catch {
    /* noop */
  }
};

export const loadChats = (idInstance: string): ChatState => ({
  chats: read<ChatState['chats']>(localStorage, chatsKey(idInstance)) ?? initialChatState.chats,
  activeChatId: null,
});
export const saveChats = (idInstance: string, chats: ChatState['chats']) =>
  write(localStorage, chatsKey(idInstance), chats);
