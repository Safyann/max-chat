/** Приводит введённый номер к виду 79991234567: только цифры, ведущая 8 → 7. */
export const normalizePhone = (input: string) => {
  const digits = input.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
};

export const isValidPhone = (phone: string) => /^\d{10,15}$/.test(phone);

export const phoneToChatId = (phone: string) => `${phone}@c.us`;

/** Подпись чата: для chatId вида 79991234567@c.us — номер с плюсом, иначе chatId как есть. */
export const formatChatId = (chatId: string) => {
  const match = /^(\d+)@c\.us$/.exec(chatId);
  return match ? `+${match[1]}` : chatId;
};
