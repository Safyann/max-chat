const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const formatTime = (timestamp: number) => timeFormat.format(timestamp);
