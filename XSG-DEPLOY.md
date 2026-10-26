# XSG VPN — форк кабинета (v1.80.1)

Что изменено: src/styles/xsg.css (весь дизайн-слой), боковое меню (AppShell), главная (Dashboard и карточки),
glassTheme, StatCard, MobileBottomNav, BackgroundHost (фон отключён). Логика и API не тронуты. Светлая тема не используется.

## Разворот
1. Найти, как запущен кабинет:   docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -i cabinet
   Папка compose:               docker inspect <имя> --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
2. Бэкап: в этой папке  cp docker-compose.yml docker-compose.yml.bak ; docker tag <текущий_образ> cabinet:backup
3. Распаковать архив в /opt/cabinet-xsg и собрать образ (значения VITE_* возьмите из своего compose/.env):
   cd /opt/cabinet-xsg
   docker build -t cabinet-xsg:1 --build-arg VITE_API_URL=/api --build-arg VITE_TELEGRAM_BOT_USERNAME=<бот> --build-arg VITE_APP_NAME="XSG VPN" --build-arg VITE_APP_LOGO=X .
4. В compose заменить image: ghcr.io/bedolaga-dev/bedolaga-cabinet:latest на cabinet-xsg:1 и выполнить  docker compose up -d
5. Ctrl+F5.
## Откат
Вернуть image в compose на прежний (или cabinet:backup) и docker compose up -d.
## Лицензия
AGPL-3.0: изменённый кабинет должен быть доступен пользователям в исходниках (выложите форк в публичный репозиторий).
