import { useState, type FormEvent, type KeyboardEvent } from 'react';

// ограничение sendMessage в GREEN-API
const MAX_LENGTH = 4000;

interface MessageInputProps {
  onSend: (text: string) => void;
}

export const MessageInput = ({ onSend }: MessageInputProps) => {
  const [text, setText] = useState('');
  const trimmed = text.trim();

  const submit = () => {
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  // Enter — отправить, Shift+Enter — перенос строки
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <textarea
        className="composer__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Сообщение"
        aria-label="Текст сообщения"
        maxLength={MAX_LENGTH}
        rows={1}
        autoFocus
      />
      <button className="button composer__send" type="submit" disabled={!trimmed} aria-label="Отправить">
        ➤
      </button>
    </form>
  );
};
