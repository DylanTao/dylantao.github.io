"""Fitted planters and hanging greenery for the occupied rooms."""

import math
import random
from coastal_craft import potted_plant
from coastal_sculpt import surface


def coastal_planting(mats, h, height, coastline, sage):
    """Botanical clusters follow the actual ridge; no evenly scattered balls."""
    rng = random.Random(414)
    flower = h["material"]("coastal wildflower ochre", (.64,.42,.12), .92)
    agave = h["material"]("blue sage agave leaf", (.23,.37,.29), .78)
    # Low, irregular groundcover links the shrubs into habitats rather than
    # leaving individual decorative balls scattered across bare clay.
    for k,(cx,cy,rx,ry) in enumerate([(-10,-3,4.2,2.1),(9,-3,3.8,1.9),(-2,-9,5,2.2),(20,2,5.3,2.2),(-18,1,3.7,2.3)]):
        verts=[];faces=[]
        for ring in range(13):
            for j in range(65):
                a=j/64*math.tau;r=ring/12*(1+.18*math.sin(a*5+k)+.09*math.cos(a*9))
                x,y=cx+rx*r*math.cos(a),cy+ry*r*math.sin(a)
                verts.append((x,y,height(x,y)+.028))
        for ring in range(12):
            for j in range(64):
                p=ring*65+j;faces.append((p+65,p+66,p+1,p))
        surface('core_sage_groundcover',verts,faces,sage)
    # A few substantial shrubs set the silhouette, smaller companions fill gaps.
    for i in range(125):
        center = [(-10,-3),(9,-2),(-2,-9),(15,2),(24,4),(-18,2),(4,-9)][i%7]
        x,y = center[0]+rng.gauss(0,2.0), center[1]+rng.gauss(0,1.25)
        if abs(x)<5.8 and y> -5.5:
            continue
        y = min(y,coastline(x)-1.7)
        z = height(x,y)
        size = rng.uniform(.3,.85)
        if i%4 == 0:
            verts,faces=[],[]
            for leaf in range(9):
                a=leaf*math.tau/9
                start=len(verts)
                for row in range(7):
                    t=row/6
                    r=size*t*.95
                    w=size*.15*math.sin(math.pi*t)
                    zh=z+size*(.10+math.sin(t*math.pi*.62))
                    for side in (-1,0,1):
                        verts.append((x+r*math.cos(a)-side*w*math.sin(a),y+r*math.sin(a)+side*w*math.cos(a),zh+(1-abs(side))*.035))
                for row in range(6):
                    for col in range(2):
                        p=start+row*3+col
                        faces.append((p,p+1,p+4,p+3))
            surface("core_clifftop_agave",verts,faces,agave)
        else:
            for branch in range(4):
                a=branch*2.399+i
                tip=(x+math.cos(a)*size*.4,y+math.sin(a)*size*.4,z+size*(.48+.12*branch))
                h["tube"]("core_sage_branch",[(x,y,z),((x+tip[0])/2,(y+tip[1])/2,z+size*.35),tip],.016,mats["wood"],resolution=3)
                h["sphere"]("core_sage_crown",tip,(size*.40,size*.32,size*.26),sage,segments=12)
                if i%3 == 0:
                    for j in range(3):
                        h["sphere"]("core_sage_flower",(tip[0]+j*.05,tip[1],tip[2]+size*.23),(.06,.05,.05),flower,segments=8)


def garden(mats, h):
    # These coordinates are in the finished two-storey section, before batching.
    potted_plant("study_botanical", -1.35, -4.8, 4.43, 0.82, mats, h)
    h["box"](
        "study_planter_bracket",
        (-1.35, -5.02, 5.46),
        (0.10, 0.55, 0.08),
        mats["wood"],
        0.02,
    )
    for side in (-1, 1):
        h["tube"](
            "study_planter_cord",
            [(-1.35, -4.8, 5.45), (-1.35 + side * 0.115, -4.8, 4.64)],
            0.008,
            mats["wood"],
        )
    for side in (-1, 1):
        points = []
        for i in range(10):
            z = 4.66 - i * 0.09
            x = -1.35 + side * (0.11 + 0.07 * math.sin(i * 0.7))
            y = -4.72 + 0.055 * math.sin(i * 0.9)
            points.append((x, y, z))
            leaf = h["sphere"](
                "study_botanical_trailing_leaf",
                (x + side * 0.055, y + 0.02, z),
                (0.08, 0.025, 0.055),
                mats["leaf"],
                segments=12,
            )
            leaf.rotation_euler.y = side * 0.5
        h["tube"]("study_botanical_vine", points, 0.009, mats["leaf"])
    potted_plant("lounge_botanical", 4.18, 4.05, 0, 1.7, mats, h)
    potted_plant("kitchen_botanical", -4.25, 3.65, 0, 1.35, mats, h)
