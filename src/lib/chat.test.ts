import { describe, expect, it } from 'vitest';
import { chatReducer, initialChatState, type ChatState } from './chatReducer';
import { parseWebhook, type ChatEvent } from './notifications';
import { formatChatId, isValidPhone, normalizePhone, phoneToChatId } from './phone';
import { diagnoseSettings } from './settings';

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
    expect(isValidPhone('123')).toBe(false);
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
      messageData: { typeMessage: 'quotedMessage', extendedTextMessageData: { text: 'ответ на цитату' } },
    };
    expect(parseWebhook(quoted)).toMatchObject({ kind: 'message', direction: 'in', text: 'ответ на цитату' });
  });

  it('игнорирует нетекстовые сообщения и служебные уведомления', () => {
    const image = { ...incoming('m3', ''), messageData: { typeMessage: 'imageMessage' } };
    expect(parseWebhook(image)).toBeNull();
    expect(parseWebhook({ typeWebhook: 'stateInstanceChanged' })).toBeNull();
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

  it('помечает неотправленное', () => {
    let state = chatReducer(initialChatState, { type: 'sendStarted', chatId: CHAT_ID, localId: 'l', text: 'x', timestamp: 1 });
    state = chatReducer(state, { type: 'sendFailed', chatId: CHAT_ID, localId: 'l' });
    expect(state.chats[CHAT_ID].messages[0].status).toBe('failed');
  });
});
