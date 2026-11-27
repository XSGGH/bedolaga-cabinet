"""Exercise the actual deploy probe against TCP resets and persistent failure."""
import os
from pathlib import Path
import shlex
import shutil
import socket
import socketserver
import struct
import subprocess
import threading
import unittest


class StartupServer(socketserver.TCPServer):
    allow_reuse_address = True

    def __init__(self, reset_count=0, status=200):
        self.requests = 0
        self.reset_count = reset_count
        self.status = status
        super().__init__(('127.0.0.1', 0), StartupHandler)


class StartupHandler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.recv(4096)
        self.server.requests += 1
        if self.server.requests <= self.server.reset_count:
            # Close with RST, reproducing nginx's short startup window.
            layout = 'hh' if os.name == 'nt' else 'ii'
            self.request.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack(layout, 1, 0))
            self.request.close()
            return
        status = self.server.status
        reason = 'OK' if status == 200 else 'Service Unavailable'
        self.request.sendall(f'HTTP/1.1 {status} {reason}\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK'.encode())


def probe_arguments(script, port):
    source = script.read_text(encoding='utf-8').replace('\\\n', ' ')
    line = next(line.strip() for line in source.splitlines()
                if line.strip().startswith('curl ') and 'http://127.0.0.1:3020/snow-event >' in line)
    args = shlex.split(line)
    # Strip shell output redirection before executing curl directly.
    if '>' in args:
        args = args[:args.index('>')]
    args = [arg for arg in args if arg != '>/dev/null']
    args[0] = shutil.which('curl.exe') or shutil.which('curl')
    if not args[0]:
        raise unittest.SkipTest('curl is not installed')
    args[-1] = f'http://127.0.0.1:{port}/snow-event'
    # Preserve production retry/error policy, shorten only the test timings.
    for flag, value in [('--retry', '3'), ('--retry-delay', '1'),
                        ('--retry-max-time', '3'), ('--connect-timeout', '1'), ('--max-time', '1')]:
        args[args.index(flag) + 1] = value
    return args + ['-o', os.devnull]


class DeploymentReadinessTests(unittest.TestCase):
    def run_probe(self, script_name, reset_count=0, status=200, original_policy=False):
        script = Path(__file__).resolve().parents[1] / script_name
        with StartupServer(reset_count, status) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                arguments = probe_arguments(script, server.server_address[1])
                if original_policy:
                    arguments.remove('--retry-all-errors')
                    arguments.append('--retry-connrefused')
                result = subprocess.run(arguments,
                                        capture_output=True, text=True, timeout=12)
                return result, server.requests
            finally:
                server.shutdown()
                thread.join()

    def test_full_deploy_waits_through_connection_resets(self):
        result, requests = self.run_probe('xsg-deploy-snow.sh', reset_count=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(requests, 3)

    def test_resume_waits_through_connection_resets(self):
        result, requests = self.run_probe('xsg-resume-snow.sh', reset_count=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(requests, 3)

    def test_frontend_only_waits_through_connection_resets(self):
        result, requests = self.run_probe('xsg-deploy-cabinet.sh', reset_count=2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(requests, 3)

    def test_frontend_only_rejects_persistent_http_error(self):
        result, requests = self.run_probe('xsg-deploy-cabinet.sh', status=503)
        self.assertNotEqual(result.returncode, 0)
        self.assertGreater(requests, 1)

    def test_original_policy_fails_on_first_reset(self):
        result, requests = self.run_probe('xsg-deploy-snow.sh', reset_count=2, original_policy=True)
        self.assertEqual(result.returncode, 56, result.stderr)
        self.assertEqual(requests, 1)

    def test_permanent_error_is_not_accepted_as_ready(self):
        result, requests = self.run_probe('xsg-resume-snow.sh', status=503)
        self.assertNotEqual(result.returncode, 0)
        self.assertGreater(requests, 1)


if __name__ == '__main__':
    unittest.main()
