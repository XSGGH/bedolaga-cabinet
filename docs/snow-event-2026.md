# Снежный переполох · запуск 2026

Пользовательский маршрут — `/snow-event`, административный —
`/admin/snow-event`. На главную добавлен компактный анонс; мобильная навигация
сохранила пять пунктов. Оба варианта главной страницы поддерживают анонс.

В релизе одна законченная мини-игра **«Снежный сбор»**, ежедневные снежинки,
календарь декабря, недельные бонусы, общая цель с четырьмя визуальными
изменениями сцены, магазин, квитанции и две постоянные награды профиля.
Управление игрой: касание/мышь или клавиши 1–5. Есть поддержка reduced motion.

Предпросмотр использует настоящий `SnowEvent.tsx` и `SnowGame.tsx`. Его API
работает с отдельной серверной сессией администратора. Доступны даты
27/30 ноября, 1/7/15/31 декабря, 1/8 января и выбор другого дня; состояния
подписки active/none/expired/renewed; тестовый баланс, reset и этапы общей цели.

Реальное расписание определяется API в Europe/Moscow. Клиент считает обратный
отсчёт от серверного времени через `performance.now()`, обновляет состояние на
границе периода и при возврате в приложение. Часы устройства не определяют
доступ. Реальные игровые операции до 1 декабря запрещены даже администратору.

## Деплой с резервной копией

Обновляются **кабинет и API бота**. Одной пересборки фронтенда недостаточно.
Серверная часть закреплена на коммите
`189dd2325b6d317351bba42a88487378252ae729` ветки `xsg-snow-2026` репозитория
`XSGGH/remnawave-bedolaga-telegram-bot`.

На сервере магазина:

```bash
sudo bash -c '
set -euo pipefail
repo=/home/user1/bedolaga-cabinet
git -c safe.directory="$repo" -C "$repo" fetch https://github.com/XSGGH/bedolaga-cabinet.git xsg-theme
git -c safe.directory="$repo" -C "$repo" show FETCH_HEAD:scripts/xsg-deploy-snow.sh > /root/xsg-deploy-snow.sh
bash /root/xsg-deploy-snow.sh
'
```

При нестандартных каталогах можно передать `XSG_BOT_DIR` и `XSG_CABINET_DIR`
в окружение root процесса. Стандартный каталог API:
`/home/user1/remnawave-bedolaga-telegram-bot`. Предполагаются существующие
Compose services `bot`, `postgres`, `cabinet-frontend` и порты 8080/3020.

### Продолжение после автоматического отката

Если оба образа собраны, таблицы созданы, но проверка получила `curl (56)`
сразу после запуска кабинета, повторная сборка не требуется. Исправленная
проверка повторяет запросы после сброса соединения и ждёт готовности nginx
до 90 секунд. Постоянная ошибка по-прежнему приводит к откату; её логи
сохраняются в приватном каталоге бэкапа.

Скрипт `scripts/xsg-resume-snow.sh BACKUP` использует готовые образы и staging
исходники. Сначала он проверяет, что контейнеры всё ещё соответствуют образам
отката, а исходники бота не менялись. Затем сохраняет свежий PostgreSQL dump,
восстанавливает модули события и повторяет переключение с ожиданием API/nginx.
При несовпадении состояния он останавливается до замены контейнеров.

Например, для неудачной попытки 27 ноября:

```bash
sudo bash -c '
set -euo pipefail
repo=/home/user1/bedolaga-cabinet
git -c safe.directory="$repo" -C "$repo" fetch https://github.com/XSGGH/bedolaga-cabinet.git xsg-theme
git -c safe.directory="$repo" -C "$repo" show FETCH_HEAD:scripts/xsg-resume-snow.sh > /root/xsg-resume-snow.sh
bash /root/xsg-resume-snow.sh /root/xsg-snow-backups/20261127-201244
'
```

Скрипт сохраняет образы (в том числе через `docker commit`, если исходный
образ удалён), код, изменения Git, Compose, nginx и PostgreSQL dump в
`/root/xsg-snow-backups/TIMESTAMP`. Затем собирает оба образа и проверяет
API/nginx **до замены контейнеров**. API собирается из копии текущего кода
сервера с добавлением восьми файлов/подключений события, без перехода бота
на чужую development branch. `.env`, nginx, overrides и остальной код
сохраняются. Версия Alembic на кастомном сервере не меняется: добавляются
только четыре таблицы события.

