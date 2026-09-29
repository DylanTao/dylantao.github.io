"""La Jolla village and coastal details for the wide footer, in Blender Z-up.

Original geometry; map/photographic references are recorded in PROVENANCE.md.
The composition compresses distances, while keeping characteristic massing.
"""
import math


def village_landmarks(h):
    print('Authoring Brockton Villa, La Valencia and the seawall', flush=True)
    group, box, rod, ball, mesh, line = (h[k] for k in ('group','box','rod','ball','mesh','line'))
    white, wood, glass, warm, roof = (h[k] for k in ('white','wood','window','warm','roof'))
    stone, leaf = h['rockmats'][2], h['leaf']
    pink = h['material']('La Valencia rose plaster', (.79,.43,.38))
    shingle = h['material']('Brockton weathered cedar', (.29,.31,.28))
    teal = h['material']('Brockton blue trim', (.12,.40,.43))
    sealmat = h['material']('Harbor seal warm grey', (.31,.33,.30))
    blossom = h['material']('Bougainvillea petals', (.67,.24,.34))
    dome = h['material']('La Valencia tiled dome', (.66,.40,.14))

    def hip(name, x, y, z, w, d, rise, mat, owner):
        ridge = max(0, (w-d)*.42)
        verts = [(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x+w/2,y+d/2,z),(x-w/2,y+d/2,z),
                 (x-ridge,y,z+rise),(x+ridge,y,z+rise)]
        mesh(name, verts, [(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4),(3,2,1,0)], mat, owner)
        for a,b in ((0,4),(1,5),(2,5),(3,4),(4,5)):
            rod(name+' ridge', verts[a], verts[b], .035, mat, owner)

    def window(name, x, y, z, w, height, owner, lit=False):
        box(name+' white casing', (x,y,z), (w+.10,.08,height+.10), white, owner, .006)
        box(name+' glass', (x,y-.048,z), (w,.024,height), warm if lit else glass, owner, 0)
        box(name+' mullion', (x,y-.067,z), (.025,.018,height), white, owner, 0)
        box(name+' transom', (x,y-.068,z+.06), (w,.018,.025), white, owner, 0)

    def railing(name, a, b, z, owner, mat=white, height=.43):
        length = math.dist(a,b)
        n = max(2,round(length/.24))
        rod(name+' handrail', (*a,z+height), (*b,z+height), .032, mat, owner)
        for i in range(n+1):
            x,y = (a[k]+(b[k]-a[k])*i/n for k in range(2))
            rod(name+' baluster', (x,y,z), (x,y,z+height), .014, mat, owner, vertices=6)

    def planter(x,y,z,owner,flowers=False):
        rod('Terracotta flower pot',(x,y,z),(x,y,z+.25),.13,roof,owner,r2=.18)
        ball('Potted coastal planting',(x,y,z+.34),(.25,.22,.19),leaf,owner)
        if flowers:
            for dx,dy in ((-.12,0),(.09,-.08),(0,.10)):
                ball('Small bougainvillea flowers',(x+dx,y+dy,z+.45),(.09,.07,.07),blossom,owner,1)

    def cafe_table(x,y,z,owner):
        rod('Cafe pedestal',(x,y,z),(x,y,z+.43),.036,wood,owner)
        rod('Round cafe table',(x,y,z+.42),(x,y,z+.47),.25,white,owner,vertices=16)
        for dx in (-.4,.4):
            box('Cafe chair seat',(x+dx,y,z+.25),(.23,.25,.04),wood,owner,.008)
            box('Cafe chair back',(x+dx,y+.11,z+.41),(.23,.035,.31),wood,owner,.008)
            for sx in (-.08,.08):
                rod('Chair leg',(x+dx+sx,y,z),(x+dx+sx,y,z+.24),.018,wood,owner)
        rod('Coffee cup',(x+.05,y,z+.47),(x+.05,y,z+.54),.035,white,owner)

    brockton = group('BrocktonVilla')
    x,y,z = 25.8,1.65,.91
    # Low cottage on a stone retaining terrace; deep veranda on three sides.
    box('Brockton stone hillside base',(x,y,z+.31),(6.8,3.9,.64),stone,brockton)
    box('Brockton wraparound deck',(x,y-.12,z+.68),(6.9,4.05,.16),white,brockton)
    box('Brockton cottage',(x,y+.45,z+1.53),(5.4,2.6,1.56),white,brockton)
    for i in range(32):
        box('Vertical redwood cottage siding',(x-2.61+i*.168,y-.862,z+1.56),(.026,.025,1.45),h['plaster'],brockton,0)
    hip('Brockton cedar hip roof',x,y+.25,z+2.34,6.9,3.8,.79,shingle,brockton)
    # Veranda roof is lower than the main hip, leaving the roof form readable.
    awning=box('Veranda sloping roof',(x,y-1.27,z+2.13),(6.9,1.15,.09),shingle,brockton)
    awning.rotation_euler.x=.18
    for xx in (-3.15,-2.1,-1.05,0,1.05,2.1,3.15):
        box('Slender porch post',(x+xx,y-1.78,z+1.39),(.09,.09,1.45),white,brockton,.01)
        for side in (-1,1):
            rod('Porch diagonal bracket',(x+xx,y-1.78,z+1.78),(x+xx+side*.24,y-1.78,z+2.05),.026,white,brockton)
    railing('Veranda front',(x-3.25,y-1.78),(x+3.25,y-1.78),z+.76,brockton)
    for side in (-1,1):
        railing('Veranda return',(x+side*3.25,y-1.78),(x+side*3.25,y+1.7),z+.76,brockton)
    for i in range(5):
        window('Cottage sash',x-2.14+i*1.07,y-.891,z+1.64,.53,.75,brockton,lit=i in (1,3))
    box('Blue cottage sign',(x,y-1.846,z+.49),(1.35,.035,.26),teal,brockton,.025)
    # Shell-stone chimney is a silhouette detail, not a photo texture.
    box('Brockton stone chimney',(x+1.83,y+.5,z+2.74),(.43,.45,1.12),stone,brockton)
    box('Brockton chimney cap',(x+1.83,y+.5,z+3.32),(.55,.56,.10),white,brockton)
    for i in range(7):
        box('Cottage entry stair',(x-3.05,y-2.03-i*.16,z+.65-i*.085),(.62,.19,.14),white,brockton,.01)
    for dx in (-2.15,0,2.15):
        cafe_table(x+dx,y-1.2,z+.78,brockton)
    for dx in (-3.1,3.1):
        planter(x+dx,y-1.3,z+.78,brockton,True)

    valencia = group('LaValencia')
    x,y,z = 45.1,1.55,.91
    box('Hotel terraced foundation',(x,y,z+.30),(9.6,5.2,.60),stone,valencia)
    # Connected, staggered wings around the seaward garden, from the property plan.
    for dx,dy,w,d,height in ((-1.25,1.0,6.7,2.25,2.15),(1.15,.08,4.0,2.35,3.55),(-3.65,-.55,1.9,3.5,1.7)):
        box('Pink hotel wing',(x+dx,y+dy,z+.4+height/2),(w,d,height),pink,valencia)
        hip('Spanish tiled wing roof',x+dx,y+dy,z+.4+height,w+.25,d+.25,.43,roof,valencia)
        for floor in range(max(1,round(height/.8))):
            for col in range(max(2,round(w/.77))):
                xx=x+dx-w/2+.4+col*(w-.8)/max(1,round(w/.77)-1)
                window('Hotel sash',xx,y+dy-d/2-.02,z+.85+floor*.72,.28,.42,valencia,lit=(col+floor)%5==1)
    # Asymmetric tower with chamfered shoulders, octagonal lantern and tiled dome.
    tx,ty=x+2.73,y+.88
    box('Pink Lady tower',(tx,ty,z+2.47),(1.52,1.5,4.15),pink,valencia)
    for zz in (z+1.15,z+2.02,z+2.89,z+3.76):
        for dx in (-.35,.35):
            window('Tower paired sash',tx+dx,ty-.772,zz,.23,.41,valencia,lit=zz<z+2.1)
    # Four sloped shoulders step from the rectangular shaft to the lantern.
    hip('Tower sloped shoulders',tx,ty,z+4.55,1.66,1.66,.55,pink,valencia)
    rod('Octagonal tower lantern',(tx,ty,z+4.87),(tx,ty,z+5.57),.64,pink,valencia,vertices=8)
    for zz in (z+4.86,z+5.56):
        rod('Lantern pale cornice',(tx,ty,zz),(tx,ty,zz+.075),.69,white,valencia,vertices=8)
    for side in range(8):
        a=side*math.tau/8
        slit=box('Lantern narrow opening',(tx+.604*math.sin(a),ty-.604*math.cos(a),z+5.24),(.11,.04,.31),glass,valencia,.01)
        slit.rotation_euler.z=a
    verts=[]
    for j in range(7):
        angle=j*math.pi/12
        for i in range(24):
            a=i*math.tau/24
            verts.append((tx+.66*math.cos(angle)*math.cos(a),ty+.66*math.cos(angle)*math.sin(a),z+5.63+.59*math.sin(angle)))
    mesh('Tiled hemispherical tower cap',verts,[(j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i) for j in range(6) for i in range(24)],dome,valencia)
    for i in range(8):
        a=i*math.tau/8
        line('Dome pale ribs',[(tx+.667*math.cos(j*math.pi/16)*math.cos(a),ty+.667*math.cos(j*math.pi/16)*math.sin(a),z+5.63+.596*math.sin(j*math.pi/16)) for j in range(9)],.015,white,valencia)
    # A lower veranda, pool and flowering terrace keep the landmark domestic.
    box('Seaward veranda',(x+.3,y-1.75,z+.85),(5.7,1.5,.16),white,valencia)
    for i in range(8):
        box('Veranda pergola post',(x-2.22+i*.75,y-2.35,z+1.43),(.065,.065,1.05),white,valencia,.008)
    box('Veranda pergola top',(x+.4,y-1.85,z+2.0),(5.8,1.3,.07),white,valencia)
    railing('Hotel veranda edge',(x-2.45,y-2.4),(x+3.2,y-2.4),z+.93,valencia)
    box('Lower pool court',(x-1.1,y-3.0,z+.13),(5.0,1.65,.24),pink,valencia)
    box('Pool stone surround',(x-1.1,y-3.0,z+.27),(2.6,1.12,.07),white,valencia)
    box('Garden pool',(x-1.1,y-3.0,z+.309),(2.30,.83,.012),h['ocean'],valencia,0)
    for dx in (-3.8,2.0,3.6):
        planter(x+dx,y-2.8,z+.27,valencia,True)
    for dx in (-1.6,.2,2.0):
        cafe_table(x+dx,y-1.92,z+.94,valencia)

    pool = group('ChildrensPool')
    x,y = 35.5,-.85
    # Curved breakwater and a sheltered sandy haul-out, not a circular marina.
    arc=[(x+3.75*math.cos(a),y+3.6*math.sin(a)) for a in [math.pi+i*.86*math.pi/32 for i in range(33)]]
    verts=[]
    for xx,yy in arc:
        dx,dy=xx-x,yy-y; length=math.hypot(dx,dy)
        for zz,offset in ((.04,-.20),(.04,.20),(.58,-.20),(.58,.20)):
            verts.append((xx+dx/length*offset,yy+dy/length*offset,zz))
    faces=[]
    for i in range(32):
        a=i*4;b=a+4
        faces += [(a,a+2,b+2,b),(a+1,b+1,b+3,a+3),(a+2,a+3,b+3,b+2)]
    mesh('Childrens Pool curved concrete seawall',verts,faces,h['concrete'],pool)
    line('Seawall rounded coping',[(xx,yy,.60) for xx,yy in arc],.075,white,pool)
    for i in range(0,33,2):
        xx,yy=arc[i]
        rod('Seawall rail stanchion',(xx,yy,.63),(xx,yy,.94),.018,h['dark'],pool)
    line('Seawall ocean rail',[(xx,yy,.94) for xx,yy in arc],.020,h['dark'],pool)
    beach=[(x,y,.13)]+[(x+3.2*math.cos(a),y+1.75*math.sin(a),.11) for a in [math.pi+i*math.pi/36 for i in range(37)]]
    mesh('Protected seal beach',beach,[(0,i+1,i+2) for i in range(36)],h['sand'],pool)
    for i,(dx,dy) in enumerate(((-1.8,-.48),(-.7,-.93),(.4,-.42),(1.2,-.9),(2.05,-.36))):
        xx,yy=x+dx,y+dy
        seal=group('RestingHarborSeal'+str(i));seal.parent=pool
        seal.location=(xx,yy,.13);seal.rotation_euler.z=(i-2)*.32
        ball('Harbor seal body',(0,0,.15),(.39,.17,.15),sealmat,seal)
        ball('Rounded harbor seal head',(-.31,0,.21),(.15,.13,.13),sealmat,seal)
        ball('Seal muzzle',(-.41,-.018,.19),(.075,.085,.05),h['white'],seal)
        for side in (-1,1):
            flipper=ball('Short seal flipper',(.20,side*.16,.07),(.16,.07,.025),sealmat,seal,1)
            flipper.rotation_euler.z=side*.35
        for j in range(4):
            ball('Harbor seal mottling',(-.12+j*.1,-.045,.283),(.035,.04,.018),stone,seal,1)
    return [brockton,valencia,pool]


