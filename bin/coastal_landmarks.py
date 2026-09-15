"""Recognisable UCSD architecture, shared by the footer and compressed atlas."""
import math

def landmarks(h):
    group, box, rod, ball = (h[k] for k in ('group','box','rod','ball'))
    concrete, glass, white, wood = (h[k] for k in ('concrete','glass','white','wood'))
    geisel=group('Geisel')
    x,y,z=-1.3,6.2,.93
    box('Library earthbound podium',(x,y,z-.35),(5.2,5.2,.90),concrete,geisel)
    box('Recessed library entrance',(x,y,z+.58),(1.45,1.45,1.16),glass,geisel)
    box('Library structural core',(x,y,z+1.30),(.96,.96,2.6),concrete,geisel)
    for side in (-1,1):
        for sy in (-1,1):
            for offset in (-.22,.22):
                rod('Splayed concrete library buttress',(x+side*.68+offset,y+sy*.68,z+.03),(x+side*1.92+offset,y+sy*1.92,z+2.75),.24,concrete,geisel,vertices=4)
    for i,w in enumerate([3.2,4.25,4.7,4.05,3.4]):
        ht=z+2.1+i*.47
        box('Stepped library soffit',(x,y,ht),(w,w,.13),white,geisel,.035)
        box('Continuous library glass',(x,y,ht+.25),(w-.18,w-.18,.38),glass,geisel,.01)
        for s in (-1,1):
            for j in range(9):
                p=-w/2+.2+j*(w-.4)/8
                box('Library mullion',(x+p,y+s*(w/2-.07),ht+.24),(.035,.06,.4),concrete,geisel,.002)
                box('Library mullion',(x+s*(w/2-.07),y+p,ht+.24),(.06,.035,.4),concrete,geisel,.002)
    box('Library roof',(x,y,z+4.53),(3.52,3.52,.15),white,geisel)
    salk=group('Salk')
    x,y,z=-7.0,6.4,.93
    box('Travertine court',(x,y,z+.04),(4.8,4.0,.08),white,salk,.01)
    box('Narrow water channel',(x,y,z+.089),(.065,3.8,.015),glass,salk,.002)
    for s in (-1,1):
        box('Salk laboratory wing',(x+s*1.78,y,z+.9),(1.15,4,1.8),concrete,salk)
        for j in range(5):
            yy=y-1.6+j*.8
            box('Salk study tower',(x+s*1.15,yy,z+1.02),(.35,.48,2.04),white,salk)
            box('Teak study shutter',(x+s*.962,yy,z+1.24),(.035,.33,.58),wood,salk,.002)
    pier=group('ScrippsPier')
    x,y=12.5,-3.8
    box('Research pier deck',(x,y,.79),(.92,7.7,.16),wood,pier)
    for j in range(9):
        yy=y-3.5+j*.87
        for s in (-1,1):
            rod('Concrete ocean piling',(x+s*.35,yy,-.8),(x+s*.35,yy,.77),.064,concrete,pier)
            rod('Pier handrail post',(x+s*.4,yy,.82),(x+s*.4,yy,1.13),.018,white,pier)
    for s in (-1,1):
        rod('Pier handrail',(x+s*.4,y-3.7,1.13),(x+s*.4,y+3.7,1.13),.018,white,pier)
    bonfire=group('EveningBonfire')
    firemat=h['material']('Firelight',(1,.25,.035),.55,glow=2.1)
    for i in range(7):
        a=i*math.tau/7
        ball('Fire ring stone',(2.5+math.cos(a)*.38,-1.4+math.sin(a)*.38,.19),(.12,.1,.08),concrete,bonfire)
    for i in range(3):
        a=i*math.pi/3
        rod('Driftwood',(2.5-math.cos(a)*.3,-1.4-math.sin(a)*.3,.23),(2.5+math.cos(a)*.3,-1.4+math.sin(a)*.3,.25),.045,wood,bonfire)
        ball('Small flame',(2.5+(i-1)*.085,-1.4,.37),(.075,.07,.19),firemat,bonfire)
    for i in range(3):
        a=i*2.1
        xx,yy=2.5+math.cos(a)*.8,-1.4+math.sin(a)*.8
        box('Beach seat',(xx,yy,.27),(.3,.28,.25),wood,bonfire)
        h['person'](xx,yy,.26,bonfire,h['rose'])
        rod('Marshmallow stick',(xx,yy,.65),(2.5+math.cos(a)*.26,-1.4+math.sin(a)*.26,.56),.012,wood,bonfire)
        ball('Marshmallow',(2.5+math.cos(a)*.26,-1.4+math.sin(a)*.26,.56),(.044,.04,.04),white,bonfire)
    parked=group('ParkedBoards')
    for i in range(3):
        o=ball('Board on sand',(3.8+i*.24,-.35,.71),(.11,.05,.66),white,parked,3)
        o.rotation_euler.y=.2
    return [geisel,salk,pier,bonfire,parked]
