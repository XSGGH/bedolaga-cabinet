#!/bin/sh
set -eu

# envsubst writes this value into nginx syntax. Reject invalid keys without logging them.
case "${XSG_UPTIME_API_KEY:-}" in
    *[!a-zA-Z0-9_-]*)
        echo >&2 'XSG_UPTIME_API_KEY contains invalid characters. Use the key without quotes or trailing slashes.'
        exit 1
        ;;
esac
