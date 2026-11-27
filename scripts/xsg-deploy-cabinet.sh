#!/usr/bin/env bash
# Frontend-only update. Preserve the running image and server-specific nginx/Compose settings.
set -Eeuo pipefail
umask 077
test "$(id -u)" = 0 || { echo 'Запустите через sudo bash.'; exit 1; }

rollback() {
    local saved=${1:?Укажите каталог бэкапа}
    test -s "$saved/image.tar.gz" && test -s "$saved/compose.yml" && test -s "$saved/rollback.json" || return 1
    local directory
    directory=$(cat "$saved/cabinet-dir") || return 1
    gzip -dc "$saved/image.tar.gz" | docker load >/dev/null || return 1
    cp -p "$saved/nginx.conf" "$directory/nginx.conf" || return 1
    cd "$directory" || return 1
    docker compose -p "$(cat "$saved/project")" -f "$saved/compose.yml" -f "$saved/rollback.json" \
        up -d --force-recreate --no-deps --no-build --pull never cabinet-frontend </dev/null || return 1
    echo "Возвращён сохранённый frontend. API и БД не изменялись. Бэкап: $saved"
}
if test "${1:-}" = --rollback; then rollback "${2:?Укажите каталог бэкапа}"; exit 0; fi

cabinet=${XSG_CABINET_DIR:-/home/user1/bedolaga-cabinet}
cd "$cabinet"
g() { git -c safe.directory="$cabinet" "$@"; }
test "$(g branch --show-current)" = xsg-theme
test -z "$(g ls-files -u)" || { echo 'Есть конфликт Git. Контейнер не заменён.'; exit 1; }
test -z "$(g diff --name-only HEAD -- . ':(exclude)nginx.conf')" || {
    echo 'Есть изменения исходников кроме nginx.conf. Они сохранены; деплой остановлен.'; exit 1;
}
container=$(docker compose ps -q cabinet-frontend)
test -n "$container" || { echo 'Работающий кабинет не найден.'; exit 1; }
if docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' "$container" |
    grep -Eq '^/usr/share/nginx/html(/.*)?$'; then
    echo 'Файлы сайта примонтированы извне. Деплой остановлен до изменения контейнера.'; exit 1
fi
stamp=$(date +%Y%m%d-%H%M%S)
backup="/root/bedolaga-cabinet-backups/$stamp"
mkdir -p "$backup"
cp "$0" "$backup/deploy-script.sh"
printf '%s\n' "$cabinet" > "$backup/cabinet-dir"
cp -p nginx.conf "$backup/nginx.conf"
docker compose config > "$backup/compose.yml"
docker inspect "$container" > "$backup/container.json"
docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container" > "$backup/project"
test -s "$backup/project"
g rev-parse HEAD > "$backup/commit"
g diff --binary HEAD > "$backup/local-changes.patch"
tar --exclude='./.git' --exclude='./node_modules' --exclude='./dist' --exclude='./tmp' -czf "$backup/project.tar.gz" .
docker cp "$container:/usr/share/nginx/html" "$backup/html" >/dev/null
image=$(docker inspect --format '{{.Image}}' "$container")
tag="xsg-cabinet-backup:$stamp"
if docker image inspect "$image" >/dev/null 2>&1; then docker tag "$image" "$tag";
else echo 'Исходный образ удалён: сохраняем работающий контейнер.'; docker commit "$container" "$tag" >/dev/null; fi
docker save "$tag" | gzip > "$backup/image.tar.gz"
gzip -t "$backup/image.tar.gz"
python3 - "$backup/rollback.json" "$tag" <<'PY'
import json,sys
with open(sys.argv[1], 'w') as f:
    json.dump({'services': {'cabinet-frontend': {'image': sys.argv[2]}}}, f)
PY
echo "Резервная копия готова: $backup"
echo "Ручной откат: sudo bash '$backup/deploy-script.sh' --rollback '$backup'"

g fetch https://github.com/XSGGH/bedolaga-cabinet.git xsg-theme
target=$(g rev-parse FETCH_HEAD)
g merge-base --is-ancestor HEAD "$target"
g restore --source=HEAD --staged --worktree -- nginx.conf
if ! g merge --ff-only "$target"; then
    cp -p "$backup/nginx.conf" nginx.conf
    echo 'Git не обновлён. Работающий контейнер сохранён.'; exit 1
fi
cp -p "$backup/nginx.conf" nginx.conf
printf '%s\n' "$target" > "$backup/target"
# The additive event API must already be deployed. This script never replaces it.
status=$(curl -sS --connect-timeout 2 --max-time 5 -o "$backup/api-check.json" -w '%{http_code}' http://127.0.0.1:8080/cabinet/snow-event)
if test "$status" != 401 && test "$status" != 403; then
    echo "API события не подтвердил маршрут (HTTP $status). Frontend не заменён. Сначала завершите установку API события."; exit 1
fi
docker compose build cabinet-frontend </dev/null
docker compose run --rm --no-deps --interactive=false -T --pull never cabinet-frontend nginx -t </dev/null
bash scripts/xsg-probe-frontend.sh </dev/null

recover() {
    local code=$?
    trap - ERR
    docker compose logs --no-color --tail 80 cabinet-frontend > "$backup/failure.log" 2>&1 || true
    echo "Проверка нового кабинета не прошла. Возвращаем образ из $backup"
    rollback "$backup" || echo "Проверьте откат: sudo bash '$backup/deploy-script.sh' --rollback '$backup'"
    exit "$code"
}
trap recover ERR
docker compose up -d --force-recreate --no-deps --no-build --pull never cabinet-frontend </dev/null
curl -fsS --retry 30 --retry-all-errors --retry-delay 2 --retry-max-time 90 --connect-timeout 2 --max-time 5 \
    -H 'Host: xsgvpn.ru' http://127.0.0.1:3020/snow-event > "$backup/served-page.html"
container=$(docker compose ps -q cabinet-frontend)
python3 scripts/xsg-verify-deployment.py --container "$container" --site https://xsgvpn.ru | tee "$backup/served-assets.json"
trap - ERR
printf '%s\n' "$backup" > /root/bedolaga-cabinet-backups/last-backup
echo "Деплой завершён: $target"
echo 'Проверить: https://xsgvpn.ru/admin/snow-event'
echo "Откат: sudo bash '$backup/deploy-script.sh' --rollback '$backup'"
