# SPDX-License-Identifier: GPL-3.0-only
import gzip
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('evidence_verify', Path(__file__).with_name('verify.py'))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class BoundedVerifier(unittest.TestCase):
    def test_exact_gzip(self):
        self.assertEqual(verify.bounded_gzip(gzip.compress(b'123'), 3), b'123')

    def test_truncated_payload(self):
        with self.assertRaises(ValueError):
            verify.bounded_gzip(gzip.compress(b'123')[:-1], 3)

    def test_overexpanded_payload(self):
        with self.assertRaises(ValueError):
            verify.bounded_gzip(gzip.compress(b'x' * 10000), 3)

    def test_appended_and_concatenated_payloads(self):
        for tail in [b'garbage', gzip.compress(b'123')]:
            with self.subTest(tail=tail):
                with self.assertRaises(ValueError):
                    verify.bounded_gzip(gzip.compress(b'123') + tail, 3)

    def test_declared_size_bound(self):
        for size in [0, -1, verify.MAX_SCENE + 1, '3']:
            with self.subTest(size=size):
                with self.assertRaises(ValueError):
                    verify.bounded_gzip(gzip.compress(b'123'), size)

    def test_relative_paths_and_symlink(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'real').write_text('value')
            (root / 'link').symlink_to(root / 'real')
            self.assertEqual(verify.checked_path(root, 'real'), root / 'real')
            for name in ['', '../real', '/etc/passwd', 'a\\real', './real', 'a//real', 'link', 'missing']:
                with self.subTest(name=name):
                    with self.assertRaises(ValueError):
                        verify.checked_path(root, name)


if __name__ == '__main__':
    unittest.main()
