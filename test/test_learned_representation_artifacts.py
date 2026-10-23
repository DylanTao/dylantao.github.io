"""Custody and validity checks for retained, genuinely trained local experiments.

Training and native browser evidence are produced by the explicit experiment tools;
CI checks their source binding without adding Torch or GPU dependencies to the site.
"""
import hashlib
import json
import math
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'artwork/coastal-home'


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class LearnedRepresentationArtifacts(unittest.TestCase):
    def test_print_target_and_actual_trainer_are_bound(self):
        report = read(ART / 'learned-print/training.json')
        self.assertEqual(report['source_sha256'], digest(ROOT / report['source']))
        self.assertEqual(report['trainer_sha256'], digest(ROOT / 'bin/train_coastal_print_field.py'))
        self.assertEqual(report['source_bytes'], (ROOT / report['source']).stat().st_size)
        self.assertEqual(sum(report['split_counts'].values()), 1200 * 600)
        self.assertEqual(report['split_counts']['test'], 71975)
        self.assertLess(abs(report['quantized_test']['rgba_psnr_db'] - report['float_test']['rgba_psnr_db']), .01)
        self.assertGreater(report['history'][-1]['validation']['rgba_psnr_db'], report['initial_validation']['rgba_psnr_db'] + 10)

    def test_quantized_print_blocks_cover_the_exact_trained_buffer(self):
        manifest = read(ART / 'learned-print/field.json')
        path = ART / 'learned-print/field.i16'
        self.assertEqual(manifest['weights_sha256'], digest(path))
        self.assertEqual(path.stat().st_size, manifest['weights_bytes'])
        offset = 0
        for block in manifest['blocks']:
            self.assertEqual(block['offset'], offset)
            self.assertEqual(math.prod(block['shape']), block['count'])
            self.assertGreater(block['scale'], 0)
            offset += block['count']
        self.assertEqual(offset * 2, path.stat().st_size)

    def test_cameras_are_calibrated_and_training_views_are_disjoint(self):
        data = read(ART / 'learned-object/data/dataset.json')
        self.assertEqual(data['sourceSha256'], digest(ART / 'learned-object/data/source.glb'))
        train, test = [], []
        for view in data['views']:
            (train if view['split'] == 'train' else test).append((view['yaw'], view['pitch']))
            self.assertEqual(view['sha256'], digest(ART / 'learned-object/data' / view['file']))
            self.assertEqual((ART / 'learned-object/data' / view['file']).stat().st_size, view['size'] ** 2 * 4)
            matrix = view['worldToCamera']
            self.assertEqual(len(matrix), 16)
            self.assertAlmostEqual(matrix[15], 1)
            for r in range(3):
                self.assertAlmostEqual(sum(matrix[c * 4 + r] ** 2 for c in range(3)), 1, places=6)
            self.assertAlmostEqual(view['focal'], view['size'] / (2 * math.tan(math.radians(35) / 2)), places=6)
        self.assertEqual(len(train), 12)
        self.assertEqual(len(test), 12)
        self.assertFalse(set(train) & set(test))

    def test_gaussian_parameters_are_finite_and_source_bound(self):
        manifest = read(ART / 'learned-object/gaussians.json')
        path = ART / 'learned-object/gaussians.f32'
        self.assertEqual(manifest['sha256'], digest(path))
        self.assertEqual(path.stat().st_size, manifest['count'] * manifest['stride'] * 4)
        rows = list(struct.iter_unpack('<10f', path.read_bytes()))
        for row in rows:
            self.assertTrue(all(math.isfinite(v) for v in row))
            self.assertTrue(all(.0059 <= v <= .301 for v in row[3:6]))
            self.assertTrue(all(0 <= v <= 1 for v in row[6:]))
        report = read(ART / 'learned-object/training.json')
        self.assertEqual(report['trainer_sha256'], digest(ROOT / 'bin/train_coastal_object_field.py'))
        self.assertEqual(report['dataset_sha256'], digest(ART / 'learned-object/data/dataset.json'))
        self.assertEqual(report['artifact']['sha256'], manifest['sha256'])
        final_mse = sum(v['mse'] for v in report['views'] if v['split'] == 'train') / 12
        self.assertLess(final_mse, report['initial_train_mean_mse'] / 2)
        self.assertFalse(set(report['train_views']) & set(report['held_out_views']))

    def test_browser_decoders_used_the_exact_trained_weights(self):
        for folder, key, manifest_key in [('learned-print', 'weightsSha256', 'weights_sha256'), ('learned-object', 'weightsHash', 'sha256')]:
            with self.subTest(folder=folder):
                report = read(ART / folder / 'browser/browser.json')
                manifest = read(ART / folder / ('field.json' if folder == 'learned-print' else 'gaussians.json'))
                self.assertEqual({v['engine'] for v in report['runs']}, {'chromium', 'webkit'})
                for run in report['runs']:
                    self.assertEqual(run['evidence'][key], manifest[manifest_key])
                    self.assertTrue(all(run['checks'].values()), run['checks'])
                    self.assertFalse(run['errors'])
                    for view in run.get('rows', run.get('views', [])):
                        for query in view['timing']:
                            if query['gpuMs'] is not None:
                                self.assertFalse(query['disjoint'])
                                self.assertFalse(query['timedOut'])
                                self.assertGreater(query['gpuMs'], 0)

    def test_browser_gaussian_reference_is_numerically_equivalent(self):
        reference = ART / 'learned-object/python-reference.f32'
        self.assertEqual(reference.stat().st_size, 256 * 256 * 3 * 4)
        for run in read(ART / 'learned-object/browser/browser.json')['runs']:
            self.assertLess(run['pythonParity']['maxAbsError'], 2 / 255)
            self.assertEqual(len(run['heldOut']), 12)


if __name__ == '__main__':
    unittest.main()
