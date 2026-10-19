import type { Chat } from '../lib/chatReducer';
import { formatChatId } from '../lib/phone';
import { formatTime } from '../lib/time';

interface ChatListProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (chatId: string) => void;
}

export const ChatList = ({ chats, activeChatId, onSelect }: ChatListProps) => {
  if (chats.length === 0) {
    return <p className="chat-list__empty">Чатов пока нет. Введите номер получателя, чтобы начать.</p>;
  }

  return (
    <ul className="chat-list">
      {chats.map((chat) => {
        const last = chat.messages.at(-1);
        const title = chat.title || formatChatId(chat.chatId);
        return (
          <li key={chat.chatId}>
            <button
              type="button"
              className={`chat-item${chat.chatId === activeChatId ? ' chat-item--active' : ''}`}
              onClick={() => onSelect(chat.chatId)}
              aria-current={chat.chatId === activeChatId}
            >
              <span className="avatar" aria-hidden>
                {title.replace(/^\+/, '').charAt(0).toUpperCase()}
              </span>
              <span className="chat-item__body">
                <span className="chat-item__top">
                  <span className="chat-item__title">{title}</span>
                  {last && <span className="chat-item__time">{formatTime(last.timestamp)}</span>}
                </span>
                <span className="chat-item__bottom">
                  <span className="chat-item__preview">
                    {last ? `${last.direction === 'out' ? 'Вы: ' : ''}${last.text}` : 'Нет сообщений'}
                  </span>
                  {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
