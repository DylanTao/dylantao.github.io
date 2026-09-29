"""Authored campus silhouettes, informed by plans, aerials and reference photos.

See artwork/la-jolla/PROVENANCE.md. Dimensions are miniature proportions,
not survey measurements. The same geometry is used by both coastal views.
"""
import math


def campus_landmarks(h):
    print('Authoring Geisel and Salk architecture', flush=True)
    group, box, rod, mesh = (h[k] for k in ('group', 'box', 'rod', 'mesh'))
    concrete, glass, white, wood = (h[k] for k in ('concrete', 'glass', 'white', 'wood'))

    def plate(name, outline, z, depth, mat, owner):
        n = len(outline)
        verts = [(x, y, zz) for zz in (z, z + depth) for x, y in outline]
        faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
        faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
        return mesh(name, verts, faces, mat, owner)

    geisel = group('Geisel')
    x, y, z = -1.3, 6.2, .93
    # The podium stays embedded; the upper library has recessed corners,
    # rather than a stack of complete square boxes.
    box('Library buried podium', (x, y, z-.30), (5.5, 5.5, .70), concrete, geisel)
    box('Library entry pavilion', (x, y, z+.48), (1.7, 1.7, .96), glass, geisel)
    box('Library structural core', (x, y, z+1.05), (.84, .84, 2.1), concrete, geisel)
    for rotation in range(4):
        angle = rotation * math.pi / 2
        def turn(xx, yy, zz):
            return (x+xx*math.cos(angle)-yy*math.sin(angle),
                    y+xx*math.sin(angle)+yy*math.cos(angle), z+zz)
        for side in (-1, 1):
            rod('Eight splayed library piers', turn(side*.43, -.66, .04),
                turn(side*1.39, -1.70, 2.06), .19, concrete, geisel, vertices=4)
            rod('Cantilevered concrete arms', turn(side*1.39, -1.70, 2.06),
                turn(side*2.22, -1.70, 2.50), .12, concrete, geisel, vertices=4)
    def outline(width):
        a, b = width/2, width*.33
        return [(x+xx, y+yy) for xx, yy in [
            (-b,-a),(b,-a),(b,-b),(a,-b),(a,b),(b,b),
            (b,a),(-b,a),(-b,b),(-a,b),(-a,-b),(-b,-b)]]
    for floor, width in enumerate((3.55, 4.35, 5.10, 4.35, 3.55)):
        zz = z+1.85+floor*.47
        plate('Notched concrete floor plate', outline(width), zz, .12, white, geisel)
        glass_outline = outline(width-.15)
        plate('Recessed library glazing', glass_outline, zz+.12, .34, glass, geisel)
        for i, a in enumerate(glass_outline):
            b = glass_outline[(i+1) % len(glass_outline)]
            count = max(1, round(math.dist(a, b)/.28))
            for j in range(count+1):
                p = (a[0]+(b[0]-a[0])*j/count, a[1]+(b[1]-a[1])*j/count)
                box('Library vertical mullion', (*p, zz+.29), (.032,.032,.35), concrete, geisel, 0)
    plate('Stepped library roof', outline(3.66), z+4.20, .13, white, geisel)
    for i in range(5):
        box('Library approach steps', (x, y-2.0-i*.18, z-.03-i*.025),
            (1.65, .20, .09), white, geisel, .01)

    salk = group('Salk')
    x, y, z = -7.0, 6.4, .93
    box('Open travertine court', (x,y,z+.04), (4.8,4.8,.10), white, salk, .01)
    box('River of Life stone margin', (x,y-.1,z+.101), (.13,4.55,.025), concrete, salk, 0)
    box('River of Life water', (x,y-.1,z+.116), (.052,4.55,.012), glass, salk, 0)
    for i in range(4):
        box('Ocean court steps', (x,y-2.45-i*.19,z-.06-i*.035), (4.8,.20,.10), white, salk, .008)
    for side in (-1,1):
        xx = x+side*1.78
        box('Parallel laboratory wing', (xx,y,z+.92), (1.15,4.5,1.84), concrete, salk)
        # Separate laboratory and service bands, with inset glass on the end.
        for floor in range(3):
            zz = z+.35+floor*.55
            box('Salk end glazing', (xx,y-2.258,zz), (.93,.025,.32), glass, salk, 0)
            box('Salk outer lab glazing', (xx+side*.584,y,zz), (.026,4.27,.30), glass, salk, 0)
            box('Salk service slab', (xx,y,zz+.235), (1.21,4.56,.11), white, salk, .01)
        for j in range(5):
            yy = y-1.8+j*.88
            # Angled study fronts overlook both the court and the ocean.
            plan = [(x+side*.86,yy-.34),(x+side*1.34,yy-.12),
                    (x+side*1.34,yy+.37),(x+side*.86,yy+.37)]
            if side < 0:
                plan.reverse()
            plate('Sawtooth study tower', plan, z+.46, 1.66, concrete, salk)
            for floor in range(2):
                zz = z+.91+floor*.72
                panel = box('Angled teak study front', (x+side*1.095,yy-.243,zz),
                            (.53,.032,.52), wood, salk, .008)
                panel.rotation_euler.z = side*math.atan2(.22,.48)
                pane = box('Study glass inset', (x+side*1.05,yy-.270,zz+.03),
                           (.18,.040,.35), glass, salk, 0)
                pane.rotation_euler.z = panel.rotation_euler.z
            box('Open portico pier', (x+side*.96,yy+.27,z+.25), (.13,.16,.5), concrete, salk)
        box('Laboratory flat roof rim', (xx,y,z+1.91), (1.24,4.6,.09), white, salk)
    return geisel, salk
