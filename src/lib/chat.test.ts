import { describe, expect, it } from 'vitest';
import { chatActivity, chatReducer, initialChatState, type ChatState } from './chatReducer';
import { parseWebhook, type ChatEvent } from './notifications';
import { formatChatId, isValidPhone, normalizePhone, phoneToChatId } from './phone';
import { diagnoseSettings } from './settings';
import { formatTime } from './time';

const CHAT_ID = '79991234567@c.us';

const incoming = (id: string, text: string, timestamp = 1_700_000_000) => ({
  typeWebhook: 'incomingMessageReceived',
  idMessage: id,
  timestamp,
  senderData: { chatId: CHAT_ID, senderName: 'Иван', chatName: 'Иван' },
  messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
});

const apply = (state: ChatState, ...events: ChatEvent[]) =>
  events.reduce((acc, event) => chatReducer(acc, { type: 'eventReceived', event }), state);

describe('phone', () => {
  it('нормализует номер и строит chatId', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567');
    expect(normalizePhone('8 999 123 45 67')).toBe('79991234567');
    expect(normalizePhone('999 123-45-67')).toBe('79991234567');
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('4951234567')).toBe(false);
    expect(phoneToChatId('79991234567')).toBe(CHAT_ID);
    expect(formatChatId(CHAT_ID)).toBe('+79991234567');
    expect(formatChatId('10000000')).toBe('10000000');
  });
});

describe('parseWebhook', () => {
  it('разбирает входящее текстовое', () => {
    expect(parseWebhook(incoming('m1', 'Привет'))).toEqual({
      kind: 'message',
      chatId: CHAT_ID,
      chatName: 'Иван',
      id: 'm1',
      text: 'Привет',
      direction: 'in',
      timestamp: 1_700_000_000_000,
    });
  });

  it('разбирает extendedTextMessage и исходящее с телефона', () => {
    const event = parseWebhook({
      ...incoming('m2', ''),
      typeWebhook: 'outgoingMessageReceived',
      messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'ссылка' } },
    });
    expect(event).toMatchObject({ kind: 'message', direction: 'out', text: 'ссылка', chatName: undefined });
  });

  it('разбирает ответ с цитатой (quotedMessage)', () => {
    const quoted = {
      ...incoming('m5', ''),
      messageData: {
        typeMessage: 'quotedMessage',
        extendedTextMessageData: { text: 'ответ на цитату', stanzaId: 'api-1' },
      },
    };
    expect(parseWebhook(quoted)).toMatchObject({ kind: 'message', text: 'ответ на цитату', quotedId: 'api-1' });
  });

  it('нетекстовое сообщение показывает заглушкой, служебные уведомления игнорирует', () => {
    const image = { ...incoming('m3', ''), messageData: { typeMessage: 'imageMessage', fileMessageData: { caption: 'море' } } };
    expect(parseWebhook(image)).toMatchObject({ unsupported: true, text: expect.stringMatching(/^🖼 Фото.*\nморе$/s) });
    const unknown = { ...incoming('m4', ''), messageData: { typeMessage: 'somethingNew' } };
    expect(parseWebhook(unknown)).toMatchObject({ unsupported: true, text: expect.stringContaining('Сообщение') });
    expect(parseWebhook({ typeWebhook: 'stateInstanceChanged' })).toBeNull();
  });

  it('для группы берёт название чата, а не имя участника', () => {
    const group = {
      ...incoming('g1', 'всем привет'),
      senderData: { chatId: '-6987', chatName: 'Команда', senderName: 'Иван', senderContactName: 'Иван' },
    };
    expect(parseWebhook(group)).toMatchObject({ chatName: 'Команда' });
  });

  it('разбирает статус исходящего', () => {
    expect(
      parseWebhook({ typeWebhook: 'outgoingMessageStatus', chatId: CHAT_ID, idMessage: 'm4', status: 'read', timestamp: 1 }),
    ).toEqual({ kind: 'status', chatId: CHAT_ID, id: 'm4', status: 'read' });
  });
});

describe('diagnoseSettings', () => {
  it('без замечаний при правильных настройках', () => {
    expect(diagnoseSettings({ webhookUrl: '', incomingWebhook: 'yes', outgoingWebhook: 'yes' })).toEqual([]);
  });

  it('находит вебхук и выключенные уведомления', () => {
    expect(diagnoseSettings({ webhookUrl: 'https://x', incomingWebhook: 'no', outgoingWebhook: 'no' })).toHaveLength(3);
  });
});

