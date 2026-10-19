const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Сегодняшние — только время, более старые — с датой, иначе вчерашнее «10:15» выглядит как сегодняшнее. */
export const formatTime = (timestamp: number, now = new Date()) => {
  const date = new Date(timestamp);
  return date.toDateString() === now.toDateString() ? timeFormat.format(date) : dateTimeFormat.format(date);
};
