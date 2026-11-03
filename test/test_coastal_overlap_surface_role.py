"""A mixed roof's finish cannot inherit a terrain exemption from its owner."""
import ast
import copy
from pathlib import Path
import unittest

tree=ast.parse((Path(__file__).resolve().parents[1]/'bin/audit_coastal_overlaps.py').read_text())
functions=[n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name=='crossed_surface_role']
assert len(functions)==1
namespace={}
exec(compile(ast.Module(body=functions,type_ignores=[]),'<crossed-surface-role>','exec'),namespace)
surface=namespace['crossed_surface_role']


class CoastalOverlapSurfaceRole(unittest.TestCase):
    def setUp(self):
        self.roof={'category':'rock','closed':True,'props':{'caveRoof':True,'closedSolid':True},
                   'mats':['golden coastal sandstone','chalk limestone','La Jolla stratified sandstone'],
                   'mat':[0,0,1,2]}

    def test_finite_rock_site_qualifies_without_excusing_adjacent_finish(self):
        old=copy.deepcopy(self.roof)
        self.assertEqual(surface(self.roof,[0,1,3])['category'],'rock')
        self.assertTrue(surface(self.roof,[0,1,3])['qualifiedCaveRock'])
        for indices in ([2],[0,2],[0,1,2,3],[]):
            with self.subTest(indices=indices):
                result=surface(self.roof,indices)
                self.assertEqual(result['category'],'shell')
                self.assertFalse(result['qualifiedCaveRock'])
        self.assertEqual(self.roof,old)

    def test_open_and_unknown_material_roofs_stay_shell(self):
        for key,value in [('closed',False),
                          ('mats',['sandstone-look wallpaper','chalk limestone','La Jolla stratified sandstone'])]:
            with self.subTest(key=key,value=value):
                roof=copy.deepcopy(self.roof);roof[key]=value
                self.assertFalse(surface(roof,[0])['qualifiedCaveRock'])
                self.assertEqual(surface(roof,[0])['category'],'shell')

    def test_declared_solid_flag_does_not_replace_measured_closure(self):
        self.roof['closed']=False
        self.assertFalse(surface(self.roof,[0])['qualifiedCaveRock'])
        self.roof['closed']=True
        del self.roof['props']['closedSolid']
        self.assertTrue(surface(self.roof,[0])['qualifiedCaveRock'])

    def test_only_exact_import_suffixes_preserve_known_material_identity(self):
        for name,want in [('golden coastal sandstone.001',True),('La Jolla stratified sandstone.123',True),
                          ('golden coastal sandstone-like',False),('golden coastal sandstone.1',False),('',False)]:
            with self.subTest(name=name):
                roof=copy.deepcopy(self.roof);roof['mats'][0]=name
                self.assertEqual(surface(roof,[0])['qualifiedCaveRock'],want)

    def test_ordinary_meshes_keep_their_existing_category(self):
        mesh=copy.deepcopy(self.roof);mesh['props']={};mesh['category']='furniture'
        self.assertEqual(surface(mesh,[2])['category'],'furniture')
        self.assertFalse(surface(mesh,[2])['qualifiedCaveRock'])


if __name__=='__main__':unittest.main()