def campus_panorama(h):
    """Place batched campus originals on the outer coast; keep atlas originals."""
    import bpy
    from mathutils import Matrix, Vector
    print('Placing campus landmarks on the wider coast', flush=True)
    copies=[]
    for name,center,target,scale,angle in (
        ('Geisel',(-1.3,6.2,.93),(-27.8,1.3,.92),1.28,-.06),
        ('Salk',(-7,6.4,.93),(-41.3,1.2,.92),1.65,-.14),
    ):
        def clone(source,parent=None):
            obj=source.copy()
            bpy.context.collection.objects.link(obj)
            obj.parent=parent
            for child in source.children:
                clone(child,obj)
            return obj
        root=clone(bpy.data.objects[name])
        root.name=name+'Coast'
        root.matrix_world=Matrix.Translation(Vector(target)) @ Matrix.Rotation(angle,4,'Z') @ Matrix.Scale(scale,4) @ Matrix.Translation(-Vector(center))
        copies.append(root)
    # Quiet low approach terraces join landmarks to the neighborhood walk.
    paths=h['group']('CampusWalk')
    foundation=h['box']('Salk sandstone foundation',(-41.3,1.2,.36),(8.1,8.5,1.10),h['rockmats'][2],paths)
    foundation.rotation_euler.z=-.14
    for xx,width in ((-27.8,8.5),(-41.3,8.9)):
        h['box']('Campus approach terrace',(xx,-2.9,.69),(width,1.3,.28),h['white'],paths)
        for i in range(5):
            h['box']('Campus beach approach',(xx,-3.6-i*.17,.61-i*.10),(1.6,.20,.14),h['white'],paths,.01)
        for side in (-1,1):
            h['box']('Coastal reading bench',(xx+side*2.8,-3,.99),(1.0,.30,.10),h['wood'],paths)
            for dx in (-.36,.36):
                h['box']('Reading bench foot',(xx+side*2.8+dx,-3,.84),(.09,.24,.25),h['concrete'],paths)
    return [*copies,paths]
