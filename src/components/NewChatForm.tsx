import { useState, type FormEvent } from 'react';
import { isValidPhone, normalizePhone, phoneToChatId } from '../lib/phone';

interface NewChatFormProps {
  onCreate: (chatId: string) => void;
}

export const NewChatForm = ({ onCreate }: NewChatFormProps) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      setError('Номер в международном формате, например 79991234567');
      return;
    }
    setError(null);
    setPhone('');
    onCreate(phoneToChatId(normalized));
  };

  return (
    <form className="new-chat" onSubmit={handleSubmit} noValidate>
      <div className="new-chat__row">
        <input
          className="field__input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Номер получателя"
          aria-label="Номер телефона получателя"
          aria-invalid={Boolean(error)}
        />
        <button className="button button--compact" type="submit" disabled={!phone.trim()}>
          Новый чат
        </button>
      </div>
      {error && (
        <p className="new-chat__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};
