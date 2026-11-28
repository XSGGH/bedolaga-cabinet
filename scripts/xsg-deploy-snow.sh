#!/usr/bin/env bash
# Production deployment of cabinet + additive event API, with image rollback.
set -euo pipefail
umask 077

bot=${XSG_BOT_DIR:-/home/user1/remnawave-bedolaga-telegram-bot}
cabinet=${XSG_CABINET_DIR:-/home/user1/bedolaga-cabinet}
cabinet_ref=${XSG_CABINET_REF:-docs/snowstorm-redesign-plan}
cabinet_commit=${XSG_CABINET_COMMIT:-}
bot_ref=be1250b8fb0175d49b8d26efe4a95079b2a5edc9
backup_root=/root/xsg-snow-backups

restore_bot_source() {
    while IFS= read -r relative; do
        if test -f "$backup/bot-code/$relative"; then
            cp -p "$backup/bot-code/$relative" "$bot/$relative" || return 1
        else
            # Only fixed event-owned paths from our validated manifest.
            case "$relative" in
                app/database/snow_event_models.py|app/services/snow_planets.py|app/services/snow_mosaics.py|app/services/snow_mosaic_context.py|resources/snow-mosaics/niveya/*.webp|resources/snow-mosaics/solaria/*.webp|resources/snow-mosaics/orida/*.webp|resources/snow-mosaics/marena/*.webp|resources/snow-mosaics/lioris/*.webp|resources/snow-mosaics/efiria/*.webp|resources/snow-mosaics/domira/*.webp|app/services/snow_event.py|app/services/snow_event_rewards.py|app/services/snow_world.py|app/services/snow_world_actions.py|app/services/snow_games.py|app/services/snow_quazar.py|app/cabinet/routes/snow_event.py|scripts/xsg-snow-schema.py)
                    rm -f -- "$bot/$relative" || return 1 ;;
                *) echo "Refusing to remove unknown path: $relative"; return 1 ;;
            esac
        fi
    done < "$backup/manifest"
}

rollback() {
    test -d "$backup" && test -s "$backup/bot/image.tar.gz" && test -s "$backup/cabinet/image.tar.gz" || return 1
    bot=$(cat "$backup/bot-dir") || return 1
    cabinet=$(cat "$backup/cabinet-dir") || return 1
    for service in bot cabinet; do
        gzip -dc "$backup/$service/image.tar.gz" | docker load >/dev/null || return 1
    done
    if test -f "$backup/config-migrated" && test -f "$backup/event-config.json"; then
        db_container=$(cd "$bot" && docker compose ps -q postgres) || return 1
        test -n "$db_container" || return 1
        python3 - "$backup/event-config.json" <<'PYCONFIG' | docker exec -i "$db_container" sh -c 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null || return 1
import json,sys
rows=json.load(open(sys.argv[1]))
print('BEGIN; DELETE FROM snow_event_config WHERE id=1;')
for row in rows:
    data=json.dumps(row['data'],ensure_ascii=False).replace("'", "''")
    print("INSERT INTO snow_event_config(id,version,data) VALUES (1,%d,'%s');" % (int(row['version'])+1,data))
print('COMMIT;')
PYCONFIG
    fi
    cp -p "$backup/nginx.conf" "$cabinet/nginx.conf" || return 1
    restore_bot_source || return 1
    docker compose -p "$(cat "$backup/bot/project")" -f "$backup/bot/compose.yml" -f "$backup/bot/rollback.json" \
        up -d --force-recreate --no-deps --no-build --pull never bot </dev/null || return 1
    docker compose -p "$(cat "$backup/cabinet/project")" -f "$backup/cabinet/compose.yml" -f "$backup/cabinet/rollback.json" \
        up -d --force-recreate --no-deps --no-build --pull never cabinet-frontend </dev/null || return 1
    echo "Откат образов и добавленных файлов выполнен. Прогресс БД сохранён; восстановлена только конфигурация мероприятия: $backup"
}

if test "${1:-}" = --rollback; then
    backup=${2:?Укажите каталог резервной копии}
    rollback
    exit 0
fi
test "$(id -u)" = 0 || { echo 'Запустите через sudo bash.'; exit 1; }
command -v python3 >/dev/null
command -v docker >/dev/null
test -d "$bot/.git" && test -d "$cabinet/.git"
g() { local directory=$1; shift; git -c safe.directory="$directory" -C "$directory" "$@"; }
test -z "$(g "$bot" ls-files -u)$(g "$cabinet" ls-files -u)" || { echo 'Есть неразрешённый конфликт Git. Работающие контейнеры не изменены.'; exit 1; }
test "$(g "$cabinet" branch --show-current)" = xsg-theme
if test -n "$(g "$cabinet" diff --name-only HEAD -- . ':(exclude)nginx.conf')"; then
    echo 'В кабинете есть изменения кроме nginx.conf. Сохраните их перед деплоем; контейнеры не изменены.'
    exit 1
fi

stamp=$(date +%Y%m%d-%H%M%S)
backup="$backup_root/$stamp"
mkdir -p "$backup/bot" "$backup/cabinet" "$backup/payload" "$backup/stage/bot"
printf '%s\n' "$bot" > "$backup/bot-dir"
printf '%s\n' "$cabinet" > "$backup/cabinet-dir"
cp "$0" "$backup/deploy-script.sh"
cp -p "$cabinet/nginx.conf" "$backup/nginx.conf"

save_service() {
    local directory=$1 service=$2 name=$3
    local container image tag project
    container=$(cd "$directory" && docker compose ps -q "$service")
    test -n "$container" || { echo "Не найден контейнер $service"; exit 1; }
    if docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' "$container" | \
        grep -Eq '^(/app|/app/app(/.*)?|/usr/share/nginx/html(/.*)?)$'; then
        echo "У $service примонтирован код приложения. Нужна адаптация деплоя; контейнер не заменён."
        exit 1
    fi
    project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container")
    test -n "$project"
    printf '%s\n' "$project" > "$backup/$name/project"
    (cd "$directory" && docker compose config) > "$backup/$name/compose.yml"
    docker inspect "$container" > "$backup/$name/container.json"
    image=$(docker inspect --format '{{.Image}}' "$container")
    tag="xsg-snow-backup-$name:$stamp"
    if docker image inspect "$image" >/dev/null 2>&1; then docker tag "$image" "$tag";
    else docker commit "$container" "$tag" >/dev/null; fi
    docker save "$tag" | gzip > "$backup/$name/image.tar.gz"
    gzip -t "$backup/$name/image.tar.gz"
    python3 - "$backup/$name/rollback.json" "$service" "$tag" <<'PY'
import json,sys
with open(sys.argv[1], 'w') as f: json.dump({'services': {sys.argv[2]: {'image': sys.argv[3]}}}, f)
PY
    g "$directory" rev-parse HEAD > "$backup/$name/commit"
    g "$directory" diff --binary HEAD > "$backup/$name/local-changes.patch"
    tar --exclude='./.git' --exclude='./node_modules' --exclude='./dist' --exclude='./logs' --exclude='./uploads' \
        -czf "$backup/$name/project.tar.gz" -C "$directory" .
}
save_service "$bot" bot bot
save_service "$cabinet" cabinet-frontend cabinet
db_container=$(cd "$bot" && docker compose ps -q postgres)
test -n "$db_container" || { echo 'PostgreSQL не найден. Бэкапы образов созданы; контейнеры не изменены.'; exit 1; }
docker exec "$db_container" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup/database.dump"
test -s "$backup/database.dump"
docker exec -i "$db_container" pg_restore --list < "$backup/database.dump" > "$backup/database-list.txt"
has_config=$(docker exec -i "$db_container" sh -c 'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQLCONFIG'
SELECT to_regclass('public.snow_event_config');
SQLCONFIG
)
if test "$has_config" = snow_event_config; then
    docker exec -i "$db_container" sh -c 'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup/event-config.json" <<'SQLCONFIG'
SELECT coalesce(json_agg(t),'[]'::json) FROM snow_event_config t;
SQLCONFIG
else
    printf '[]\n' > "$backup/event-config.json"
fi
python3 -c 'import json,sys; assert isinstance(json.load(open(sys.argv[1])),list)' "$backup/event-config.json"
echo "Резервная копия образов, исходников и БД готова: $backup"

# Fetch only the additive feature payload. Never replace the customised bot
# branch with the development branch or apply unrelated bot migrations.
g "$bot" fetch https://github.com/XSGGH/remnawave-bedolaga-telegram-bot.git xsg-snow-2026
g "$bot" cat-file -e "$bot_ref^{commit}"
printf '%s\n' "$bot_ref" > "$backup/bot-target"
for relative in app/database/snow_event_models.py app/services/snow_event.py app/services/snow_event_rewards.py \
    app/services/snow_world.py app/services/snow_world_actions.py app/services/snow_games.py app/services/snow_quazar.py \
    app/services/snow_mosaics.py app/services/snow_planets.py app/services/snow_mosaic_context.py \
    app/cabinet/routes/snow_event.py scripts/xsg-snow-overlay.py scripts/xsg-snow-schema.py scripts/xsg-snow-integration.json; do
    mkdir -p "$backup/payload/$(dirname "$relative")"
    g "$bot" show "$bot_ref:$relative" > "$backup/payload/$relative"
done
for story in niveya solaria orida marena lioris efiria domira; do
    count=36; test "$story" != domira || count=48
    for ((tile=0;tile<count;tile++)); do
        relative="resources/snow-mosaics/$story/$tile.webp"
        mkdir -p "$backup/payload/$(dirname "$relative")"
        g "$bot" show "$bot_ref:$relative" > "$backup/payload/$relative"
    done
done
tar --exclude='./.git' --exclude='./logs' --exclude='./uploads' --exclude='./__pycache__' \
    -cf - -C "$bot" . | tar -xf - -C "$backup/stage/bot"
python3 "$backup/payload/scripts/xsg-snow-overlay.py" "$backup/payload" "$backup/stage/bot" > "$backup/manifest"
while IFS= read -r relative; do
    mkdir -p "$backup/bot-code/$(dirname "$relative")"
    if test -f "$bot/$relative"; then cp -p "$bot/$relative" "$backup/bot-code/$relative"; fi
done < "$backup/manifest"
python3 - "$backup/bot/build.json" "$backup/stage/bot" "xsg-snow-api:$stamp" <<'PY'
import json,sys
with open(sys.argv[1], 'w') as f: json.dump({'services': {'bot': {'image': sys.argv[3], 'build': {'context': sys.argv[2]}}}}, f)
PY
bot_compose=(docker compose -p "$(cat "$backup/bot/project")" -f "$backup/bot/compose.yml" -f "$backup/bot/build.json")
"${bot_compose[@]}" build bot </dev/null
"${bot_compose[@]}" run --rm --no-deps --interactive=false -T -e PYTHONPATH=/app --entrypoint python bot \
    scripts/xsg-snow-schema.py --check-only </dev/null

g "$cabinet" fetch https://github.com/XSGGH/bedolaga-cabinet.git "$cabinet_ref"
target=$(g "$cabinet" rev-parse FETCH_HEAD)
if test -n "$cabinet_commit"; then
    g "$cabinet" merge-base --is-ancestor "$cabinet_commit" "$target"
    target=$(g "$cabinet" rev-parse "$cabinet_commit^{commit}")
fi
g "$cabinet" merge-base --is-ancestor HEAD "$target"
g "$cabinet" cat-file -e "$target:src/pages/SnowEvent.tsx"
g "$cabinet" show "$target:scripts/xsg-expand-status-routes.py" > "$backup/prepare-nginx.py"
python3 "$backup/prepare-nginx.py" "$backup/nginx.conf" "$backup/nginx.resolved.conf"
chmod --reference="$backup/nginx.conf" "$backup/nginx.resolved.conf"
chown --reference="$backup/nginx.conf" "$backup/nginx.resolved.conf"
g "$cabinet" restore --source=HEAD --staged --worktree -- nginx.conf
if ! g "$cabinet" merge --ff-only "$target"; then
    cp -p "$backup/nginx.conf" "$cabinet/nginx.conf"
    echo 'Обновление кабинета остановлено. Контейнеры не заменены.'; exit 1
fi
cp -p "$backup/nginx.resolved.conf" "$cabinet/nginx.conf"
if test -d "$cabinet/public/snow-event"; then
    rmdir "$cabinet/public/snow-event" || { echo 'В public/snow-event остались посторонние файлы. Они сохранены; деплой остановлен.'; exit 1; }
fi
(cd "$cabinet" && docker compose build cabinet-frontend </dev/null)
(cd "$cabinet" && docker compose run --rm --no-deps --interactive=false -T cabinet-frontend nginx -t </dev/null)
(cd "$cabinet" && bash scripts/xsg-probe-frontend.sh </dev/null)

# Compatibility and both builds passed. Only now add the isolated tables and swap.

source_installed=0
recover() {
    local code=$?
    trap - ERR
    if test "$source_installed" = 1; then
        (cd "$bot" && docker compose logs --no-color --tail 100 bot) > "$backup/bot/failure.log" 2>&1 || true
        (cd "$cabinet" && docker compose logs --no-color --tail 100 cabinet-frontend) > "$backup/cabinet/failure.log" 2>&1 || true
        echo "Деплой не прошёл проверку. Возвращаем сохранённые образы: $backup"
        rollback || echo "Автооткат требует проверки. Команда: bash '$backup/deploy-script.sh' --rollback '$backup'"
    fi
    exit "$code"
}
while IFS= read -r relative; do
    if test -f "$backup/bot-code/$relative"; then
        cmp -s "$bot/$relative" "$backup/bot-code/$relative" || { echo "Файл изменился во время сборки: $relative"; false; }
    else
        test ! -e "$bot/$relative"
    fi
done < "$backup/manifest"
trap recover ERR
source_installed=1
touch "$backup/config-migrated"
"${bot_compose[@]}" run --rm --no-deps --interactive=false -T -e PYTHONPATH=/app --entrypoint python bot \
    scripts/xsg-snow-schema.py </dev/null
while IFS= read -r relative; do
    mkdir -p "$bot/$(dirname "$relative")"
    cp "$backup/stage/bot/$relative" "$bot/$relative"
    chown --reference="$bot/app/database/models.py" "$bot/$relative"
done < "$backup/manifest"
"${bot_compose[@]}" up -d --force-recreate --no-deps --no-build --pull never bot </dev/null
curl -fsS --retry 20 --retry-all-errors --retry-delay 3 --max-time 4 http://127.0.0.1:8080/health >/dev/null
status=$(curl -sS --retry 20 --retry-all-errors --retry-delay 2 --retry-max-time 90 --connect-timeout 2 --max-time 5 \
    -o "$backup/api-auth-check.json" -w '%{http_code}' http://127.0.0.1:8080/cabinet/snow-event)
test "$status" = 401 || test "$status" = 403
curl -fsS --retry 10 --retry-all-errors --retry-delay 2 --max-time 5 http://127.0.0.1:8080/cabinet/snow-event/version > "$backup/api-version.json"
python3 -c 'import json,sys; assert json.load(open(sys.argv[1]))["version"]==5' "$backup/api-version.json"
(cd "$cabinet" && docker compose up -d --force-recreate --no-deps --no-build --pull never cabinet-frontend </dev/null)
echo 'Ожидаем готовность кабинета: временный сброс соединения при запуске nginx допустим.'
curl -fsS --retry 30 --retry-all-errors --retry-delay 2 --retry-max-time 90 --connect-timeout 2 --max-time 5 \
    -H "Host: xsgvpn.ru" http://127.0.0.1:3020/snow-event >/dev/null
curl -fsS --retry 10 --retry-all-errors --retry-delay 2 --retry-max-time 45 --connect-timeout 2 --max-time 5 \
    -H "Host: xsgvpn.ru" http://127.0.0.1:3020/xsg-snow-assets/winter-hero.webp >/dev/null
container=$(cd "$cabinet" && docker compose ps -q cabinet-frontend)
(cd "$cabinet" && python3 scripts/xsg-verify-deployment.py --container "$container" --site https://xsgvpn.ru) | tee "$backup/served-assets.json"
trap - ERR
printf '%s\n' "$backup" > "$backup_root/last-backup"
printf '%s\n' "$target" > "$backup/cabinet-target"
echo "Готово. Предпросмотр: https://xsgvpn.ru/admin/snow-event"
echo "Бэкап: $backup"
echo "Откат: sudo bash '$backup/deploy-script.sh' --rollback '$backup'"
