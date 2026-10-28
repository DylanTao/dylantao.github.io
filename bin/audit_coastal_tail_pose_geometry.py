"""Read-only complete exported-tail/body/cloth triangle audit in Blender 4.5.9.

Input is the source-bound Float64 actual GLB pose export from
probe_coastal_tail_transfer.mjs --geometry-out. All component vertices and all
triangle centroids participate; there is no attachment-distance exclusion.
"""
from pathlib import Path
import hashlib,json,sys
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0,str(Path(__file__).resolve().parent))
from audit_coastal_overlaps import segments,is_inside


def main():
    assert bpy.app.version==(4,5,9)
    args={p[2:].split('=',1)[0]:p.split('=',1)[1] for p in sys.argv if p.startswith('--') and '=' in p}
    folder=Path(args['geometry']).resolve();out=Path(args['out']).resolve()
    top=json.loads((folder/'topology.json').read_text());rows=[]
    tf=np.array(top['tailFaces'],dtype=np.int32)
    files=sorted(folder.glob('phase-*.bin'))
    assert len(files)==249,'All249 actual phases are required'
    for file in files:
        p=np.fromfile(file,dtype=np.float64).reshape((-1,3))
        assert len(p)==top['tailVertices']+top['bodyVertices']
        tail=p[:top['tailVertices']];body=p[top['tailVertices']:];ta=tail[tf]
        surface=np.concatenate([tail,ta.mean(axis=1)])
        tree=BVHTree.FromPolygons(tail,tf.tolist(),all_triangles=True)
        row={'phase':int(file.stem.split('-')[1]),'body':{}}
        for kind,faces in top['bodyFaces'].items():
            assert faces,f'Actual{kind} triangles required'
            ff=np.array(faces,dtype=np.int32);other=BVHTree.FromPolygons(body,faces,all_triangles=True)
            pairs=tree.overlap(other);cross=0
            if pairs:
                _a,_b,length,_plane=segments(ta[[i for i,j in pairs]],body[ff[[j for i,j in pairs]]])
                cross=float(length[length>1e-6].sum())
            hits=[]
            for i,point in enumerate(surface):
                if is_inside(other,Vector(point)):
                    depth=other.find_nearest(Vector(point))[3]
                    hits.append({'vertex':i if i<len(tail) else None,'triangle':i-len(tail) if i>=len(tail) else None,'depthM':depth,'position':point.tolist()})
            row['body'][kind]={'crossingM':cross,'insideVertices':sum(hit['vertex'] is not None for hit in hits),'insideTriangleCentroids':sum(hit['triangle'] is not None for hit in hits),'maximumDepthM':max((hit['depthM'] for hit in hits),default=0),'witnesses':hits[:8]}
        pairs=[(i,j) for i,j in tree.overlap(tree) if i<j and not set(tf[i])&set(tf[j])]
        cross=0
        if pairs:
            _a,_b,length,_plane=segments(ta[[i for i,j in pairs]],ta[[j for i,j in pairs]])
            cross=float(length[length>1e-6].sum())
        row['selfCrossingM']=cross;rows.append(row)
        if row['phase']%16==0 or row['phase']==248:print('WHOLE-TAIL',row,flush=True)
    receipt={'scope':'All actual decoded tail/component vertices and triangle centroids against complete posed Skin, shirt and shorts in249 actual room-transfer phases. Actual triangle crossing and nonadjacent self-crossing also measured. No attachment-distance exclusion. Finite sampling, not continuous proof.','sourceGlbSha256':top['sourceGlbSha256'],'topologySha256':hashlib.sha256((folder/'topology.json').read_bytes()).hexdigest(),'phaseHashes':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in files},'rows':rows}
    out.write_text(json.dumps(receipt,indent=2)+'\n')
    print('SUMMARY',json.dumps({'maxSelfCrossingM':max(r['selfCrossingM'] for r in rows),'body':{kind:{field:max(r['body'][kind][field] for r in rows) for field in ['crossingM','insideVertices','insideTriangleCentroids','maximumDepthM']} for kind in top['bodyFaces']}}),flush=True)


if __name__=='__main__':main()
