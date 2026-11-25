#!/usr/bin/env python3
"""Prepare a config from the server's working file; never replace its API settings."""
import re
import sys
from pathlib import Path


def expand_status_routes(source):
    # A server that already has the new regex needs only the prefix-priority fix.
    modern = r'(?m)^[ \t]*location\s+~\s+\^/status-api/\(\?<uptime_route>public\|summary\|events\)\$\s*\{'
    if re.search(modern, source):
        return re.sub(r'(?m)^(\s*location\s+)\^~(\s+/status-api/\s*\{)', r'\1\2', source)

    pattern = r'(?m)^[ \t]*location\s*=\s*/status-api/public\s*\{'
    matches = list(re.finditer(pattern, source))
    if len(matches) != 1:
        raise ValueError('Ожидался один точный маршрут /status-api/public; исходный файл не изменён.')
    match = matches[0]
    depth, quote, escaped, comment = 1, None, False, False
    end = None
    for i in range(match.end(), len(source)):
        char = source[i]
        if comment:
            comment = char != '\n'
        elif escaped:
            escaped = False
        elif char == '\\':
            escaped = True
        elif quote:
            if char == quote:
                quote = None
        elif char in ('"', "'"):
            quote = char
        elif char == '#':
            comment = True
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        raise ValueError('Не найден конец блока мониторинга; исходный файл не изменён.')
    block = source[match.start():end]
    upstream = list(re.finditer(r'(?m)^[ \t]*proxy_pass\s+([^;\s]+)\s*;', block))
    if len(upstream) != 1 or not upstream[0].group(1).endswith('/api/public'):
        raise ValueError('Не удалось безопасно определить upstream мониторинга; исходный файл не изменён.')
    additions = []
    for route in ('summary', 'events'):
        existing = re.findall(r'(?m)^[ \t]*location\s*=\s*/status-api/' + route + r'\s*\{', source)
        if len(existing) > 1:
            raise ValueError('В исходном файле дублируются маршруты мониторинга.')
        if existing:
            continue
        clone = block.replace('/status-api/public', '/status-api/' + route, 1)
        clone = re.sub(r'(?m)^([ \t]*proxy_pass\s+)([^;\s]+)(\s*;)',
                       lambda m: m.group(1) + m.group(2)[:-len('public')] + route + m.group(3), clone, count=1)
        cache_key = 'proxy_cache_key "uptime-' + route + '";'
        if re.search(r'(?m)^[ \t]*proxy_cache_key\s+', clone):
            clone = re.sub(r'(?m)^([ \t]*)proxy_cache_key\s+[^;]+;',
                           lambda m: m.group(1) + cache_key, clone)
        else:
            clone = clone[:clone.index('{') + 1] + '\n        ' + cache_key + clone[clone.index('{') + 1:]
        additions.append(clone)
    return source[:end] + ''.join('\n\n' + item for item in additions) + source[end:]


if __name__ == '__main__':
    if len(sys.argv) != 3 or Path(sys.argv[1]).resolve() == Path(sys.argv[2]).resolve():
        sys.exit('Использование: python3 xsg-expand-status-routes.py ИСХОДНЫЙ_ФАЙЛ НОВЫЙ_ФАЙЛ')
    try:
        result = expand_status_routes(Path(sys.argv[1]).read_text(encoding='utf-8'))
        Path(sys.argv[2]).write_text(result, encoding='utf-8')
    except (OSError, ValueError):
        sys.exit('Конфигурация не распознана. Исходный файл сохранён; автоматическое обновление остановлено.')
    print('Подготовлены маршруты public, summary и events. Остальные настройки сохранены.')
