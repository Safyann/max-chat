import { useEffect, type Dispatch } from 'react';
import type { ChatAction, ChatState } from '../lib/chatReducer';

interface HistoryState {
  chatId?: string;
}

const currentChatId = () => (window.history.state as HistoryState | null)?.chatId;

/**
 * Открытый чат живёт в history.state: системная/браузерная «Назад» на телефоне возвращает к списку,
 * а не уводит со страницы, и после перезагрузки открывается тот же чат.
 */
export const useChatHistory = (state: ChatState, dispatch: Dispatch<ChatAction>) => {
  // восстановление после перезагрузки
  useEffect(() => {
    const chatId = currentChatId();
    if (chatId && state.chats[chatId]) dispatch({ type: 'chatOpened', chatId });
    // намеренно только при монтировании
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const chatId = (event.state as HistoryState | null)?.chatId;
      dispatch(chatId ? { type: 'chatOpened', chatId } : { type: 'chatClosed' });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch]);

  // чат мог переехать под новый chatId (MAX) — держим history в согласии с ним
  useEffect(() => {
    const chatId = currentChatId();
    if (chatId && state.activeChatId && chatId !== state.activeChatId) {
      window.history.replaceState({ chatId: state.activeChatId }, '');
    }
  }, [state.activeChatId]);

  const openChat = (chatId: string, phone?: string) => {
    // переключение между чатами не плодит записи: «Назад» всегда ведёт к списку
    if (currentChatId()) window.history.replaceState({ chatId }, '');
    else window.history.pushState({ chatId }, '');
    dispatch({ type: 'chatOpened', chatId, phone, timestamp: Date.now() });
  };

  const closeChat = () => {
    if (currentChatId()) window.history.back();
    else dispatch({ type: 'chatClosed' });
  };

  return { openChat, closeChat };
};
