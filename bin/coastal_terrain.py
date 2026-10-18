"""Continuous ground for the footer's three inhabited coastal districts.

The central home/studio remains in place. The outer mesa and village borrow
La Jolla's bluff, park and cove relationships, not geographic distances.
"""
import math

# x, waterline y, beach width, inland elevation, back of the relief.
# The same profile is exported for the runtime surf shader.
PROFILE = [
    [-82, -2.0, .9, .7, 5], [-55, -1.0, .7, 1.1, 6],
    [-47, -3.6, .6, 2.15, 10], [-40, -4.1, .5, 2.15, 12],
    [-34, -1.8, .65, 1.8, 12], [-28, 1.2, .9, 2.0, 13],
    [-23, .8, 1.1, 1.6, 10], [-19, -2.1+.7*math.sin(-19*.23)+.25*math.sin(-19*.68), 1.96, .92, 5],
    [19, -2.68, 1.96, .92, 5], [23, -1.35, .8, 1.3, 7],
    [28, 1.0, .7, 2.0, 10], [32, .9, .65, 2.05, 12],
    [36, -2.4, .65, 1.9, 13], [40, -4.0, .55, 1.8, 12],
    [43, -3.8, .55, 1.5, 10], [47, -3.4, 1.4, 1.1, 8],
    [51, -1.1, .9, 1.0, 7], [57, -.5, .8, .8, 5],
    [82, -2.0, .9, .7, 5],
]


def profile(x):
    for a, b in zip(PROFILE, PROFILE[1:]):
        if a[0] <= x <= b[0]:
            t = (x-a[0])/(b[0]-a[0])
            t = t*t*(3-2*t)
            return [a[i]+(b[i]-a[i])*t for i in range(1, 5)]
    return PROFILE[0 if x < PROFILE[0][0] else -1][1:]


def shoreline(x):
    if -19 <= x <= 19:
        return -2.1+.7*math.sin(x*.23)+.25*math.sin(x*.68)
    return profile(x)[0]


def ground_height(x, y):
    if -19 <= x <= 19:
        front = shoreline(x)+1.9
        t = max(0, min(1, (y-front)/(5-front)))
        return .12+(.8+2.5*math.exp(-((x+10.3)/3.25)**4))*min(1, (t/.18)**.5)
    shore, beach, height, back = profile(x)
    t = max(0, min(1, (y-shore-beach)/(back-shore-beach)))
    return .12+(height-.12)*min(1, (t/.13)**.55)


TERRAIN_GRID = (520, 28)


def _terrain_column(i):
    nx = TERRAIN_GRID[0]
    x = -82+164*i/nx
    shore, beach, height, back = profile(x)
    if -19 <= x <= 19:
        beach, back = 1.9, 5
    return x, shoreline(x)+beach, back


def _column_height(i, y):
    ny = TERRAIN_GRID[1]
    x, front, back = _terrain_column(i)
    t = max(0.0, min(float(ny), (y-front)/(back-front)*ny))
    j = min(ny-1, int(t))
    z = [ground_height(x, front+k/ny*(back-front))+.014*math.sin(x*4+k/ny*17) for k in (j, j+1)]
    return z[0]+(z[1]-z[0])*(t-j)


def mesh_height(x, y):
    """Height of the authored terrain mesh, which is coarser than ground_height.

    On the steep bluff faces the mesh's facets differ from the smooth profile
    by more than a path ribbon's lift, so ribbons follow the mesh itself.
    """
    u = (x+82)/164*TERRAIN_GRID[0]
    i = max(0, min(TERRAIN_GRID[0]-1, int(math.floor(u))))
    f = u-i
    return _column_height(i, y)*(1-f)+_column_height(i+1, y)*f


def path_height(x, y):
    """Surface of a path ribbon: just above both the mesh and the smooth profile."""
    return max(mesh_height(x, y), ground_height(x, y))+.026


