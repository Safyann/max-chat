import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { sendMessage } from '../api/greenApi';
import type { Credentials } from '../api/types';
import { useNotificationPolling } from '../hooks/useNotificationPolling';
import { chatReducer } from '../lib/chatReducer';
import type { ChatEvent } from '../lib/notifications';
import { loadChats, saveChats } from '../lib/storage';
import { ChatList } from './ChatList';
import { ChatPanel } from './ChatPanel';
import { NewChatForm } from './NewChatForm';

interface MessengerProps {
  credentials: Credentials;
  onLogout: () => void;
}

export const Messenger = ({ credentials, onLogout }: MessengerProps) => {
  const [state, dispatch] = useReducer(chatReducer, credentials.idInstance, loadChats);

  useEffect(() => {
    saveChats(credentials.idInstance, state.chats);
  }, [credentials.idInstance, state.chats]);

  const handleEvent = useCallback((event: ChatEvent) => dispatch({ type: 'eventReceived', event }), []);
  const pollingError = useNotificationPolling(credentials, handleEvent);

  const chats = useMemo(
    () =>
      Object.values(state.chats).sort(
        (a, b) => (b.messages.at(-1)?.timestamp ?? 0) - (a.messages.at(-1)?.timestamp ?? 0),
      ),
    [state.chats],
  );
  const activeChat = state.activeChatId ? state.chats[state.activeChatId] : null;

  const openChat = (chatId: string) => dispatch({ type: 'chatOpened', chatId });

  const handleSend = async (text: string) => {
    if (!activeChat) return;
    const { chatId } = activeChat;
    const localId = `local-${crypto.randomUUID()}`;
    dispatch({ type: 'sendStarted', chatId, localId, text, timestamp: Date.now() });
    try {
      const idMessage = await sendMessage(credentials, chatId, text);
      dispatch({ type: 'sendSucceeded', chatId, localId, idMessage });
    } catch {
      dispatch({ type: 'sendFailed', chatId, localId });
    }
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
        <NewChatForm onCreate={openChat} />
        <ChatList chats={chats} activeChatId={state.activeChatId} onSelect={openChat} />
      </aside>

      <main className="main">
        {activeChat ? (
          <ChatPanel chat={activeChat} onSend={handleSend} onBack={() => dispatch({ type: 'chatClosed' })} />
        ) : (
          <div className="main__placeholder">Выберите чат или создайте новый по номеру телефона</div>
        )}
      </main>
    </div>
  );
};
