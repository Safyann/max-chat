import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { checkAccount, getSettings, GreenApiError, sendMessage } from '../api/greenApi';
import type { Credentials } from '../api/types';
import { useChatHistory } from '../hooks/useChatHistory';
import { useNotificationPolling } from '../hooks/useNotificationPolling';
import { chatActivity, chatReducer, LOCAL_ID_PREFIX, type Message } from '../lib/chatReducer';
import type { ChatEvent } from '../lib/notifications';
import { phoneToChatId } from '../lib/phone';
import { diagnoseSettings } from '../lib/settings';
import { loadChats, saveChats } from '../lib/storage';
import { ChatList } from './ChatList';
import { ChatPanel } from './ChatPanel';
import { NewChatForm } from './NewChatForm';

// так отвечает инстанс, у которого нет checkAccount (WhatsApp) или номер вне +7/+375
const METHOD_UNSUPPORTED_STATUSES = new Set([400, 404, 405]);

// crypto.randomUUID есть только в secure context: при открытии dev-сервера по http://192.168.x.x отправка падала бы
const createLocalId = () =>
  `${LOCAL_ID_PREFIX}${typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

const SETTINGS_RECHECK_MS = 60_000;

interface MessengerProps {
  credentials: Credentials;
  onLogout: () => void;
}

export const Messenger = ({ credentials, onLogout }: MessengerProps) => {
  const [state, dispatch] = useReducer(chatReducer, credentials.idInstance, loadChats);

  useEffect(() => {
    saveChats(credentials.idInstance, state.chats);
  }, [credentials.idInstance, state.chats]);

  const [settingsProblems, setSettingsProblems] = useState<string[]>([]);

  // настройки перепроверяем периодически и при возврате на вкладку: пользователь мог исправить их в консоли
  useEffect(() => {
    const controller = new AbortController();
    const check = () =>
      getSettings(credentials, controller.signal)
        .then((settings) => setSettingsProblems(diagnoseSettings(settings)))
        // проверка вспомогательная: если не удалась, чат всё равно работает
        .catch(() => undefined);

    void check();
    const timer = setInterval(check, SETTINGS_RECHECK_MS);
    window.addEventListener('focus', check);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [credentials]);

  const handleEvent = useCallback((event: ChatEvent) => dispatch({ type: 'eventReceived', event }), []);
  const pollingError = useNotificationPolling(credentials, handleEvent);
  const { openChat, closeChat } = useChatHistory(state, dispatch);

  const chats = useMemo(
    () => Object.values(state.chats).sort((a, b) => chatActivity(b) - chatActivity(a)),
    [state.chats],
  );
  const activeChat = state.activeChatId ? state.chats[state.activeChatId] : null;

  const createChat = async (phone: string) => {
    const existing = Object.values(state.chats).find(
      (chat) => chat.phone === phone || chat.chatId === phoneToChatId(phone),
    );
    if (existing) {
      openChat(existing.chatId);
      return;
    }

    // В MAX входящие приходят с chatId пользователя, а не с номером — узнаём его заранее,
    // чтобы ответы попадали в этот же чат. Не-MAX инстанс (WhatsApp) метода не знает — тогда шлём на phone@c.us.
    let chatId = phoneToChatId(phone);
    try {
      const account = await checkAccount(credentials, phone);
      if (account && !account.exist) throw new Error('У этого номера нет аккаунта MAX');
      if (account) chatId = account.chatId;
    } catch (err) {
      const isUnsupported = err instanceof GreenApiError && METHOD_UNSUPPORTED_STATUSES.has(err.status ?? 0);
      if (!isUnsupported) throw err;
    }
    openChat(chatId, phone);
  };

  const deliver = async (chatId: string, localId: string, text: string) => {
    try {
      const idMessage = await sendMessage(credentials, chatId, text);
      dispatch({ type: 'sendSucceeded', chatId, localId, idMessage });
    } catch {
      dispatch({ type: 'sendFailed', chatId, localId });
    }
  };

  const handleSend = (text: string) => {
    if (!activeChat) return;
    const localId = createLocalId();
    dispatch({ type: 'sendStarted', chatId: activeChat.chatId, localId, text, timestamp: Date.now() });
    void deliver(activeChat.chatId, localId, text);
  };

  const handleRetry = (message: Message) => {
    if (!activeChat) return;
    dispatch({ type: 'resendStarted', chatId: activeChat.chatId, localId: message.id });
    void deliver(activeChat.chatId, message.id, message.text);
  };

  return (
    <div className={`messenger${activeChat ? ' messenger--chat-open' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar__header">
          <div>
            <div className="sidebar__title">Чаты</div>
            <div className="sidebar__subtitle">Инстанс {credentials.idInstance}</div>
          </div>
          <button type="button" className="button button--ghost button--compact" onClick={onLogout}>
            Выйти
          </button>
        </header>
        {pollingError && (
          <p className="sidebar__error" role="alert">
            {pollingError}. Повторяем…
          </p>
        )}
        {settingsProblems.length > 0 && (
          <div className="sidebar__error" role="alert">
            Настройки инстанса в консоли GREEN-API:
            <ul className="sidebar__error-list">
              {settingsProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
        <NewChatForm onCreate={createChat} />
        <ChatList chats={chats} activeChatId={state.activeChatId} onSelect={openChat} />
      </aside>

      <main className="main">
        {activeChat ? (
          <ChatPanel chat={activeChat} onSend={handleSend} onRetry={handleRetry} onBack={closeChat} />
        ) : (
          <div className="main__placeholder">Выберите чат или создайте новый по номеру телефона</div>
        )}
      </main>
    </div>
  );
};
