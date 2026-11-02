import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('coastal_private_reading', ROOT/'bin/coastal_private_reading.py')
READING = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(READING)


class PrivateReadingMetadataTests(unittest.TestCase):
    def config(self):
        config = json.loads((ROOT/'assets/models/home/manifest.json').read_text(encoding='utf-8'))
        # Exercise the old-source upgrade even after the final native/manifest
        # checkpoint has installed this fixture into the canonical product.
        config['installationLines'] = [s for s in config['installationLines'] if s.get('id') != READING.ID]
        return config

    def test_a_delivered_fixture_matches_its_owning_recipe_when_present(self):
        config = json.loads((ROOT/'assets/models/home/manifest.json').read_text(encoding='utf-8'))
        fixtures = [s for s in config['installationLines'] if s.get('id') == READING.ID]
        if fixtures:
            self.assertEqual(fixtures, [READING.installation()])

    def test_only_the_new_direct_fixture_is_registered_and_repeat_is_idempotent(self):
        config = self.config()
        before = copy.deepcopy(config)
        fixture = READING.register(config)
        expected = copy.deepcopy(before)
        expected['installationLines'].append(fixture)
        self.assertEqual(config, expected)
        self.assertFalse(fixture['transport'], 'the existing28transportchannels are retained')
        self.assertEqual(fixture['glowTag'], fixture['id'])
        self.assertEqual(READING.register(config), fixture)
        self.assertEqual(config, expected)
        self.assertEqual(next(r for r in config['rooms'] if r['id'] == 'library-upper')['lightRegion'], READING.RETAINED_CAGE)

    def test_source_frame_or_independent_fixture_changes_fail_closed(self):
        config = self.config()
        next(r for r in config['rooms'] if r['id'] == 'library-upper')['lightRegion']['max'][2] += .1
        with self.assertRaisesRegex(RuntimeError, 'floor/cage changed'):
            READING.register(config)
        config = self.config()
        config['retreat']['setbackMetres'] = 9
        with self.assertRaisesRegex(RuntimeError, 'retreat frame'):
            READING.register(config)
        config = self.config()
        other = READING.installation()
        other['intensity'] *= 2
        config['installationLines'].append(other)
        with self.assertRaisesRegex(RuntimeError, 'independently changed'):
            READING.register(config)


if __name__ == '__main__':
    unittest.main()
