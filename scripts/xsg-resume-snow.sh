#!/usr/bin/env bash
# Resume a rolled-back winter release using its already-built images and backup.
set -Eeuo pipefail
umask 077
test "$(id -u)" = 0 || { echo 'Запустите через sudo bash.'; exit 1; }
backup=${1:?Укажите каталог резервной копии неудачного деплоя}
test -f "$backup/manifest" && test -f "$backup/bot/build.json" && test -f "$backup/deploy-script.sh"
bot=$(cat "$backup/bot-dir")
cabinet=$(cat "$backup/cabinet-dir")
g() { git -c safe.directory="$cabinet" -C "$cabinet" "$@"; }
test -z "$(g ls-files -u)" && test "$(g branch --show-current)" = xsg-theme
test -z "$(g diff --name-only HEAD -- . ':(exclude)nginx.conf')" || {
    echo 'Есть новые изменения исходников кабинета. Продолжение остановлено.'; exit 1;
}

# A resume is only valid while the containers still run the saved rollback
# images. Never silently reuse an old backup after another deployment.
for name in bot cabinet; do
    if test "$name" = bot; then directory=$bot; service=bot; else directory=$cabinet; service=cabinet-frontend; fi
    container=$(cd "$directory" && docker compose ps -q "$service")
    test -n "$container"
    image=$(python3 - "$backup/$name/rollback.json" "$service" <<'PY'
import json,sys
with open(sys.argv[1]) as f: print(json.load(f)['services'][sys.argv[2]]['image'])
PY
    )
    expected=$(docker image inspect --format '{{.Id}}' "$image")
    actual=$(docker inspect --format '{{.Image}}' "$container")
    test "$actual" = "$expected" || {
        echo "Контейнер $service изменился после отката. Нужен обычный деплой с новым бэкапом."; exit 1;
    }
done
while IFS= read -r relative; do
    test -f "$backup/stage/bot/$relative"
    if test -f "$backup/bot-code/$relative"; then
        cmp -s "$bot/$relative" "$backup/bot-code/$relative" || { echo "Исходник изменился после отката: $relative"; exit 1; }
    else
        test ! -e "$bot/$relative" || { echo "Появился новый файл: $relative"; exit 1; }
    fi
done < "$backup/manifest"

bot_compose=(docker compose -p "$(cat "$backup/bot/project")" -f "$backup/bot/compose.yml" -f "$backup/bot/build.json")
"${bot_compose[@]}" run --rm --no-deps --interactive=false -T -e PYTHONPATH=/app --entrypoint python bot \
    scripts/xsg-snow-schema.py --check-only </dev/null
(cd "$cabinet" && docker compose run --rm --no-deps --interactive=false -T cabinet-frontend nginx -t </dev/null)

# Refresh the database backup without overwriting the original snapshot.
stamp=$(date +%Y%m%d-%H%M%S)
db_container=$(cd "$bot" && docker compose ps -q postgres)
test -n "$db_container"
docker exec "$db_container" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup/database-resume-$stamp.dump"
test -s "$backup/database-resume-$stamp.dump"
docker exec -i "$db_container" pg_restore --list < "$backup/database-resume-$stamp.dump" > "$backup/database-resume-$stamp.list"
"${bot_compose[@]}" run --rm --no-deps --interactive=false -T -e PYTHONPATH=/app --entrypoint python bot \
    scripts/xsg-snow-schema.py </dev/null

recover() {
    local code=$?
    trap - ERR
    (cd "$bot" && docker compose logs --no-color --tail 100 bot) > "$backup/bot/failure-resume-$stamp.log" 2>&1 || true
    (cd "$cabinet" && docker compose logs --no-color --tail 100 cabinet-frontend) > "$backup/cabinet/failure-resume-$stamp.log" 2>&1 || true
    echo "Проверка продолжения не прошла. Возвращаем образы из $backup"
    bash "$backup/deploy-script.sh" --rollback "$backup" || echo "Проверьте откат: $backup"
    exit "$code"
}
trap recover ERR
while IFS= read -r relative; do
    mkdir -p "$bot/$(dirname "$relative")"
    cp "$backup/stage/bot/$relative" "$bot/$relative"
    chown --reference="$bot/app/database/models.py" "$bot/$relative"
done < "$backup/manifest"
"${bot_compose[@]}" up -d --force-recreate --no-deps --no-build --pull never bot </dev/null
echo 'Ожидаем готовность API…'
curl -fsS --retry 30 --retry-all-errors --retry-delay 2 --retry-max-time 90 --connect-timeout 2 --max-time 5 \
    http://127.0.0.1:8080/health >/dev/null
status=$(curl -sS --retry 20 --retry-all-errors --retry-delay 2 --retry-max-time 90 --connect-timeout 2 --max-time 5 \
    -o "$backup/api-auth-check.json" -w '%{http_code}' http://127.0.0.1:8080/cabinet/snow-event)
test "$status" = 401 || test "$status" = 403
(cd "$cabinet" && docker compose up -d --force-recreate --no-deps --no-build --pull never cabinet-frontend </dev/null)
echo 'Ожидаем готовность кабинета…'
curl -fsS --retry 30 --retry-all-errors --retry-delay 2 --retry-max-time 90 --connect-timeout 2 --max-time 5 \
    http://127.0.0.1:3020/snow-event >/dev/null
curl -fsS --retry 10 --retry-all-errors --retry-delay 2 --retry-max-time 45 --connect-timeout 2 --max-time 5 \
    http://127.0.0.1:3020/snow-event/winter-hero.webp >/dev/null
container=$(cd "$cabinet" && docker compose ps -q cabinet-frontend)
(cd "$cabinet" && python3 scripts/xsg-verify-deployment.py --container "$container" --site https://xsgvpn.ru) | tee "$backup/served-assets.json"
trap - ERR
printf '%s\n' "$backup" > "$(dirname "$backup")/last-backup"
g rev-parse HEAD > "$backup/cabinet-target"
printf '%s\n' "$stamp" > "$backup/resumed-at"
echo 'Готово. Предпросмотр: https://xsgvpn.ru/admin/snow-event'
echo "Откат: sudo bash '$backup/deploy-script.sh' --rollback '$backup'"
