"""Recognisable UCSD architecture, shared by the footer and compressed atlas."""
import math
from coastal_campus import campus_landmarks

def landmarks(h):
    group, box, rod, ball = (h[k] for k in ('group','box','rod','ball'))
    concrete, glass, white, wood = (h[k] for k in ('concrete','glass','white','wood'))
    geisel,salk=campus_landmarks(h)
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
