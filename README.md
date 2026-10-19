# MAX Chat — GREEN-API

Веб-интерфейс для отправки и получения текстовых сообщений в мессенджере MAX через [GREEN-API](https://green-api.com/max). Тестовое задание на позицию «Фронтенд-разработчик React».

## Возможности

- Вход по `idInstance` и `apiTokenInstance` с проверкой через `getStateInstance` (инстанс должен быть в состоянии `authorized`).
- Создание чата по номеру телефона получателя (`79991234567`, `+7 (999) 123-45-67`, `8 999…` → chatId `79991234567@c.us`).
- Отправка текстовых сообщений методом [`sendMessage`](https://green-api.com/v3/docs/api/sending/SendMessage/).
- Получение сообщений через [HTTP API](https://green-api.com/v3/docs/api/receiving/technology-http-api/): long polling `receiveNotification` → обработка → `deleteNotification`.
- Статусы исходящих (отправлено / доставлено / прочитано / ошибка) по уведомлениям `outgoingMessageStatus`.
- Сообщения, отправленные с телефона, тоже попадают в чат (`outgoingMessageReceived`).
- Список чатов со счётчиком непрочитанных; история хранится в `localStorage` отдельно для каждого инстанса.
- Адаптивная вёрстка (на мобильных — список или чат), светлая и тёмная тема по настройке системы.

## Запуск

Нужен Node.js 18+.

```bash
npm install
npm run dev
```

Откройте http://localhost:5173 и введите данные инстанса из [консоли GREEN-API](https://console.green-api.com).

Прочие команды:

```bash
npm test          # unit-тесты (vitest)
npm run build     # typecheck + production-сборка в dist/
npm run preview   # раздать собранный dist/
```

`dist/` — статика с относительными путями (`base: './'`), её можно выложить на любой хостинг (GitHub Pages, Netlify, Vercel).

## Деплой на GitHub Pages

Workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) на каждый push в `main` прогоняет тесты, собирает проект и публикует `dist/`. Один раз в репозитории: **Settings → Pages → Source: GitHub Actions**. Адрес: `https://<user>.github.io/<repo>/`.

## Настройка инстанса

Для приёма сообщений в настройках инстанса в консоли GREEN-API:

- поле **webhookUrl** должно быть пустым (иначе уведомления уходят на вебхук, а не в очередь HTTP API);
- включены «Получать уведомления о входящих сообщениях», «…об исходящих сообщениях» и «…о статусах исходящих».

Поле `apiUrl` на форме входа по умолчанию `https://api.green-api.com`; если в консоли у инстанса указан другой адрес — укажите его.

## Структура

```
src/
  api/          клиент GREEN-API и типы ответов/уведомлений
  lib/          чистая логика: разбор уведомлений, reducer чатов, телефоны, хранилище
  hooks/        useNotificationPolling — цикл long polling с отменой и повтором при ошибке
  components/   LoginForm, Messenger, ChatList, NewChatForm, ChatPanel, MessageInput
```

Состояние — `useReducer` без внешних библиотек. Reducer покрыт тестами: дедупликация исходящих (ответ `sendMessage` и уведомление `outgoingAPIMessageReceived` могут прийти в любом порядке), монотонность статусов, счётчик непрочитанных.

## Ограничения

- Только текстовые сообщения (`textMessage`, `extendedTextMessage`) — по условию задания; уведомления других типов удаляются из очереди, чтобы не блокировать её.
- История не подгружается с сервера: в чате видны сообщения, полученные с момента первого входа в этом браузере.
- `apiTokenInstance` хранится в `sessionStorage` и уходит только на `apiUrl`; приложение полностью клиентское.
