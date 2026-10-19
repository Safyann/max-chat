import type {
  CheckAccountResponse,
  Credentials,
  DeleteNotificationResponse,
  InstanceSettings,
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

const ERROR_REASONS: Record<number, string> = {
  401: 'Неверный idInstance или apiTokenInstance',
  403: 'Неверный idInstance или apiTokenInstance',
  466: 'Исчерпана квота тарифа GREEN-API',
  469: 'MAX ограничил проверку номеров, повторите через пару часов',
};

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
    throw new GreenApiError(ERROR_REASONS[response.status] ?? `Ошибка GREEN-API (${response.status})`, response.status);
  }

  // receiveNotification отдаёт пустое тело (или null), если за receiveTimeout уведомлений не пришло
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T | null;
  } catch {
    throw new GreenApiError('Некорректный ответ GREEN-API — проверьте apiUrl', response.status);
  }
};

export const getStateInstance = async (credentials: Credentials, signal?: AbortSignal) => {
  const data = await request<StateInstanceResponse>(buildUrl(credentials, 'getStateInstance'), { signal });
  if (!data) throw new GreenApiError('Пустой ответ getStateInstance');
  return data.stateInstance;
};

export const getSettings = async (credentials: Credentials, signal?: AbortSignal) => {
  const data = await request<InstanceSettings>(buildUrl(credentials, 'getSettings'), { signal });
  if (!data) throw new GreenApiError('Пустой ответ getSettings');
  return data;
};

/** MAX: chatId пользователя по номеру телефона (принимаются только номера +7 и +375). */
export const checkAccount = async (credentials: Credentials, phone: string) => {
  const data = await request<CheckAccountResponse>(buildUrl(credentials, 'checkAccount'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: Number(phone) }),
  });
  // неавторизованный инстанс отвечает 200 с { status: false, reason } вместо { exist, chatId }
  if (data && (data as { status?: unknown }).status === false) {
    throw new GreenApiError('Инстанс ещё запускается или не авторизован');
  }
  // null — ответ без exist: инстанс не MAX и метод не поддерживает
  return data && typeof data.exist === 'boolean' ? data : null;
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