describe('chatReducer', () => {
  it('создаёт чат по входящему и считает непрочитанные', () => {
    const state = apply(initialChatState, parseWebhook(incoming('m1', 'a'))!, parseWebhook(incoming('m2', 'b', 1_700_000_001))!);
    expect(state.chats[CHAT_ID].messages.map((m) => m.text)).toEqual(['a', 'b']);
    expect(state.chats[CHAT_ID].unread).toBe(2);
    expect(state.chats[CHAT_ID].title).toBe('Иван');

    const opened = chatReducer(state, { type: 'chatOpened', chatId: CHAT_ID });
    expect(opened.chats[CHAT_ID].unread).toBe(0);
    expect(apply(opened, parseWebhook(incoming('m3', 'c', 1_700_000_002))!).chats[CHAT_ID].unread).toBe(0);
  });

  it('не дублирует отправленное через API, когда приходит outgoingAPIMessageReceived', () => {
    let state = chatReducer(initialChatState, { type: 'chatOpened', chatId: CHAT_ID });
    state = chatReducer(state, { type: 'sendStarted', chatId: CHAT_ID, localId: 'local-1', text: 'hi', timestamp: 1 });
    expect(state.chats[CHAT_ID].messages[0].status).toBe('pending');

    state = chatReducer(state, { type: 'sendSucceeded', chatId: CHAT_ID, localId: 'local-1', idMessage: 'api-1' });
    state = apply(state, { kind: 'message', chatId: CHAT_ID, id: 'api-1', text: 'hi', direction: 'out', timestamp: 2 });
    expect(state.chats[CHAT_ID].messages).toHaveLength(1);
    expect(state.chats[CHAT_ID].messages[0]).toMatchObject({ id: 'api-1', status: 'sent' });
  });

  it('убирает локальную копию, если уведомление пришло раньше ответа sendMessage', () => {
    let state = chatReducer(initialChatState, { type: 'sendStarted', chatId: CHAT_ID, localId: 'local-1', text: 'hi', timestamp: 1 });
    state = apply(state, { kind: 'message', chatId: CHAT_ID, id: 'api-1', text: 'hi', direction: 'out', timestamp: 2 });
    state = chatReducer(state, { type: 'sendSucceeded', chatId: CHAT_ID, localId: 'local-1', idMessage: 'api-1' });
    expect(state.chats[CHAT_ID].messages.map((m) => m.id)).toEqual(['api-1']);
  });

  it('не понижает статус сообщения', () => {
    let state = chatReducer(initialChatState, { type: 'sendStarted', chatId: CHAT_ID, localId: 'l', text: 'x', timestamp: 1 });
    state = chatReducer(state, { type: 'sendSucceeded', chatId: CHAT_ID, localId: 'l', idMessage: 'id' });
    state = apply(
      state,
      { kind: 'status', chatId: CHAT_ID, id: 'id', status: 'read' },
      { kind: 'status', chatId: CHAT_ID, id: 'id', status: 'delivered' },
    );
    expect(state.chats[CHAT_ID].messages[0].status).toBe('read');
  });

  it('MAX: переносит чат, открытый по номеру, под chatId пользователя из входящего', () => {
    let state = chatReducer(initialChatState, { type: 'chatOpened', chatId: CHAT_ID });
    state = chatReducer(state, { type: 'sendStarted', chatId: CHAT_ID, localId: 'l', text: 'привет', timestamp: 1 });

    const maxIncoming = {
      ...incoming('m1', 'ответ'),
      senderData: { chatId: '10000000', sender: '10000000', senderName: 'Иван', senderPhoneNumber: 79991234567 },
    };
    state = apply(state, parseWebhook(maxIncoming)!);

    expect(Object.keys(state.chats)).toEqual(['10000000']);
    expect(state.activeChatId).toBe('10000000');
    expect(state.chats['10000000']).toMatchObject({ phone: '79991234567', title: 'Иван', unread: 0 });
    expect(state.chats['10000000'].messages.map((m) => m.text)).toEqual(['привет', 'ответ']);
  });

  it('MAX: chatOpened с номером сразу кладёт чат под chatId пользователя', () => {
    let state = chatReducer(initialChatState, { type: 'chatOpened', chatId: '10000000', phone: '79991234567' });
    const maxIncoming = {
      ...incoming('m1', 'ответ'),
      senderData: { chatId: '10000000', sender: '10000000', senderPhoneNumber: 79991234567 },
    };
    state = apply(state, parseWebhook(maxIncoming)!);
    expect(Object.keys(state.chats)).toEqual(['10000000']);
    expect(state.chats['10000000'].messages).toHaveLength(1);
  });

  it('MAX: вливает уже разделившиеся чаты (по номеру и по chatId) в один', () => {
    let state = chatReducer(initialChatState, { type: 'sendStarted', chatId: CHAT_ID, localId: 'l', text: 'привет', timestamp: 1000 });
    const reply = (id: string, timestamp: number) => ({
      ...incoming(id, id, timestamp),
      senderData: { chatId: '10000000', sender: '10000000', senderPhoneNumber: 0 },
    });
    state = apply(state, parseWebhook(reply('r1', 2))!); // старая версия: phone не пришёл — отдельный чат
    expect(Object.keys(state.chats)).toHaveLength(2);

    const withPhone = { ...reply('r2', 3), senderData: { chatId: '10000000', sender: '10000000', senderPhoneNumber: 79991234567 } };
    state = apply(state, parseWebhook(withPhone)!);
    expect(Object.keys(state.chats)).toEqual(['10000000']);
    expect(state.chats['10000000'].messages.map((m) => m.text)).toEqual(['привет', 'r1', 'r2']);
  });

  it('завершение отправки после переезда чата не создаёт чат-призрак', () => {
    let state = chatReducer(initialChatState, { type: 'chatOpened', chatId: CHAT_ID });
    state = chatReducer(state, { type: 'sendStarted', chatId: CHAT_ID, localId: 'l', text: 'привет', timestamp: 1 });
    const maxIncoming = { ...incoming('m1', 'ответ'), senderData: { chatId: '10000000', senderPhoneNumber: 79991234567 } };
    state = apply(state, parseWebhook(maxIncoming)!); // чат переехал, пока sendMessage ещё в полёте
    state = chatReducer(state, { type: 'sendSucceeded', chatId: CHAT_ID, localId: 'l', idMessage: 'api-1' });

    expect(Object.keys(state.chats)).toEqual(['10000000']);
    expect(state.chats['10000000'].messages[0]).toMatchObject({ id: 'api-1', status: 'sent' });
  });

  it('после перезагрузки во время отправки подтверждает «не отправлено», а не дублирует', () => {
    let state = chatReducer(initialChatState, { type: 'sendStarted', chatId: CHAT_ID, localId: 'local-1', text: 'hi', timestamp: 1 });
    state = chatReducer(state, { type: 'sendFailed', chatId: CHAT_ID, localId: 'local-1' }); // так помечает loadChats
    state = apply(state, { kind: 'message', chatId: CHAT_ID, id: 'api-1', text: 'hi', direction: 'out', timestamp: 2 });
    expect(state.chats[CHAT_ID].messages).toEqual([
      expect.objectContaining({ id: 'api-1', status: 'sent', timestamp: 1 }),
    ]);
  });

  it('повтор отправки неотправленного сообщения', () => {
    let state = chatReducer(initialChatState, { type: 'sendStarted', chatId: CHAT_ID, localId: 'local-1', text: 'hi', timestamp: 1 });
    state = chatReducer(state, { type: 'sendFailed', chatId: CHAT_ID, localId: 'local-1' });
    state = chatReducer(state, { type: 'resendStarted', chatId: CHAT_ID, localId: 'local-1' });
    expect(state.chats[CHAT_ID].messages[0].status).toBe('pending');
    state = chatReducer(state, { type: 'sendSucceeded', chatId: CHAT_ID, localId: 'local-1', idMessage: 'api-1' });
    expect(state.chats[CHAT_ID].messages).toEqual([expect.objectContaining({ id: 'api-1', status: 'sent' })]);
  });

  it('пустой чат сортируется по времени создания, а не висит наверху всегда', () => {
    let state = apply(initialChatState, parseWebhook(incoming('m1', 'старое', 1000))!);
    state = chatReducer(state, { type: 'chatOpened', chatId: 'new@c.us', timestamp: 2_000_000 });
    const fresh = { ...incoming('m2', 'свежее', 3000), senderData: { chatId: 'other@c.us' } };
    state = apply(state, parseWebhook(fresh)!);
    const order = Object.values(state.chats).sort((a, b) => chatActivity(b) - chatActivity(a)).map((c) => c.chatId);
    expect(order).toEqual(['other@c.us', 'new@c.us', CHAT_ID]);
  });

  it('игнорирует статус сообщения из незнакомого чата', () => {
    const state = apply(initialChatState, { kind: 'status', chatId: 'unknown', id: 'x', status: 'read' });
    expect(state.chats).toEqual({});
  });

  it('помечает неотправленное', () => {
    let state = chatReducer(initialChatState, { type: 'sendStarted', chatId: CHAT_ID, localId: 'l', text: 'x', timestamp: 1 });
    state = chatReducer(state, { type: 'sendFailed', chatId: CHAT_ID, localId: 'l' });
    expect(state.chats[CHAT_ID].messages[0].status).toBe('failed');
  });
});

describe('formatTime', () => {
  it('сегодня — только время, раньше — с датой', () => {
    const now = new Date(2026, 9, 19, 12, 0);
    expect(formatTime(new Date(2026, 9, 19, 9, 5).getTime(), now)).toBe('09:05');
    expect(formatTime(new Date(2026, 9, 18, 9, 5).getTime(), now)).toMatch(/18.*09:05/);
  });
});
