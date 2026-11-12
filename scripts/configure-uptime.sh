#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
    echo 'Не найден .env кабинета. Сначала настройте кабинет по .env.example.' >&2
    exit 1
fi
read -rsp 'Вставьте ключ API Uptime и нажмите Enter: ' uptime_key
printf '\n'
if [[ ! "$uptime_key" =~ ^xsg_[A-Za-z0-9_-]+$ ]]; then
    echo 'Неверный формат ключа. Вставьте только ключ, без кавычек, пробелов и обратного слеша в конце.' >&2
    exit 1
fi
umask 077
backup_dir="${HOME}/bedolaga-cabinet-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
cp -p .env "$backup_dir/cabinet.env"
cp -p docker-compose.yml "$backup_dir/docker-compose.yml"
if [[ -f docker-compose.override.yml ]]; then cp -p docker-compose.override.yml "$backup_dir/"; fi
temp_env=$(mktemp .env.XXXXXX)
trap 'rm -f "$temp_env"; unset uptime_key' EXIT
awk '!/^[[:space:]]*(export[[:space:]]+)?XSG_UPTIME_API_KEY[[:space:]]*=/' .env > "$temp_env"
printf '\nXSG_UPTIME_API_KEY=%s\n' "$uptime_key" >> "$temp_env"
cat "$temp_env" > .env
echo "Ключ сохранён в .env. Бэкап: $backup_dir"
echo 'Теперь выполните: docker compose up -d --build cabinet-frontend'
