#!/usr/bin/env python3
"""Verify the public site's entry assets against the files in the running frontend container."""
import argparse
import gzip
import hashlib
import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser


class FrontendAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and attrs.get("rel") == "stylesheet":
            path = urllib.parse.urlsplit(attrs.get("href", "")).path
            if re.fullmatch(r"/assets/[A-Za-z0-9_.-]+\.css", path):
                self.paths.add(path)
        if tag == "script" and attrs.get("type") == "module":
            path = urllib.parse.urlsplit(attrs.get("src", "")).path
            if re.fullmatch(r"/assets/[A-Za-z0-9_.-]+\.js", path):
                self.paths.add(path)


def asset_paths(html):
    parser = FrontendAssets()
    parser.feed(html.decode("utf-8"))
    if not parser.paths:
        raise RuntimeError("HTML does not reference frontend assets")
    return parser.paths


def fetch(url):
    request = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read()
        return gzip.decompress(body) if response.headers.get("Content-Encoding") == "gzip" else body


def verify(read_container, site):
    expected = asset_paths(read_container("/usr/share/nginx/html/index.html"))
    nonce = str(time.time_ns())
    public = asset_paths(fetch(site.rstrip("/") + "/?xsg_build_check=" + nonce))
    if public != expected:
        raise RuntimeError("Public HTML references a different build than the running container")
    checked = {}
    has_finance_layout = False
    for path in sorted(expected):
        local = read_container("/usr/share/nginx/html" + path)
        remote = fetch(urllib.parse.urljoin(site, path) + "?xsg_build_check=" + nonce)
        if local != remote:
            raise RuntimeError("Public asset differs from the running container: " + path)
        has_finance_layout |= b"xsg-referral-finance-overview" in remote
        checked[path] = hashlib.sha256(remote).hexdigest()
    if not has_finance_layout:
        raise RuntimeError("The served build does not contain the unified referral finance layout")
    return checked


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True)
    parser.add_argument("--site", default="https://xsgvpn.ru")
    args = parser.parse_args()
    if not args.site.startswith(("https://", "http://")):
        parser.error("--site must be an HTTP(S) URL")

    def read_container(path):
        return subprocess.check_output(["docker", "exec", args.container, "cat", path])

    print(json.dumps({"site": args.site, "assets": verify(read_container, args.site)}, indent=2))


if __name__ == "__main__":
    main()