def author_terrain(h):
    mesh, owner = h['mesh'], h['terrain']
    verts, faces = [], []
    nx, ny = TERRAIN_GRID
    for i in range(nx+1):
        x = -82+164*i/nx
        shore, beach, height, back = profile(x)
        if -19 <= x <= 19:
            beach, back = 1.9, 5
        front = shoreline(x)+beach
        for j in range(ny+1):
            t = j/ny
            y = front+t*(back-front)
            z = ground_height(x, y)+.014*math.sin(x*4+t*17)
            verts.append((x,y,z))
            if i<nx and j<ny:
                a=i*(ny+1)+j
                faces.append((a,a+ny+1,a+ny+2,a+1))
    land=mesh('Connected sandstone bluffs and park',verts,faces,h['rockmats'][0],owner)
    for m in h['rockmats'][1:]+[h['grass']]:
        land.data.materials.append(m)
    for i,p in enumerate(land.data.polygons):
        j=i%ny
        p.material_index=4 if j>=6 else min(3,j//2)
    for name,mat,wet in [('Sheltered beaches',h['sand'],False),('Wet tide edge',h['wet'],True)]:
        verts,faces=[],[]
        for i in range(nx+1):
            x=-82+164*i/nx
            beach=1.96 if -19<=x<=19 else profile(x)[1]+.08
            for offset in ((-.20,.10) if wet else (0,beach)):
                verts.append((x,shoreline(x)+offset,.085+offset*.027))
            if i<nx:
                faces.append((i*2,i*2+2,i*2+3,i*2+1))
        mesh(name,verts,faces,mat,owner)


def landscape_paths(h):
    """Paths connect entries and overlooks; rocks follow eroded bluff feet."""
    group,mesh,box,ball,rod=(h[k] for k in ('group','mesh','box','ball','rod'))
    owner=group('CoastalWalk')

    def walk(name, points, width=.48):
        # Five vertices across: on the steep bluff faces a two-vertex ribbon
        # sagged below the concave ground, and terrain rows tore through it.
        across=(-1,-.5,0,.5,1)
        verts,faces=[],[]
        for i,(x,y) in enumerate(points):
            a=points[max(0,i-1)]; b=points[min(len(points)-1,i+1)]
            dx,dy=b[0]-a[0],b[1]-a[1]; length=math.hypot(dx,dy) or 1
            for side in across:
                xx,yy=x-side*dy/length*width/2,y+side*dx/length*width/2
                verts.append((xx,yy,path_height(xx,yy)))
            if i<len(points)-1:
                n,k=len(across),i*len(across)
                faces.extend((k+s,k+n+s,k+n+s+1,k+s+1) for s in range(n-1))
        mesh(name,verts,faces,h['white'],owner)

    # A quiet bluff path, with separate branches to the library and Salk court.
    def bluff_walk_y(x):
        return shoreline(x)+profile(x)[1]+1.9
    walk('Campus bluff walk',[(x,bluff_walk_y(x)) for x in [-49+i*.3 for i in range(104)]])
    walk('Salk approach', [(-41,0),(-40,1),(-39.8,2.0),(-40.2,3.0)], .8)
    # Geisel's serpentine approach is a legible plan relationship, not a label.
    # It leaves the bluff walk on the flat top; its first loop used to hang
    # down the face of the Cove, where the terrain cut through the ribbon.
    snake=[(-30.7+2.3*math.sin(t*.84),1.9+t*.40) for t in [i*.1 for i in range(36,126)]]
    walk('Library winding approach', [(snake[0][0],bluff_walk_y(snake[0][0]))]+snake, .48)
    # The promenade passes Brockton Villa's porch stair instead of running
    # under its stone terrace, then resumes beyond the cottage.
    for xs in ([22+i*.25 for i in range(22)], [31.9+i*.25 for i in range(89)]):
        walk('Village coastal promenade',[(x,shoreline(x)+profile(x)[1]+1.4) for x in xs], .53)
    walk('Hotel garden approach',[(36.9,4.8),(36.2,3.8),(37.7,2.5),(39,1.7),(40,.4)],.55)
    walk('Cottage access',[(27,3.05),(26,3.2),(25,2.9),(24,2.5)],.45)

    # Eroded sandstone at the Cove and the breakwater's landward end.
    for i,x in enumerate([-48,-46.7,-43.5,-36,-34.2,-24.5,24,25.1,26,31.5,32.4,33.5,34.5,41.4,42.1,43]):
        y=shoreline(x)+.35
        for j in range(3):
            radius=.25+((i*7+j*3)%5)*.085
            ball('Wave-worn bluff foot',(x+(j-1)*.35,y+.13*j,.12+radius*.2),(radius*1.2,radius*.85,radius*.55),h['rockmats'][(i+j)%4],owner)

    # Small occupied overlooks sit beside the paths at human seat height. The
    # browser seats their visitors (coastal_life.figures); feet turn with the
    # seat and reach the ground on sloping lawns.
    from coastal_life import BENCHES, BENCH, bench_frame, bench_seat_top, surface_height
    for x,y,angle in BENCHES:
        top=bench_seat_top(x,y,angle)
        axis,_=bench_frame(x,y,angle)
        seat=box('Ocean-facing bench',(x,y,top-BENCH['thick']/2),(BENCH['length'],BENCH['depth'],BENCH['thick']),h['wood'],owner,.012)
        seat.rotation_euler.z=angle
        for s in (-1,1):
            fx,fy=x+axis[0]*s*BENCH['foot'],y+axis[1]*s*BENCH['foot']
            base=surface_height(fx,fy)-.04
            height=top-BENCH['thick']-base
            foot=box('Bench foot',(fx,fy,base+height/2),(.07,BENCH['depth']-.03,height),h['concrete'],owner,.008)
            foot.rotation_euler.z=angle
    return owner
