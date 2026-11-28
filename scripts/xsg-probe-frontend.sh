#!/usr/bin/env bash
# Probe the actual image with nginx before replacing any production container.
set -euo pipefail
container=''
cleanup() {
    if test -n "$container"; then docker rm -f "$container" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT
container=$(docker compose run -d --no-deps --interactive=false -T --pull never cabinet-frontend </dev/null)
if ! docker exec "$container" sh -c '
    attempt=0
    until wget -q --header="Host: xsgvpn.ru" -O /tmp/xsg-page-check.html http://127.0.0.1/snow-event &&
          cmp -s /tmp/xsg-page-check.html /usr/share/nginx/html/index.html; do
        attempt=$((attempt + 1))
        test "$attempt" -lt 20 || exit 1
        sleep 1
    done
    test ! -d /usr/share/nginx/html/snow-event || exit 1
    for art in winter-hero.webp snow-gift-atlas.png; do
        test -s "/usr/share/nginx/html/xsg-snow-assets/$art" || {
            echo "В новом образе отсутствует обязательная картинка: $art" >&2
            exit 1
        }
        wget -q --header="Host: xsgvpn.ru" -O /tmp/xsg-art-check.webp "http://127.0.0.1/xsg-snow-assets/$art" &&
        cmp -s /tmp/xsg-art-check.webp "/usr/share/nginx/html/xsg-snow-assets/$art" || exit 1
    done
'; then
    docker logs --tail 40 "$container" >&2 || true
    echo 'Новый образ не прошёл HTTP-проверку страницы или картинки. Работающие контейнеры не заменены.' >&2
    exit 1
fi
echo 'Новый образ проверен: /snow-event отдаёт страницу кабинета, актуальные картинки анонса и подарков доступны nginx.'