После переключения выполняются health checks и сверка публичных JS/CSS
с работающим контейнером. При неуспешной проверке запускается откат образов.
Контейнерные команды не читают stdin скрипта — прошлое зависание после
`nginx -t` исключено.

**Откат последнего успешного развёртывания:**

```bash
sudo bash -c '
set -euo pipefail
backup=$(cat /root/xsg-snow-backups/last-backup)
bash "$backup/deploy-script.sh" --rollback "$backup"
'
```

База автоматически не откатывается: сохраняются новые платежи, прогресс
и награды. Старые образы игнорируют таблицы события. Полный dump лежит
в резервной копии для отдельного восстановления при необходимости.

После успешного деплоя открыть `/admin/snow-event`, проверить общую цель
(по умолчанию 10 000 снежинок), затем «Предпросмотр глазами пользователя».
Для доступа нужны роль администратора и право `wheel:edit`.

## Основные файлы

- `src/api/snowEvent.ts` — контракт API, сценарии и даты.
- `src/components/snow-event/` — общие часы, анонс, игра, награды профиля, стили.
- `src/pages/SnowEvent.tsx` — единый пользовательский интерфейс и preview.
- `src/pages/AdminSnowEvent.tsx` — настройка и открытие preview.
- `src/App.tsx`, `Dashboard.tsx`, `DashboardLite.tsx`, `Profile.tsx`,
  `AdminPanel.tsx` — подключения к существующему кабинету.
- `scripts/xsg-deploy-snow.sh` — бэкап, деплой двух сервисов и откат.

Backend: четыре новые таблицы, migration 0132 для обычной установки ветки,
state machine, routes с авторизацией, атомарные награды и durable outbox.
Подробности — `docs/snow-event-2026.md` в репозитории бота.

## Иллюстрации

Инструмент: встроенный **imagegen**. Сгенерированы два изображения на базе
существующего белого кота XSG в закрытом фиолетовом шлеме. Формат проекта —
WebP, 1536 × 1024:

- `public/snow-event/winter-hero.webp` — праздничный финал.
- `public/snow-event/winter-base.webp` — тот же дата-центр без украшений.

Слои одной композиции открывают гирлянды на 25%, ёлку на 50%, подарки на 75%
и полный праздничный свет на 100%. До старта анонс показывает будущий финал.
Исходные изображения сохранены отдельно, существующий логотип не заменён.

**Промпт финальной сцены:**

> Create a premium cinematic 3D illustrated winter event hero asset for XSG VPN, using the reference as the EXACT identity of the protagonist: adorable WHITE astronaut cat, huge violet eyes and pink nose, fully enclosed round PURPLE space helmet, NO ears projecting through helmet. Wide landscape 1536x1024 composition. A miniature snowy futuristic data center at night, graphite charcoal architecture with muted lavender server lights, warm tiny string fairy lights, snow banks, tasteful small decorated Christmas tree and wrapped gifts. Cat in white and purple spacesuit on RIGHT CENTER, holding glowing pale blue snowflake with paw, friendly welcoming pose. More generous atmospheric dark negative space LEFT THIRD, seamless dark charcoal edges suitable for a Graphite Violet website. Detailed luxurious Pixar-quality sculpted materials, warm inviting winter atmosphere, cool snow with subtle lilac lighting, not oversaturated neon. No text, no UI, no letters, no watermark. Actual illustration asset, not website mockup.

**Промпт начальной сцены:**

> Edit this exact image to create the EARLY UNDECORATED stage of the same winter story. Preserve dimensions, exact composition, position and identity of the white astronaut cat, helmet, snowflake, snow, camera, buildings, color and lighting. Only remove the decorated Christmas tree and the wrapped gift boxes on the far right, replacing them with natural snowy ground and continuation of the same graphite server building. Remove the warm yellow garland/string fairy lights from the building roofs, leaving the roofs snowy and naturally dark. Keep the purple server lights and snowflake glow. Everything else should be exactly as close to original as possible. No new text, no new objects. This is a registered layer for revealing holiday decorations over time in a website; alignment with original is vital.
