import { useState, type FormEvent } from 'react';
import { isValidPhone, normalizePhone } from '../lib/phone';

interface NewChatFormProps {
  /** получает номер вида 79991234567; отклонённый промис — текст ошибки для пользователя */
  onCreate: (phone: string) => Promise<void>;
}

export const NewChatForm = ({ onCreate }: NewChatFormProps) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      setError('Номер в международном формате, например 79991234567');
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
      await onCreate(normalized);
      setPhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать чат');
    } finally {
      setIsCreating(false);
    }
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
        <button className="button button--compact" type="submit" disabled={!phone.trim() || isCreating}>
          {isCreating ? 'Ищем…' : 'Новый чат'}
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
