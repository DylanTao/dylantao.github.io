import copy
import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('coastal_wildlife_anchors',Path(__file__).resolve().parents[1]/'bin/coastal_wildlife_anchors.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class RestAnchorTests(unittest.TestCase):
    def config(self):
        return {'terrain':{'habitats':{'seaLion':{'path':[[-10,-6.6084,-14.5115],[-8.6,-6.6737,-14.2179],[11,-6.7453,-13.3577]]}}}}

    def test_native_to_web_survey_and_other_colony_anchors(self):
        config=self.config();before=copy.deepcopy(config);queries=[]
        def height(x,y):
            queries.append((x,y));return -6.638246059417725
        result=module.resurvey_sea_lion_rest(config,height)
        self.assertEqual(queries,[(-9.7,14.8115)])
        self.assertEqual(config['terrain']['habitats']['seaLion']['path'][0],[-9.7,-6.6382,-14.8115])
        self.assertEqual(config['terrain']['habitats']['seaLion']['path'][1:],before['terrain']['habitats']['seaLion']['path'][1:])
        self.assertEqual(result['before'],[-10,-6.6084,-14.5115])

    def test_miss_water_fallback_and_nonfinite_do_not_mutate_the_point(self):
        for value in [None,-7.35,float('nan'),float('inf')]:
            with self.subTest(height=value):
                config=self.config();before=copy.deepcopy(config)
                with self.assertRaises(ValueError):module.resurvey_sea_lion_rest(config,lambda x,y:value)
                self.assertEqual(config,before)

if __name__=='__main__':unittest.main()
