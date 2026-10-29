"""A metadata refresh must not rewrite the large authored terrain arrays."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class CameraRefreshTest(unittest.TestCase):
    def test_targeted_refresh_preserves_unowned_bytes_and_is_idempotent(self):
        source = '''{
  "rooms": [
    {"id": "lounge", "target": [0, 0.5, 2]},
    {"id": "library-upper", "target": [0, 3.5, 3]},
    {"id": "onsen", "target": [0, 3.5, 4]}
  ],
  "views": {"outside": {"pitch": 0.37, "envelope": {"pitch": [0.12, 1.2]}}},
  "untouched": [1.2300e-8, 2.000, -0.0],
  "label": "untouched spacing"
}
'''
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'manifest.json'
            path.write_text(source, encoding='utf-8', newline='\n')
            command = [sys.executable, str(ROOT/'bin/refresh_coastal_camera_anchors.py'), '--manifest', str(path), '--apply']
            subprocess.run(command, cwd=ROOT, capture_output=True, check=True)
            result = path.read_bytes()
            self.assertIn(b'"untouched": [1.2300e-8, 2.000, -0.0]', result)
            self.assertIn(b'"label": "untouched spacing"', result)
            updated = json.loads(result)
            original = json.loads(source)
            for room in updated['rooms']:
                original_room = next(r for r in original['rooms'] if r['id'] == room['id'])
                self.assertEqual(room['target'][::2], original_room['target'][::2])
                self.assertNotEqual(room['target'][1], original_room['target'][1])
            self.assertEqual(updated['views']['outside']['pitch'], original['views']['outside']['pitch'])
            low, high = updated['views']['outside']['envelope']['pitch']
            self.assertLess(low, 0)
            self.assertGreater(high, 1.2)
            subprocess.run(command, cwd=ROOT, capture_output=True, check=True)
            self.assertEqual(result, path.read_bytes())
