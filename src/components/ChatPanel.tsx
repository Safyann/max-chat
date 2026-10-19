import { useLayoutEffect, useRef } from 'react';
import type { MessageStatus } from '../api/types';
import type { Chat } from '../lib/chatReducer';
import { formatChatId } from '../lib/phone';
import { formatTime } from '../lib/time';
import { MessageInput } from './MessageInput';

const STATUS_LABEL: Record<MessageStatus, string> = {
  pending: '🕓',
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '!',
};

const STATUS_TITLE: Record<MessageStatus, string> = {
  pending: 'Отправляется',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не отправлено',
};

interface ChatPanelProps {
  chat: Chat;
  onSend: (text: string) => void;
  onBack: () => void;
}

export const ChatPanel = ({ chat, onSend, onBack }: ChatPanelProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const subtitle = chat.phone ? `+${chat.phone}` : formatChatId(chat.chatId);
  const title = chat.title || subtitle;

  const wasAtBottomRef = useRef(true);
  const lastMessage = chat.messages.at(-1);

  // при открытии чата и своём сообщении — вниз; входящее не сбивает прокрутку, если пользователь читает историю выше
  useLayoutEffect(() => {
    wasAtBottomRef.current = true;
  }, [chat.chatId]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && (wasAtBottomRef.current || lastMessage?.direction === 'out')) {
      list.scrollTop = list.scrollHeight;
    }
  }, [chat.chatId, chat.messages.length, lastMessage?.direction]);

  const handleScroll = () => {
    const list = listRef.current;
    if (list) wasAtBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  };

  return (
    <section className="chat-panel">
      <header className="chat-panel__header">
        <button type="button" className="icon-button chat-panel__back" onClick={onBack} aria-label="К списку чатов">
          ←
        </button>
        <span className="avatar" aria-hidden>
          {title.replace(/^\+/, '').charAt(0).toUpperCase()}
        </span>
        <div>
          <div className="chat-panel__title">{title}</div>
          {title !== subtitle && <div className="chat-panel__subtitle">{subtitle}</div>}
        </div>
      </header>

      <div className="messages" ref={listRef} onScroll={handleScroll} role="log" aria-live="polite">
        {chat.messages.length === 0 && <p className="messages__empty">Напишите первое сообщение</p>}
        {chat.messages.map((message) => (
          <div key={message.id} className={`message message--${message.direction}`}>
            <span className="message__text">{message.text}</span>
            <span className="message__meta">
              {formatTime(message.timestamp)}
              {message.status && (
                <span
                  className={`message__status message__status--${message.status}`}
                  title={STATUS_TITLE[message.status]}
                >
                  {STATUS_LABEL[message.status]}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <MessageInput key={chat.chatId} onSend={onSend} />
    </section>
  );
};
