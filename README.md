# MAX Chat — GREEN-API

Веб-интерфейс для отправки и получения текстовых сообщений в мессенджере MAX через [GREEN-API](https://green-api.com/max). Тестовое задание на позицию «Фронтенд-разработчик React».

**Демо:** https://safyann.github.io/max-chat/

## Возможности

- Вход по `idInstance`, `apiTokenInstance` и `apiUrl` с проверкой через `getStateInstance` (инстанс должен быть в состоянии `authorized`). `apiUrl` и `idInstance` запоминаются.
- Создание чата по номеру телефона (`79991234567`, `+7 (999) 123-45-67`, `8 999…`, `999…`). chatId пользователя MAX определяется через [`checkAccount`](https://green-api.com/v3/docs/api/service/CheckAccount/), поэтому ответы попадают в тот же чат; для инстанса без этого метода используется `79991234567@c.us`.
- Отправка текстовых сообщений методом [`sendMessage`](https://green-api.com/v3/docs/api/sending/SendMessage/), повтор неотправленных.
- Получение сообщений через [HTTP API](https://green-api.com/v3/docs/api/receiving/technology-http-api/): long polling `receiveNotification` → обработка → `deleteNotification`.
- Статусы исходящих (отправлено / доставлено / прочитано / ошибка) по уведомлениям `outgoingMessageStatus`.
- Ответы с цитатой показывают цитируемое сообщение; сообщения, отправленные с телефона, тоже попадают в чат.
- Список чатов по последней активности со счётчиком непрочитанных; история хранится в `localStorage` отдельно для каждого инстанса.
- Адаптивная вёрстка (на мобильных — список или чат, работает системная кнопка «Назад»), светлая и тёмная тема по настройке системы.

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

Workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml) на каждый push в `main` прогоняет тесты, собирает проект и публикует `dist/` на https://safyann.github.io/max-chat/. Для форка один раз включите в репозитории **Settings → Pages → Source: GitHub Actions**.

## Настройка инстанса

Для приёма сообщений в настройках инстанса в консоли GREEN-API:

- поле **webhookUrl** должно быть пустым (иначе уведомления уходят на вебхук, а не в очередь HTTP API);
- включены «Получать уведомления о входящих сообщениях», «…об исходящих сообщениях» и «…о статусах исходящих».

После входа приложение проверяет эти настройки через `getSettings` и показывает предупреждение, если ответы не смогут прийти.

Поле `apiUrl` на форме входа по умолчанию `https://api.green-api.com`; если в консоли у инстанса указан другой адрес — укажите его.

## Структура

```
src/
  api/          клиент GREEN-API и типы ответов/уведомлений
  lib/          чистая логика: разбор уведомлений, reducer чатов, телефоны, хранилище
  hooks/        useNotificationPolling — long polling с отменой и повтором при ошибке;
                useChatHistory — открытый чат в history.state
  components/   LoginForm, Messenger, ChatList, NewChatForm, ChatPanel, MessageInput
```

Состояние — `useReducer` без внешних библиотек. Reducer покрыт тестами: дедупликация исходящих (ответ `sendMessage` и уведомление `outgoingAPIMessageReceived` могут прийти в любом порядке), монотонность статусов, перенос чата с номера на chatId MAX, счётчик непрочитанных.

## Ограничения

- Отправляется и отображается только текст — по условию задания. Фото, файлы и голосовые показываются заглушкой «откройте в приложении MAX».
- История не подгружается с сервера: в чате видны сообщения, полученные с момента первого входа в этом браузере.
- `apiTokenInstance` хранится в `sessionStorage` и уходит только на `apiUrl`; приложение полностью клиентское.
