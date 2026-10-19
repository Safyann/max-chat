import type { InstanceSettings } from '../api/types';

/** Проверяет настройки инстанса, без которых уведомления не попадут в очередь HTTP API. */
export const diagnoseSettings = (settings: InstanceSettings): string[] => {
  const problems: string[] = [];
  if (settings.webhookUrl) {
    problems.push('задан webhookUrl — уведомления уходят на вебхук, а не в очередь; очистите поле');
  }
  if (settings.incomingWebhook !== 'yes') {
    problems.push('выключены уведомления о входящих сообщениях — ответы не придут');
  }
  if (settings.outgoingWebhook !== 'yes') {
    problems.push('выключены уведомления о статусах исходящих — не будет отметок доставки и прочтения');
  }
  return problems;
};
