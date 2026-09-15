"""Finished kitchen, coffee station and contact-aware gym, in final Z-up rooms."""
import math
import bpy
from coastal_landscape import web


def furnish_final(mats, h, config):
    box,tube,cylinder,sphere = (h[k] for k in ('box','tube','cylinder','sphere'))
    oak,stone,metal = mats['oak'],mats['edge'],mats['brass']
    cabinet = h['material']('smoked olive cabinetry',(.22,.28,.22),.62)
    steel = h['material']('satin appliance stainless',(.45,.49,.48),.30,.72)
    black = h['material']('espresso enamel',(.055,.071,.063),.25,.28)
    ceramic = h['material']('warm glazed porcelain',(.88,.83,.70),.24)
    beans = h['material']('roasted coffee beans',(.065,.029,.012),.74)
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith('kitchen_') and not any(s in obj.name for s in ('print','portrait','lantern')):
            bpy.data.objects.remove(obj,do_unlink=True)
    # A full-depth working counter on the perimeter, with a clear 1.2 m aisle.
    for i in range(5):
        y=-.65+i*.63
        box('kitchen_perimeter_cabinet',(-4.37,y,.43),(.66,.61,.82),cabinet,.035)
        for j in range(3):
            box('kitchen_fitted_drawer',(-4.021,y,.24+j*.25),(.026,.57,.228),oak,.012)
            tube('kitchen_drawer_pull',[(-3.99,y-.15,.27+j*.25),(-3.99,y+.15,.27+j*.25)],.009,metal)
    box('kitchen_limestone_worktop',(-4.33,.61,.88),(.78,3.36,.07),stone,.03)
    box('kitchen_stone_backsplash',(-4.72,.61,1.05),(.09,3.4,.4),stone,.025)
    # Independent island: waterfall stone ends, ribbed oak, inset drawers.
    box('kitchen_island_plinth',(-2.46,1.26,.055),(.70,1.55,.10),black,.025)
    box('kitchen_island_cabinet',(-2.46,1.26,.47),(.79,1.64,.82),cabinet,.045)
    box('kitchen_island_stone',(-2.43,1.26,.925),(.96,1.85,.09),stone,.045)
    for y in (.37,2.15):box('kitchen_waterfall_end',(-2.43,y,.50),(.96,.075,.90),stone,.035)
    for i in range(24):box('kitchen_island_oak_flute',(-2.038,.51+i*.065,.49),(.030,.042,.77),oak,.013)
    box('kitchen_chopping_board',(-2.42,1.17,.985),(.47,.60,.035),mats['wood'],.035)
    bowl=sphere('kitchen_fruit_bowl',(-2.45,1.71,1.025),(.20,.19,.075),ceramic)
    for dx,dy in [(-.065,0),(.07,.025),(0,-.065)]:sphere('kitchen_citrus',(-2.45+dx,1.71+dy,1.07),(.057,.055,.055),mats['terra'])
    # Refrigerator faces into the working aisle; paired doors and freezer.
    fridge_y=2.85
    box('kitchen_double_door_fridge',(-4.33,fridge_y,1.03),(.84,1.16,2.03),steel,.065)
    for side in (-1,1):
        box('kitchen_refrigerator_door',(-3.894,fridge_y+side*.285,1.31),(.065,.548,1.32),steel,.032)
        tube('kitchen_refrigerator_handle',[(-3.80,fridge_y+side*.075,.93),(-3.80,fridge_y+side*.075,1.54)],.019,metal)
    box('kitchen_freezer_drawer',(-3.891,fridge_y,.34),(.065,1.10,.54),steel,.028)
    tube('kitchen_freezer_pull',[(-3.80,fridge_y-.41,.47),(-3.80,fridge_y+.41,.47)],.018,metal)
    # Induction hob and oven, seated in the perimeter cabinetry.
    box('kitchen_induction_glass',(-4.31,-.64,.924),(.56,.55,.018),black,.017)
    for y in (-.79,-.49):
        for x in (-4.44,-4.19):
            tube('kitchen_induction_ring',[(x+.092*math.cos(j*math.tau/32),y+.092*math.sin(j*math.tau/32),.936) for j in range(33)],.002,steel)
    box('kitchen_oven_door',(-3.985,-.65,.49),(.045,.55,.56),black,.025)
    box('kitchen_oven_window',(-3.958,-.65,.49),(.008,.41,.30),steel,.02)
    tube('kitchen_oven_handle',[(-3.92,-.86,.71),(-3.92,-.44,.71)],.014,steel)
    box('kitchen_sink_recess',(-4.31,1.85,.919),(.49,.49,.018),steel,.09)
    box('kitchen_sink_bowl',(-4.31,1.85,.928),(.40,.40,.011),black,.09)
    tube('kitchen_swan_tap',[(-4.57,1.85,.91),(-4.57,1.85,1.26),(-4.47,1.85,1.34),(-4.31,1.85,1.28),(-4.31,1.85,1.20)],.017,metal)
    # Espresso machine: case, group, controls, steam wand and slotted drip tray.
    box('kitchen_espresso_machine',(-4.25,.22,1.18),(.47,.60,.48),black,.06)
    box('kitchen_espresso_front',(-4.006,.22,1.22),(.035,.53,.31),steel,.025)
    box('kitchen_drip_tray',(-3.94,.22,.967),(.21,.56,.065),steel,.015)
    for i in range(13):box('kitchen_drip_tray_slot',(-3.925,-.03+i*.039,1.002),(.16,.009,.005),black,.003)
    cylinder('kitchen_espresso_group',(-3.962,.22,1.20),.070,.105,steel)
    portafilter=box('kitchen_portafilter',(-3.84,.22,1.145),(.23,.035,.032),mats['wood'],.014)
    tube('kitchen_steam_wand',[(-3.985,.43,1.26),(-3.89,.47,1.15),(-3.89,.47,1.04)],.009,steel)
    for y in (.06,.38):
        dial=cylinder('kitchen_espresso_dial',(-3.977,y,1.32),.038,.018,black,vertices=24);dial.rotation_euler.y=math.pi/2
    cylinder('kitchen_cup_rest',(-3.91,.22,1.01),.071,.018,ceramic)
    cup=cylinder('kitchen_espresso_cup',(-3.91,.22,1.065),.055,.094,ceramic)
    cup['activityProp']='coffee-cup'
    handle=tube('kitchen_espresso_cup_handle',[(-3.91,.264,1.09),(-3.91,.307,1.083),(-3.91,.311,1.047),(-3.91,.265,1.035)],.010,ceramic)
    handle['activityProp']='coffee-cup'
    # Separate grinder with transparent hopper and visible beans.
    box('kitchen_grinder_body',(-4.24,1.03,1.09),(.32,.32,.33),black,.055)
    hoppermat=h['material']('coffee hopper glass',(.65,.72,.68),.18,.05)
    cylinder('kitchen_grinder_hopper',(-4.24,1.03,1.39),.145,.25,hoppermat,vertices=32)
    cylinder('kitchen_hopper_beans',(-4.24,1.03,1.485),.129,.025,beans,vertices=32)
    for i in range(14):
        a=i*2.399;r=.105*math.sqrt((i+1)/14)
        sphere('kitchen_coffee_bean',(-4.24+r*math.cos(a),1.03+r*math.sin(a),1.51),(.025,.015,.012),beans,segments=12)
    box('kitchen_grinder_spout',(-4.02,1.03,1.12),(.18,.085,.055),steel,.02)
    cylinder('kitchen_tamper',(-4.12,.72,.954),.045,.045,steel)
    sphere('kitchen_tamper_handle',(-4.12,.72,1.006),(.027,.027,.035),mats['wood'])
    for i in range(2):
        shelf=box('kitchen_floating_oak_shelf',(-4.42,.57,1.77+i*.32),(.48,2.92,.055),oak,.025)
        for j in range(4):
            cylinder('kitchen_stoneware_jar',(-4.36,-.20+j*.54,1.87+i*.32),.072,.14,ceramic)
    # Dining stays in the open ocean-facing part of the room.
    cylinder('kitchen_dining_table',(-3.45,3.75,.78),.62,.09,oak,vertices=64)
    cylinder('kitchen_dining_pedestal',(-3.45,3.75,.38),.15,.73,mats['wood'])
    for dx in (-.23,.23):
        for dy in (-.23,.23):
            box('kitchen_dining_chair_leg',(-3.45+dx,3.05+dy,.22),(.045,.045,.44),mats['wood'],.018)
    box('kitchen_dining_chair_seat',(-3.45,3.05,.45),(.57,.59,.12),mats['sage'],.065)
    back=box('kitchen_dining_chair_back',(-3.45,2.79,.77),(.58,.12,.55),oak,.065)
    back.rotation_euler.x=.12
    cylinder('kitchen_dining_plate',(-3.45,3.60,.839),.18,.017,ceramic)
    h['potted_plant']('kitchen',-4.32,4.12,0,.86,mats,h)
    kitchen=next(r for r in config['rooms'] if r['id']=='kitchen')
    kitchen.update(actor=web((-3.45,3.04,0)),target=web((-3.18,1.85,1.03)),egress=web((-1.56,3.1,0)),exitPath=[web((-2.7,3.04,0)),web((-1.56,3.1,0))])
    kitchen['camera']={'radius':5.4,'yaw':2.68,'pitch':.40}
    # Raise and articulate the grips; park the bench forward of the active rack.
    for o in list(bpy.context.scene.objects):
        if o.name.startswith('gym_pullup_bar'):bpy.data.objects.remove(o,do_unlink=True)
        elif o.name.startswith(('gym_bench_','gym_bench_stitch')):o.location.y+=2.02
        elif o.name.startswith('gym_rack_upright'):o.dimensions.z+=.23;o.location.z+=.115
        elif o.name.startswith('gym_rack_depth_brace'):o.location.z+=.23
    steelGym=bpy.data.materials['powder coated gym steel']
    rubber=bpy.data.materials['gym rubber']
    tube('gym_multigrip_pullup_bar',[(-.84,.87,2.28),(-.61,.72,2.37),(-.30,.72,2.37),(.30,.72,2.37),(.61,.72,2.37),(.84,.87,2.28)],.025,steel)
    for side in (-1,1):
        tube('gym_neutral_pullup_handle',[(side*.30,.71,2.37),(side*.30,1.05,2.37)],.026,rubber)
        box('gym_dip_attachment',(side*.81,.94,1.25),(.11,.16,.20),steelGym,.018)
        tube('gym_dip_arm',[(side*.81,.94,1.24),(side*.43,1.10,1.24),(side*.43,1.72,1.24)],.031,steelGym)
        tube('gym_dip_grip',[(side*.43,1.40,1.24),(side*.43,1.70,1.24)],.034,rubber)
    gym=next(r for r in config['rooms'] if r['id']=='gym')
    gym.update(actor=web((0,1.45,.048)),facing=0,egress=web((-1.62,1.95,0)),exitPath=[web((-1.35,1.95,0)),web((-1.62,1.95,0))])
    gym['camera']={'radius':5.2,'yaw':3.45,'pitch':.30}
    # The front top-tray dumbbell remains a separate prop for real transfers.
    for obj in bpy.context.scene.objects:
        if obj.name.startswith('gym_stored_dumbbell') and abs(obj.location.y-2.32)<.13 and .60<obj.location.z<.85:
            obj['activityProp']='exercise-weight'
    config['equipment']={
        'coffee':{'actor':web((-3.36,.23,0)),'facing':-math.pi/2,'approach':[web((-1.56,3.1,0)),web((-3.38,2.70,0)),web((-3.36,.23,0))],
            'grinder':web((-4.01,1.03,1.12)),'tamper':web((-4.12,.72,1.02)), 'brew':web((-3.96,.22,1.21)), 'cup':web((-3.91,.22,1.065)), 'seat':kitchen['actor']},
        'pullup':{'actor':web((0,1.01,.048)), 'facing':0,'hands':[web((-.30,1.0,2.37)),web((.30,1.0,2.37))]},
        'dip':{'actor':web((0,1.48,.048)),'facing':0,'hands':[web((-.43,1.49,1.24)),web((.43,1.49,1.24))]},
        'dumbbell':{'actor':web((.78,2.48,.048)),'facing':0,'rest':web((1.14,2.32,.723)),'hands':[]},
        'bench':{'parked':web((0,2.73,.47))},
    }
    config['activities']['breakfast']['sequence']='coffee'
    config['activities']['workout']['sequence']='strength'
