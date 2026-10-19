import type {
  Credentials,
  DeleteNotificationResponse,
  Notification,
  SendMessageResponse,
  StateInstanceResponse,
} from './types';

export class GreenApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GreenApiError';
  }
}

const buildUrl = ({ apiUrl, idInstance, apiTokenInstance }: Credentials, method: string, suffix = '') =>
  `${apiUrl.replace(/\/+$/, '')}/waInstance${idInstance}/${method}/${apiTokenInstance}${suffix}`;

const request = async <T>(url: string, init?: RequestInit): Promise<T | null> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new GreenApiError('Нет соединения с GREEN-API');
  }

  if (!response.ok) {
    const reason =
      response.status === 401 || response.status === 403
        ? 'Неверный idInstance или apiTokenInstance'
        : `Ошибка GREEN-API (${response.status})`;
    throw new GreenApiError(reason, response.status);
  }

  // receiveNotification отдаёт пустое тело (или null), если за receiveTimeout уведомлений не пришло
  const text = await response.text();
  return text ? (JSON.parse(text) as T | null) : null;
};

export const getStateInstance = async (credentials: Credentials, signal?: AbortSignal) => {
  const data = await request<StateInstanceResponse>(buildUrl(credentials, 'getStateInstance'), { signal });
  if (!data) throw new GreenApiError('Пустой ответ getStateInstance');
  return data.stateInstance;
};

export const sendMessage = async (credentials: Credentials, chatId: string, message: string) => {
  const data = await request<SendMessageResponse>(buildUrl(credentials, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  });
  if (!data) throw new GreenApiError('Пустой ответ sendMessage');
  return data.idMessage;
};

export const receiveNotification = (credentials: Credentials, receiveTimeout: number, signal?: AbortSignal) =>
  request<Notification>(buildUrl(credentials, 'receiveNotification', `?receiveTimeout=${receiveTimeout}`), {
    signal,
  });

export const deleteNotification = (credentials: Credentials, receiptId: number, signal?: AbortSignal) =>
  request<DeleteNotificationResponse>(buildUrl(credentials, 'deleteNotification', `/${receiptId}`), {
    method: 'DELETE',
    signal,
  });
