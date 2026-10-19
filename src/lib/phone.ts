/**
 * Приводит введённый номер к виду 79991234567: только цифры, ведущая 8 → 7,
 * российский мобильный без кода страны (9991234567) → с кодом 7.
 */
export const normalizePhone = (input: string) => {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `7${digits}`;
  return digits;
};

// номер без кода страны дал бы несуществующий chatId, и сообщения молча уходили бы в никуда
export const isValidPhone = (phone: string) => /^\d{11,15}$/.test(phone);

export const phoneToChatId = (phone: string) => `${phone}@c.us`;

/** Подпись чата: для chatId вида 79991234567@c.us — номер с плюсом, иначе chatId как есть. */
export const formatChatId = (chatId: string) => {
  const match = /^(\d+)@c\.us$/.exec(chatId);
  return match ? `+${match[1]}` : chatId;
};
