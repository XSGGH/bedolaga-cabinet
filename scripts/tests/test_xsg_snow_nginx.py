"""Reproduce the SPA/public-directory collision with a real nginx executable."""
import os
import http.client
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request


class SnowAssetLayoutTests(unittest.TestCase):
    def test_public_assets_do_not_shadow_the_event_page(self):
        repo = Path(__file__).resolve().parents[2]
        self.assertFalse((repo / 'public/snow-event').exists())
        for name in ('winter-hero.webp', 'winter-base.webp'):
            self.assertTrue((repo / 'public/xsg-snow-assets' / name).is_file())


@unittest.skipUnless(os.environ.get('NGINX_BINARY'), 'Set NGINX_BINARY to run real nginx integration tests')
class NginxSnowRoutingTests(unittest.TestCase):
    def serve(self, collision=False, production=False):
        directory = tempfile.TemporaryDirectory(prefix='xsg-nginx-')
        prefix = Path(directory.name).resolve()
        self.assertTrue(prefix.is_relative_to(Path(tempfile.gettempdir()).resolve()))
        self.addCleanup(directory.cleanup)
        (prefix / 'logs').mkdir()
        (prefix / 'temp').mkdir()
        if production:
            root = Path(__file__).resolve().parents[2] / 'dist'
            if not (root / 'index.html').is_file():
                self.skipTest('Build the frontend before testing its production output')
        else:
            root = prefix / 'html'
            root.mkdir()
            (root / 'index.html').write_text('XSG SPA fallback', encoding='utf-8')
            asset_directory = root / ('snow-event' if collision else 'xsg-snow-assets')
            asset_directory.mkdir()
            (asset_directory / 'winter-hero.webp').write_bytes(b'picture')
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        config = prefix / 'nginx.conf'
        config.write_text('daemon off;\nmaster_process off;\npid logs/nginx.pid;\n'
                          'error_log logs/error.log info;\nevents {}\nhttp { access_log off; server {\n'
                          f'listen 127.0.0.1:{port};\nroot "{root.as_posix()}";\nindex index.html;\n'
                          'location / { try_files $uri $uri/ /index.html; }\n} }\n', encoding='utf-8')
        arguments = [os.environ['NGINX_BINARY'], '-p', prefix.as_posix() + '/', '-c', config.as_posix()]
        flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        output = open(prefix / 'process.log', 'wb')
        self.addCleanup(output.close)
        process = subprocess.Popen(arguments, stdout=output, stderr=output, creationflags=flags)
        def stop():
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
        self.addCleanup(stop)
        for _ in range(60):
            if process.poll() is not None:
                self.fail((prefix / 'process.log').read_text(errors='replace'))
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=.3) as response:
                    if response.status == 200:
                        return f'http://127.0.0.1:{port}', prefix
            except (OSError, urllib.error.URLError):
                time.sleep(.05)
        self.fail('nginx did not start')

    def test_original_asset_directory_returns_403(self):
        base, prefix = self.serve(collision=True)
        connection = http.client.HTTPConnection(base.removeprefix('http://'), timeout=2)
        connection.request('GET', '/snow-event')
        response = connection.getresponse()
        self.assertEqual(response.status, 301)
        response.read()
        connection.close()
        with self.assertRaises(urllib.error.HTTPError) as error:
            urllib.request.urlopen(base + '/snow-event', timeout=2)
        self.assertEqual(error.exception.code, 403)
        error.exception.close()
        log = (prefix / 'logs/error.log').read_text(errors='replace')
        self.assertIn('directory index of', log)
        self.assertIn('is forbidden', log)

    def test_separate_assets_allow_page_and_pictures(self):
        base, _ = self.serve(collision=False)
        for route in ('/snow-event', '/snow-event/', '/admin/snow-event'):
            with urllib.request.urlopen(base + route, timeout=2) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.geturl(), base + route)
                self.assertEqual(response.read(), b'XSG SPA fallback')
        with urllib.request.urlopen(base + '/xsg-snow-assets/winter-hero.webp', timeout=2) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), b'picture')

    def test_production_build_page_and_artwork(self):
        base, _ = self.serve(production=True)
        dist = Path(__file__).resolve().parents[2] / 'dist'
        for route, file in [('/snow-event', 'index.html'),
                ('/admin/snow-event', 'index.html'),
                ('/xsg-snow-assets/winter-hero.webp', 'xsg-snow-assets/winter-hero.webp'),
                ('/xsg-snow-assets/winter-base.webp', 'xsg-snow-assets/winter-base.webp')]:
            with urllib.request.urlopen(base + route, timeout=2) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.geturl(), base + route)
                self.assertEqual(response.read(), (dist / file).read_bytes())
        self.assertFalse((dist / 'snow-event').exists())


if __name__ == '__main__':
    unittest.main()
