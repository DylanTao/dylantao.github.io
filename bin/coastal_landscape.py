"""Authored coastal section and its shared browser contact data (Blender Z-up).

Large landforms precede surface detail. All habitat paths and shore samples are
exported from these functions, so a browser neighbour stands on the same coast.
"""

import math


def bell(x, center, width):
    return math.exp(-((x - center) / width) ** 2)


def weathering(x, z):
    """Nonperiodic, broad weathering; small mineral grain stays in shading."""
    ix, iz = math.floor(x), math.floor(z)
    fx, fz = x-ix, z-iz
    fx, fz = fx*fx*(3-2*fx), fz*fz*(3-2*fz)
    def corner(a,b):
        value=math.sin(a*127.1+b*311.7+93.4)*43758.5453
        return (value-math.floor(value))*2-1
    return ((1-fx)*corner(ix,iz)+fx*corner(ix+1,iz))*(1-fz)+((1-fx)*corner(ix,iz+1)+fx*corner(ix+1,iz+1))*fz


def shoreline(x):
    return (5.4 + 8.5 * bell(x, -15, 7) + 12 * bell(x, 24, 9)
            + 6 * bell(x, 53, 13) - 2.6 * bell(x, 8, 5)
            + .5 * math.sin(x * .19))


def cliff_surface(x, z):
    # Unequal projecting buttresses, undercut ledges, and broad diagonal seams.
    foot = 1.55 * bell(z, -6.0, 1.8)
    buttresses = (1.4 * bell(x, -7.3, 1.65) + 2.3 * bell(x, 10.8, 2.1)
                  + 2.0 * bell(x, 20, 2.8) + 1.6 * bell(x, -19, 2.2))
    shelf = .30 * math.tanh((z + 3.6 + .12 * x) * 2.5)
    shelf += .24 * math.tanh((z - 2.0 + .045 * x) * 3)
    scallop = .36 * math.sin(x * .79 + z * .24) + .18 * math.sin(x * 1.7 - z * .48)
    # Inclined erosional channels interrupt broad planes without a repeated ripple.
    scallop -= .52 * bell(x + .19*z, -4.6, .36) + .67 * bell(x-.13*z, 13.1, .48)
    scallop -= .40 * bell(x+.07*z, -11.4, .31)
    # Composed rock faces overlap like sandstone masses, with unequal crowns
    # and recessed seams. These meter-scale forms are actual geometry.
    blocks=sum(a*bell(x,cx,wx)*bell(z,cz,wz) for cx,cz,wx,wz,a in [
        (-17,-2.7,3.5,3.6,1.8),(-11,2.4,2.8,3.1,1.25),
        (-6.6,-3.3,1.9,2.2,1.8),(-2.5,-5.7,2.7,1.5,.9),
        (7.5,1.9,2.2,2.1,1.3),(12.5,-3.2,3.0,2.7,2.1),
        (18,4.7,4,3.0,1.2),(26,-1,3.2,5.4,1.9),(32,2.4,3.0,2.9,1.2)])
    weathered = .45*weathering(x*.62+z*.12,z*.72) + .13*weathering(x*1.45,z*1.8)
    return shoreline(x) + foot + buttresses * (.7 + .3 * math.cos(z * .24)) + shelf + scallop + blocks + weathered


def top_height(x, y):
    inland = max(0, min(1, (shoreline(x) - y) / 32))
    return (6.75 + 4.0 * bell(x, -15, 8) + 5.8 * bell(x, 25, 11)
            + 2.1 * bell(x, 53, 14) + 1.2 * inland
            + .43 * math.sin(x * .34 + y * .21)
            + .18 * math.sin(x * .9 - y * .37))


def beach_width(x):
    return 13.5 + 8.5 * bell(x, 5, 10) + 5 * bell(x, 39, 9) - 4 * bell(x, 23, 6)


def beach_point(x, t):
    start = cliff_surface(x, -6.7) - .65
    y = start + t * beach_width(x)
    # A sloping dry berm flattens into the intertidal shelf, then sinks below sea.
    z = (-6.88 - 1.22 * t + .28 * bell(t, .18, .16)
         + .10 * math.sin(x * .41 + t * 2) * (1 - t)
         + .10 * bell(x, -6, 4) * bell(t, .45, .3))
    return (x, y, z)


def web(point):
    x, y, z = point
    return [round(x, 4), round(z, 4), round(-y, 4)]


def export_contacts(config):
    samples = []
    for i in range(225):
        x = -36 + i * .5
        heights = [round(beach_point(x, j / 20)[2], 4) for j in range(21)]
        water_t = next((j / 200 for j in range(201) if beach_point(x, j / 200)[2] <= -7.35), 1)
        samples.append([round(x, 3), round(beach_point(x, 0)[1], 4),
                        round(beach_width(x), 4), round(beach_point(x, water_t)[1], 4), *heights])
    def path(points):
        return [web((x, y, top_height(x, y) + .025)) for x, y in points]
    habitats = {
        "rabbitWest": {"kind": "clifftop", "path": path([(-7.6,-3.0),(-8.2,-3.5),(-9.0,-3.2),(-8.5,-2.4)])},
        "rabbitEast": {"kind": "clifftop", "path": path([(8.0,-2.0),(8.7,-2.4),(9.4,-3.0),(8.6,-3.1)])},
        "raccoon": {"kind": "clifftop", "path": path([(-5.5,-7.0),(-6.4,-7.7),(-7.6,-8.3),(-7.0,-7.2)])},
        "seal": {"kind": "sand", "path": [web(beach_point(x,.32)) for x in (-5,-4,-3)]},
        "seaLion": {"kind": "rock", "path": []},
    }
    config["version"] = 5
    config["beach"].update({"samples": samples, "width": 13.5})
    config["terrain"] = {"coordinateSystem": "three-y-up", "habitats": habitats,
                         "perches": [web((x,y,top_height(x,y)+.05)) for x,y in [(-8,-1),(9,-1),(14,3)]]}
    config['terrain']['supportSurfaces']=[
        {'id':'lower-floor','height':0,'polygon':[[-4.6,-4.6],[4.6,-4.6],[4.6,5.15],[-4.6,5.15]]},
        {'id':'upper-gallery','height':2.6,'polygon':[[-4.6,1.3],[4.6,1.3],[4.6,5.15],[2.08,5.15],[2.08,4.08],[-2.08,4.08],[-2.08,5.15],[-4.6,5.15]]}]
    # Actual transformed tread rectangles, not an approximate old stair formula.
    for i in range(15):
        x=-2.0+(i+.5)*.26
        config['terrain']['supportSurfaces'].append({'id':f'tread-{i+1}', 'height':round((i+1)*2.6/15,5),
            'polygon':[[x-.134,4.12],[x+.134,4.12],[x+.134,5.18],[x-.134,5.18]]})
    config['terrain']['contacts']={r['id']:{k:r[k] for k in ('actor','egress','floor','exitPath') if k in r} for r in config['rooms']}
    return config
