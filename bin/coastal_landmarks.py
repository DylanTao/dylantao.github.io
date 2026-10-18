"""Recognisable UCSD architecture, shared by the footer and compressed atlas."""
import math
from coastal_campus import campus_landmarks
from coastal_life import FIRE, LOG_LENGTH, LOG_THICKNESS, PARKED_BOARDS, PIER, PIER_LANDING, beach_height, log_seats
from coastal_terrain import ground_height

def landmarks(h):
    group, box, rod, ball = (h[k] for k in ('group','box','rod','ball'))
    concrete, glass, white, wood = (h[k] for k in ('concrete','glass','white','wood'))
    geisel,salk=campus_landmarks(h)
    pier=group('ScrippsPier')
    x,y=PIER['x'],(PIER['y0']+PIER['y1'])/2
    box('Research pier deck',(x,y,PIER['deck']),(PIER['width'],PIER['y1']-PIER['y0'],.16),wood,pier)
    for j in range(9):
        yy=y-3.5+j*.87
        for s in (-1,1):
            rod('Concrete ocean piling',(x+s*.35,yy,-.8),(x+s*.35,yy,.77),.064,concrete,pier)
            rod('Pier handrail post',(x+s*.4,yy,.82),(x+s*.4,yy,1.13),.018,white,pier)
    for s in (-1,1):
        rod('Pier handrail',(x+s*.4,y-3.7,1.13),(x+s*.4,y+3.7,1.13),.018,white,pier)
    # The deck used to stop in mid-air above the sand. A landing carries it
    # onto the bluff, where the ground rises to the deck, on a last pair of
    # pilings. It is separate from ScrippsPier so the atlas keeps its own pier.
    landing=group('PierLanding')
    y0,y1=PIER['y1'],PIER_LANDING['y1']
    box('Pier landing deck',(x,(y0+y1)/2,PIER['deck']),(PIER['width'],y1-y0,.16),wood,landing)
    for s in (-1,1):
        rod('Landing piling',(x+s*.35,.32,ground_height(x+s*.35,.32)-.1),(x+s*.35,.32,.77),.064,concrete,landing)
        rod('Pier handrail',(x+s*.4,y0,1.13),(x+s*.4,y1,1.13),.018,white,landing)
        rod('Pier handrail post',(x+s*.4,y1-.04,.82),(x+s*.4,y1-.04,1.13),.018,white,landing)
    bonfire=group('EveningBonfire')
    firemat=h['material']('Firelight',(1,.25,.035),.55,glow=2.1)
    fx,fy=FIRE['x'],FIRE['y']
    sand=beach_height(fx,fy)
    # The ring sits up the beach, clear of the surf, the volleyball court and
    # the parasols; stones and driftwood rest on the sand rather than above it.
    for i in range(7):
        a=i*math.tau/7
        ball('Fire ring stone',(fx+math.cos(a)*FIRE['ring'],fy+math.sin(a)*FIRE['ring'],sand+.035),(.12,.1,.08),concrete,bonfire)
    for i in range(3):
        a=i*math.pi/3
        rod('Driftwood',(fx-math.cos(a)*.3,fy-math.sin(a)*.3,sand+.05),(fx+math.cos(a)*.3,fy+math.sin(a)*.3,sand+.07),.045,wood,bonfire)
    # Flames hang from an empty at their base so the browser can let them
    # flicker upward without lifting off the wood.
    flames=group('Flames')
    flames.parent=bonfire
    flames.location=(fx,fy,sand+.09)
    # Tongues of varied height lean together, rather than one rounded egg.
    for dx,dy,height,radius,lean in ((0,0,.19,.06,0),(-.075,.03,.14,.048,-.18),(.07,-.02,.155,.048,.2),(.02,.07,.115,.042,.1),(-.03,-.065,.125,.042,-.12)):
        tongue=ball('Small flame',(dx,dy,height),(radius,radius*.9,height),firemat,flames)
        tongue.rotation_euler.y=lean
    # Driftwood logs on the landward half of the circle; the browser seats a
    # small group on them (coastal_life.figures), facing the fire and the sea.
    for seat in log_seats():
        tx,ty=-math.sin(seat['angle']),math.cos(seat['angle'])
        cx,cy,cz=seat['x'],seat['y'],seat['z']+LOG_THICKNESS-.01
        rod('Driftwood log seat',(cx-tx*LOG_LENGTH/2,cy-ty*LOG_LENGTH/2,cz),(cx+tx*LOG_LENGTH/2,cy+ty*LOG_LENGTH/2,cz+.01),LOG_THICKNESS,wood,bonfire,10)
    parked=group('ParkedBoards')
    for i,(bx,by) in enumerate(PARKED_BOARDS):
        o=ball('Board on sand',(bx,by,beach_height(bx,by)+.66-.12),(.11,.05,.66),white,parked,3)
        o.rotation_euler.y=.1-.08*i
    return [geisel,salk,pier,landing,bonfire,parked]
