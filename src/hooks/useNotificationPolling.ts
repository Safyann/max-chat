import { useEffect, useRef, useState } from 'react';
import { deleteNotification, receiveNotification } from '../api/greenApi';
import type { Credentials, WebhookBody } from '../api/types';
import { parseWebhook, type ChatEvent } from '../lib/notifications';

const RECEIVE_TIMEOUT_SECONDS = 20;
const RETRY_DELAY_MS = 5000;

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

const handleSafely = (body: unknown, onEvent: (event: ChatEvent) => void) => {
  try {
    const event = parseWebhook(body as WebhookBody);
    if (event) onEvent(event);
  } catch (error) {
    // уведомление неожиданного формата не должно навсегда застрять в голове очереди
    console.warn('GREEN-API: не удалось обработать уведомление', body, error);
  }
};

/**
 * Long polling очереди уведомлений GREEN-API: receiveNotification → обработка → deleteNotification.
 * Уведомления, не относящиеся к текстовым сообщениям, тоже удаляются, иначе они заблокируют очередь.
 */
export const useNotificationPolling = (credentials: Credentials, onEvent: (event: ChatEvent) => void) => {
  const [error, setError] = useState<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const poll = async () => {
      while (!signal.aborted) {
        try {
          const notification = await receiveNotification(credentials, RECEIVE_TIMEOUT_SECONDS, signal);
          setError(null);
          if (!notification) continue;

          handleSafely(notification.body, onEventRef.current);
          await deleteNotification(credentials, notification.receiptId, signal);
        } catch (err) {
          if (isAbort(err)) return;
          setError(err instanceof Error ? err.message : 'Ошибка получения сообщений');
          await delay(RETRY_DELAY_MS, signal);
        }
      }
    };

    void poll();
    return () => controller.abort();
  }, [credentials]);

  return error;
};
