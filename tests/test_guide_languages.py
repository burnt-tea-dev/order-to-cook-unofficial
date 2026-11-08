#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Execute language regeneration and compare values, independent of key order."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ("en_US", "zh_CN", "zh_TW")
BAGGING_KEYS = tuple(f"otc.guide.page.bagging.{part}"
                     for part in ("title", "step1", "step2", "step3"))
spec = importlib.util.spec_from_file_location("guide_converter", ROOT / "tools/convert_assets.py")
converter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(converter)


def translations(path):
    result = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key in result:
            raise AssertionError(f"Duplicate translation in {path.name}: {key}")
        result[key] = value
    return result


class GuideLanguageGenerationTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.output = Path(temporary.name)
        # Use the actual shipped block/item definitions for the generated labels;
        # only redirect output and provenance state, never the merge algorithm.
        for folder in ("blocks", "items"):
            shutil.copytree(ROOT / "runtime/BP" / folder, self.output / "BP" / folder)
        source = ROOT / "upstream/reference"
        context = patch.multiple(converter, create=True, SOURCE=source,
                                 ASSETS=source / converter.ASSET_REL, OUT=self.output,
                                 BP=self.output / "BP", RP=self.output / "RP", PROVENANCE=[])
        context.start()
        self.addCleanup(context.stop)
        self.shipped = {language: translations(ROOT / f"runtime/RP/texts/{language}.lang")
                        for language in LANGUAGES}

    def generated_path(self, language):
        return self.output / f"RP/texts/{language}.lang"

    def test_fresh_regeneration_preserves_every_shipped_translation(self):
        # No destination exists: exercise the real shipped-language fallback.
        converter.make_languages()
        for language in LANGUAGES:
            with self.subTest(language=language):
                actual = translations(self.generated_path(language))
                # Report each of the formerly regressed keys independently.
                for key in BAGGING_KEYS:
                    with self.subTest(key=key):
                        self.assertEqual(actual[key], self.shipped[language][key])
                self.assertEqual(actual, self.shipped[language])
        self.assertEqual(json.loads((self.output / "RP/texts/languages.json").read_text()),
                         list(LANGUAGES))

    def test_existing_output_keeps_new_messages_but_refreshes_guide_and_labels(self):
        converter.make_languages()
        expected = {}
        for language in LANGUAGES:
            path = self.generated_path(language)
            # Simulate a newer runtime-only message already added by another
            # feature, plus old generated/guide values that must not win.
            extra_key = "otc.test.runtime_only"
            extra_value = f"{language}: keep this newer message = including equals"
            self.assertNotIn(extra_key, self.shipped[language])
            expected[language] = {**self.shipped[language], extra_key: extra_value}
            stale = {**expected[language], "pack.name": "stale generated label",
                     **{key: "stale delivery-only guide" for key in BAGGING_KEYS}}
            path.write_text("\n".join(f"{key}={value}" for key, value in stale.items()) + "\n",
                            encoding="utf-8")
        converter.make_languages()
        key_order = {}
        for language in LANGUAGES:
            with self.subTest(language=language):
                actual = translations(self.generated_path(language))
                self.assertEqual(actual, expected[language])
                key_order[language] = list(actual)
        # Repeated regeneration must not accumulate, remove or reorder keys.
        converter.make_languages()
        for language in LANGUAGES:
            with self.subTest(language=language, pass_number=3):
                actual = translations(self.generated_path(language))
                self.assertEqual(actual, expected[language])
                self.assertEqual(list(actual), key_order[language])

    def test_guide_source_provenance_matches_current_bytes(self):
        manifest = json.loads((ROOT / "runtime/asset_conversion_manifest.json").read_text())
        recorded = {entry["source"]: entry["sha256"] for entry in manifest["port_assets"]}
        for language in LANGUAGES:
            source = f"assets/guidebook/{language}.lang"
            with self.subTest(language=language):
                self.assertEqual(recorded[source], hashlib.sha256((ROOT / source).read_bytes()).hexdigest())


if __name__ == "__main__":
    unittest.main()
