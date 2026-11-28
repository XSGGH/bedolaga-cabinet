"""Render the Snow Event's deterministic 25-state architectural winter diorama.

Usage: blender -b -t 6 --python tools/render_snow_station.py -- --stage 25
       blender -b -t 6 --python tools/render_snow_station.py -- --all

Every frame is rendered from the exact same meshes and camera. Stage visibility
is controlled by explicit object metadata rather than generated-image patches.
"""

import argparse
import math
import os
import random
import sys

import bpy
from mathutils import Vector

random.seed(20261201)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument('--stage', type=int, default=25)
parser.add_argument('--all', action='store_true')
parser.add_argument('--size', default='1440x900')
parser.add_argument('--output', default='public/xsg-snow-assets/diorama')
parser.add_argument('--export', action='store_true', help='Export a single WebGL-ready GLB with 26 stage states')
parser.add_argument('--workbench', action='store_true', help='Quick geometry preview without heavy Eevee render')
args = parser.parse_args(argv)
width, height = map(int, args.size.split('x'))

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.world = bpy.data.worlds.new('Twilight | XSG')
world = bpy.context.scene.world
world.use_nodes = True
background = world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value = (0.21, 0.15, 0.30, 1)
background.inputs['Strength'].default_value = 0.36

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = width
scene.render.resolution_y = height
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.image_settings.compression = 20
scene.render.use_file_extension = True
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.compression = 15
scene.render.resolution_percentage = 100
scene.render.use_simplify = True
scene.render.simplify_subdivision = 1
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.4
scene.view_settings.gamma = 1.0
scene.camera = None

staged = []
def remember(obj, stage=0):
    obj['snow_stage'] = stage
    staged.append(obj)
    return obj

def material(name, color, rough=.72, metallic=0, emit=0, bump=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    if emit:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emit
    if bump:
        nodes = m.node_tree.nodes
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 115
        noise.inputs['Detail'].default_value = 2
        bump_node = nodes.new('ShaderNodeBump')
        bump_node.inputs['Strength'].default_value = bump
        bump_node.inputs['Distance'].default_value = .13
        m.node_tree.links.new(noise.outputs['Fac'], bump_node.inputs['Height'])
        m.node_tree.links.new(bump_node.outputs['Normal'], p.inputs['Normal'])
    return m

SNOW = material('Snow | pearl violet dusk', (.69,.66,.80), .94, bump=.11)
SNOW_TOP = material('Fresh snow | top coat', (.83,.84,.94), .96, bump=.14)
ICE = material('Blue ice | subtle translucency', (.39,.68,.80), .25, metallic=.24)
STONE = [material(f'Cobble {i}', c, .91, bump=.06) for i,c in enumerate([
    (.29,.28,.39),(.33,.32,.43),(.41,.39,.49),(.34,.32,.41),(.47,.44,.52)])]
CURB = material('Rimstone | blue granite', (.48,.49,.58), .85)
GRAPHITE = material('XSG architectural graphite', (.064,.077,.11), .34, metallic=.65)
FRAME = material('Satin gunmetal mullion', (.10,.12,.16), .35, metallic=.7)
ROOF = material('Architectural charcoal roof', (.14,.16,.22), .72, metallic=.18)
GLASS = material('Architectural glass', (.085,.15,.23), .1, metallic=.5)
AMBER = material('Quiet amber interior light', (.95,.59,.28), .3, emit=4)
LAMP = material('Warm tiny LED', (1,.78,.42), .2, emit=9)
VIOLET = material('Lavender tiny LED', (.61,.37,1), .2, emit=8)
WHITELED = material('Pearl white LED', (.88,.88,1), .2, emit=7)
WOOD = material('Oiled chestnut slats', (.33,.20,.16), .75, bump=.1)
WOOD_LIGHT = material('Brushed ash wood', (.55,.35,.26), .72, bump=.09)
FIR = [material(f'Conifer needles {i}', c, .88, bump=.07) for i,c in enumerate([
    (.045,.13,.14),(.055,.18,.17),(.07,.22,.22),(.09,.18,.20)])]
TRUNK = material('Pine bark', (.21,.13,.12), .96, bump=.17)
GOLD = material('Brushed champagne gold', (.78,.52,.22), .25, metallic=.8)
RIBBON = material('Dusty violet satin', (.39,.28,.62), .4)
CATWHITE = material('White cat soft wool', (.85,.81,.87), .95)
CATNOSE = material('Cat muted rose', (.53,.31,.43), .8)

def assign(obj, mat):
    if mat:
        obj.data.materials.append(mat)
    return obj

def bevel(obj, amount=.07, seg=3):
    mod=obj.modifiers.new('Architectural edge radii', 'BEVEL')
    mod.width=amount
    mod.segments=seg
    obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return obj

def cube(name, loc, size, mat, stage=0, beveled=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj=bpy.context.object
    obj.name=name
    obj.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj,mat)
    if beveled: bevel(obj,beveled)
    return remember(obj,stage)

def sphere(name, loc, scale, mat, stage=0, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=max(8,segments//2), location=loc)
    obj=bpy.context.object;obj.name=name
    obj.scale=scale
    bpy.ops.object.shade_smooth()
    assign(obj,mat)
    return remember(obj,stage)

def cylinder(name, loc, radius, depth, mat, stage=0, vertices=16, r2=None):
    if r2 is not None:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=r2,depth=depth,location=loc)
    else:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    obj=bpy.context.object;obj.name=name
    bpy.ops.object.shade_smooth()
    assign(obj,mat)
    return remember(obj,stage)

def curve(name, coords, thickness, mat, stage=0, cyclic=False):
    data=bpy.data.curves.new(name,'CURVE')
    data.dimensions='3D';data.resolution_u=16
    data.bevel_depth=thickness;data.bevel_resolution=3
    poly=data.splines.new('POLY');poly.points.add(len(coords)-1)
    for p,xyz in zip(poly.points,coords):p.co=(*xyz,1)
    poly.use_cyclic_u=cyclic
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    assign(obj,mat)
    return remember(obj,stage)

def text(label, loc, size, material_, rotation=(math.pi/2,0,0), stage=0):
    data=bpy.data.curves.new(label,'FONT')
    data.body=label; data.align_x='CENTER';data.align_y='CENTER';data.size=size
    data.extrude=.008;data.bevel_depth=.002
    obj=bpy.data.objects.new(label,data);scene.collection.objects.link(obj)
    obj.location=loc;obj.rotation_euler=rotation
    assign(obj,material_)
    return remember(obj,stage)

def point_light(name,loc,color,energy=180,size=2):
    light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.color=color;light.shape='DISK';light.size=size
    obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(0,0,0)
    return obj

def look_at(obj, loc):obj.rotation_euler=(Vector(loc)-obj.location).to_track_quat('-Z','Y').to_euler()

# A continuous physical landscape; stonework always lies on the same terrain.
verts=[];faces=[];nx=96;ny=78
for iy in range(ny+1):
    y=-24+iy*58/ny
    for ix in range(nx+1):
        x=-37+ix*74/nx
        d=math.hypot(x*.7,y*.7)
        rise= .11*math.sin(x*.34+y*.17)+.09*math.sin(x*.97-y*.26)
        rise*=min(1,max(0,(d-6)/6))
        verts.append((x,y,-.42+rise))
for iy in range(ny):
    for ix in range(nx):
        i=iy*(nx+1)+ix;faces.append((i,i+1,i+nx+2,i+nx+1))
mesh=bpy.data.meshes.new('Organic snow terrain');mesh.from_pydata(verts,[],faces);mesh.update()
terrain=bpy.data.objects.new('One snow terrain',mesh);scene.collection.objects.link(terrain);assign(terrain,SNOW)

# Plaza — one stone ring with a legible approach, absolutely no second road.
cylinder('Circular square foundation',(0,-.25,-.09),5.25,.43,CURB,vertices=112)
cylinder('Flat cobbled plaza',(0,-.25,.145),5.04,.12,STONE[0],vertices=112)
for ring, n in [(1.0,18),(1.85,34),(2.65,50),(3.47,66),(4.26,80)]:
    for i in range(n):
        a=(i+.5*(ring%2))*math.tau/n
        x=ring*math.cos(a);y=-.25+ring*math.sin(a)
        obj=cube('Individual radial plaza cobble',(x,y,.233),(max(.18,ring*math.tau/n-.035),.66,.08),random.choice(STONE),beveled=.028)
        obj.rotation_euler[2]=a+math.pi/2

cube('Single front approach foundation',(0,-10.35,-.055),(3.62,10.3,.30),CURB,beveled=.14)
for iy in range(30):
    for ix in range(7):
        xx=(ix-3)*.49 + (iy%2)*.15-.065
        yy=-15.28+iy*.34
        cube('Single approach paving cobble',(xx,yy,.139),(random.uniform(.36,.44),random.uniform(.24,.31),.095),random.choice(STONE),beveled=.028)

# Plants are rooted in plausible beds, not floating stickers.
def snow_bed(x,y,w,depth,h=.22):
    sphere('Snowbank around planted roots',(x,y,-.22),(w,depth,h),SNOW_TOP,segments=20)

def pine(x,y,height,stage=0,snow=True):
    radius=height*.235
    cylinder('Natural pine trunk',(x,y,height*.42),height*.045,height*.85,TRUNK,stage,vertices=11)
    tier_count=7
    for t in range(tier_count):
        z=.65+height*t/tier_count
        r=radius*(1-t/tier_count)*1.2
        if r<.09:continue
        cylinder('Dense conifer bough volume',(x,y,z),r,height*.30,FIR[t%4],stage,vertices=12,r2=0)
        if snow:
            cylinder('Natural snow resting on conifer tips',(x,y,z+height*.12),r*.83,height*.065,SNOW_TOP,stage,vertices=12,r2=0)

for x,y,h in [(-17,7,6),(-17,12,7),(-14,18,5),(-6,19,8),(1,17,6.5),(12,17,7),(17,8,6),(17,0,5),(-17,-3,4.5),(-15,-12,4),(15,-8,4.7),(12,-17,5.3),(-8,16,5.6),(7,19,6)]:
    pine(x,y,h)
for x,y,w,d in [(-8,-9,2.6,1.8),(8,-10,2.3,2.4),(-12,-6,2.4,1.6),(13,-4,2.6,1.7),(-6,-17,3,2.2),(7,-17,2.5,2.1)]:snow_bed(x,y,w,d)

# Distant sculptural mountain ridge as actual world geometry, not sky stickers.
def mountain(cx,cy,width,height,depth):
    top=[];bottom=[];sections=14
    for i in range(sections+1):
        xx=cx-width/2+i*width/sections
        profile=max(.08,1-abs((i-sections/2)/(sections/2)))
        noise=(.8*math.sin(i*2.32)+.5*math.cos(i*1.19))
        top.append((xx,cy,2.0+height*profile+noise))
        bottom.append((xx,cy,0))
    points=top+bottom
    faces=[(i,i+1,i+1+len(top),i+len(top)) for i in range(sections)]
    m=bpy.data.meshes.new('Snow mountain rock face');m.from_pydata(points,[],faces);m.update()
    ob=bpy.data.objects.new('Distant alpine ridge',m);scene.collection.objects.link(ob);assign(ob,SNOW)
    remember(ob)
for props in [(-29,29,26,13,2),(-10,34,23,17,2),(13,34,27,15,2),(32,30,23,11,2)]:mountain(*props)

# Contemporary data center. Structural columns, glazing, entrance and roof are
# independent modeled forms, with no hallucinated impossible facade geometry.
cx,cy=-7.0,7.35
cube('Datacenter cast concrete podium',(cx,cy,.38),(11.1,6.45,.82),CURB,beveled=.10)
cube('Data centre main structural shell',(cx,cy,3.3),(10.6,6.0,5.85),GRAPHITE,beveled=.12)
cube('Data centre front glass',(cx,4.29,3.33),(10.05,.12,4.70),GLASS,beveled=.06)
cube('Data centre left ribbon of glass',(-12.31,cy,3.65),(.1,5.1,3.3),GLASS)
for z in [1.9,4.38,5.7]:
    cube('Data centre horizontal graphite transom',(cx,4.19,z),(10.68,.24,.16),FRAME,beveled=.018)
for x in [-12.20,-10.6,-9.0,-7.4,-5.8,-4.2,-2.6,-1.8]:
    cube('Structural vertical mullion',(x,4.14,3.1),(.13,.29,5.0),FRAME,beveled=.018)
for z in [2.12,4.64]:
    for x in [-11.40,-9.80,-8.20,-6.6,-5.0,-3.4,-2.1]:
        cube('Glowing server hall interior panel',(x,4.47,z),(1.27,.045,1.20),AMBER,stage=2,beveled=.02)
        cube('Warm server-room interior shade',(x,4.43,z),(1.36,.05,1.33),GLASS,stage=2)
for x in [-9.6,-8.8,-8.0]:
    cube('Visible server cabinet',(x,5.1,1.90),(.53,.6,2.43),FRAME,beveled=.055)
    for z in [1.2,1.55,1.9,2.25,2.6]:
        cube('Rack status LED',(x,4.78,z),(.30,.014,.037),VIOLET,stage=2)
cube('Inset entry doors',(-7.0,4.05,1.35),(1.65,.14,2.35),GLASS,stage=4,beveled=.02)
cube('Protective graphite entry canopy',(-7,3.77,2.68),(2.95,1.22,.22),FRAME,stage=4,beveled=.09)
for xx in [-7.95,-6.05]:
    cylinder('Entrance safety light',(xx,3.66,2.42),.042,.35,LAMP,stage=4)
cube('Datacenter flat roof cap',(cx,cy,6.3),(11.1,6.5,.38),ROOF,beveled=.1)
cube('Snow cap across flat roof',(cx,cy,6.53),(10.85,6.20,.17),SNOW_TOP,beveled=.07)
for xx,yy in [(-9.7,7.9),(-6.7,8.1),(-3.3,7.3)]:
    cube('HVAC base on actual roof',(xx,yy,6.75),(1.48,1.6,.50),FRAME,beveled=.07)
    for k in range(3):
        curve('HVAC vent grille',[(xx-.48+k*.48,yy-.62,7.03),(xx-.48+k*.48,yy+.62,7.03)],.021,CURB)
text('XSG',(-9.65,4.024,5.20),.84,WHITELED,stage=5)

# Modern timber pavilion with a structurally continuous pitched roof.
wx,wy=7.0,7.95
cube('Pavilion stone slab',(wx,wy,.34),(6.50,5.65,.67),CURB,beveled=.09)
cube('Pavilion warm timber envelope',(wx,wy,2.35),(6.1,5.25,4.04),WOOD,beveled=.08)
for x in [4.2+i*.32 for i in range(18)]:
    cube('Each real facade timber batten',(x,5.263,2.38),(.046,.08,3.8),WOOD_LIGHT,beveled=.012)
for x in [5.15,7.0,8.85]:
    cube('Pavilion generous window',(x,5.18,2.30),(1.45,.12,2.38),GLASS,beveled=.03)
    cube('Pavilion glowing interior',(x,5.28,2.30),(1.22,.05,2.15),AMBER,stage=11)
    cube('Pavilion glass reflection',(x,5.16,2.30),(1.33,.05,2.27),GLASS)
    for z in [1.65,2.90]:cube('Window frame crossbar',(x,5.11,z),(1.53,.17,.07),FRAME,beveled=.01)
cube('Pavilion double door',(wx,5.075,1.65),(1.15,.22,2.83),FRAME,beveled=.02)
cube('Pavilion glass doorway',(wx,4.95,1.7),(.92,.09,2.55),GLASS)
cube('Warm pendant in pavilion',(wx,5.3,3.55),(.38,.3,.1),LAMP,stage=11)
def roof_plane(name,top_points,mat,stage=0):
    me=bpy.data.meshes.new(name); me.from_pydata(top_points,[],[(0,1,2,3)]);me.update()
    ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);assign(ob,mat)
    solid=ob.modifiers.new('Real roof panel thickness','SOLIDIFY');solid.thickness=.17
    bevel(ob,.045)
    return remember(ob,stage)
roof_plane('Left slope of pitched timber roof',[(3.55,4.9,4.35),(7.0,4.9,6.15),(7.0,10.9,6.15),(3.55,10.9,4.35)],ROOF)
roof_plane('Right slope of pitched timber roof',[(7.0,4.9,6.15),(10.48,4.9,4.35),(10.48,10.9,4.35),(7.0,10.9,6.15)],ROOF)
roof_plane('White snow on left roof',[(3.56,4.91,4.52),(7.0,4.91,6.32),(7.0,10.88,6.32),(3.56,10.88,4.52)],SNOW_TOP)
roof_plane('White snow on right roof',[(7.0,4.91,6.32),(10.46,4.91,4.52),(10.46,10.88,4.52),(7.0,10.88,6.32)],SNOW_TOP)
for x,z in [(3.65,4.55),(7,6.29),(10.36,4.55)]:
    curve('Finished roof trim',[(x,4.82,z),(x,10.9,z)],.055,WOOD_LIGHT)

# Christmas tree is spatially fixed; its additions each belong to separate
# architectural stage groups, never a guessed location on an image.
pine(0,-.2,6.8,stage=7)
for j in range(25):
    z=1.35+j*.18
    r=max(.18,1.40*(1-z/7.4))
    a=j*2.43
    sphere('Hand-hung muted glass ornament',(math.cos(a)*r, -.2+math.sin(a)*r,z),(.077,.077,.088),RIBBON if j%3 else GOLD,stage=8,segments=12)
for j in range(94):
    z=1.3+j*.052
    radius=1.67*(1-z/7.5)
    a=j*2.30
    if radius<.1:continue
    sphere('Tiny physically located tree light',(math.cos(a)*radius,-.2+math.sin(a)*radius,z),(.045,)*3,LAMP if j%3 else VIOLET,stage=10,segments=8)
for j in range(5):
    a=j*math.tau/5
    sphere('Tree topper bead',(math.sin(a)*.14,-.2+math.cos(a)*.14,7.15),(.075,)*3,GOLD,stage=14,segments=12)
sphere('Tree topper central glow',(0,-.2,7.15),(.15,)*3,LAMP,stage=14,segments=12)

def lantern(x,y,stage=1):
    cylinder('Snow-anchored bollard base',(x,y,.16),.16,.28,CURB,stage)
    cylinder('Wrought metal lamp post',(x,y,.95),.055,1.5,FRAME,stage)
    cube('Beveled lamp glass',(x,y,1.80),(.27,.27,.41),AMBER,stage,beveled=.025)
    cube('Black lamp cap',(x,y,2.055),(.41,.41,.10),GRAPHITE,stage,beveled=.025)

lantern(-2.4,-8.3,stage=1)
for x,y in [(2.4,-8.3),(-2.45,-12.4),(2.45,-12.4),(-4.7,-2.5),(4.7,-2.5),(0,4.1)]:lantern(x,y,stage=3)

def gift(x,y,z=.24,scale=.6,stage=12):
    cube('Ribbon-wrapped present',(x,y,z+scale*.5),(scale,scale,scale),RIBBON,stage,beveled=.055)
    cube('Gift satin cross band X',(x,y,z+scale*.5),(scale+.018,scale*.14,scale+.02),GOLD,stage,beveled=.018)
    cube('Gift satin cross band Y',(x,y,z+scale*.5),(scale*.14,scale+.018,scale+.02),GOLD,stage,beveled=.018)
    for dx in [-.14,.14]:
        sphere('Fabric bow loop',(x+dx,y,z+scale+.08),(.15,.09,.08),GOLD,stage)

for x,y,s in [(1.05,-1.0,.60),(-.92,-1.28,.48),(1.32,.12,.40)]:gift(x,y,.24,s,12)
for x,y,s in [(9.8,3.5,.55),(10.3,4.0,.44)]:gift(x,y,.28,s,6)

def cat(x,y,stage=13,size=.62):
    sphere('Sitting XSG snowy cat',(x,y,.34+size*.43),(.34*size,.37*size,.51*size),CATWHITE,stage)
    sphere('Friendly white cat head',(x,y-.06,.34+size*1.05),(.39*size,.33*size,.37*size),CATWHITE,stage)
    for dx in [-.20,.20]:
        mesh=bpy.data.meshes.new('Small triangular cat ear')
        zz=.34+size*1.32
        mesh.from_pydata([(x+dx-.10*size,y-.06,zz),(x+dx+.10*size,y-.06,zz),(x+dx,y-.06,zz+.30*size)],[],[(0,1,2)])
        mesh.update();o=bpy.data.objects.new('Sculpted cat ear',mesh);scene.collection.objects.link(o);assign(o,CATWHITE);remember(o,stage)
        sphere('Cat bright black eye',(x+dx*.69,y-.36*size-.07,.34+size*1.13),(.043*size,)*3,GRAPHITE,stage,10)
    sphere('Cat rose nose',(x,y-.38*size-.07,.34+size*.96),(.045*size,)*3,CATNOSE,stage,10)
    curve('Wrapped signature violet scarf',[(x-.30*size,y,.34+size*.76),(x,y-.29*size,.34+size*.77),(x+.27*size,y,.34+size*.75)],.095*size,RIBBON,stage)

cat(2.05,-1.92,13,.95)
cat(-3.62,1.4,21,.66)

# Stage 9: garland on forest firs; stage 15: linear architecture light accents.
for x,y in [(-15,-3),(15,-8)]:
    for k in range(9):
        a=k*2.40
        z=1.9+k*.27
        sphere('Forest fir warm detail',(x+math.cos(a)*.55,y+math.sin(a)*.55,z),(.045,)*3,LAMP,stage=9,segments=8)
for x0,x1,y,z in [(-11.9,-2.1,4.04,6.1),(4.0,10.0,5.0,4.45)]:
    for j in range(30):
        x=x0+j*(x1-x0)/29
        sphere('Architectural holiday roofline lights',(x,y,z+.04),(.04,)*3,WHITELED if j%3 else VIOLET,stage=15,segments=8)

# Phase 16: eight real, grounded low-voltage tree uplights with snow-covered bases.
for j in range(8):
    a=j*math.tau/8
    x,y=2.92*math.cos(a),-.2+2.92*math.sin(a)
    cylinder('Tree ground light fixed in pavement',(x,y,.265),.12,.10,FRAME,stage=16,vertices=12)
    sphere('Tree warm ground spotlight',(x,y,.35),(.11,.11,.075),LAMP,stage=16,segments=12)

# A grounded iron arch spanning exactly the existing single pedestrian path.
for x in [-2.05,2.05]:
    cube('Arch granite footing',(x,-8.95,.22),(.62,.62,.42),CURB,stage=18,beveled=.08)
    cube('Structural wrought arch upright',(x,-8.95,1.64),(.14,.14,2.56),FRAME,stage=18,beveled=.035)
arc=[]
for i in range(29):
    a=math.pi-i*math.pi/28
    arc.append((2.05*math.cos(a),-8.95,2.95+1.38*math.sin(a)))
curve('Continuous engineered metal arch',arc,.105,GOLD,stage=18)
curve('Continuous fir garland follows metal arch',[(x,y,z+.12) for x,y,z in arc],.12,FIR[0],stage=18)
for j in range(24):
    x,y,z=arc[j]
    sphere('Physically attached arch warm lights',(x,y-.13,z+.08),(.048,)*3,LAMP if j%3 else WHITELED,18,10)

# Three small, physically integrated collectible details, no billboard stickers.
cube('Photo spot wooden bench',(8.7,2.5,.65),(1.9,.59,.14),WOOD_LIGHT,stage=17,beveled=.05)
for x in [7.94,9.44]:cube('Photo spot bench legs',(x,2.5,.39),(.12,.53,.52),WOOD,stage=17,beveled=.025)
for x in [-.58,.58]:cylinder('Snow sculpture plinth',(x+3.65,-3.3,.32),.32,.42,CURB,stage=19)
sphere('Hand-carved ice snowflake',(3.66,-3.3,1.14),(.47,.26,.67),ICE,stage=19)
cube('Gift sleigh load',(9.0,-1.2,.55),(1.23,.75,.54),WOOD,stage=20,beveled=.08)
for dx in [-.58,.58]:curve('Gently curved gold sleigh runner',[(9+dx,-1.95,.14),(9+dx,-1.5,.1),(9+dx,-.70,.12)],.046,GOLD,stage=20)

# A miniature dome observatory and non-garish sky-finale atmosphere.
cylinder('Observatory low plinth',(12.9,8.6,.22),.64,.36,CURB,stage=22)
sphere('Small copper observatory dome',(12.9,8.6,.76),(.69,.69,.47),ROOF,stage=22)
cylinder('Small precise telescope barrel',(12.9,8.6,1.20),.13,.90,FRAME,stage=22)

# Physical festoon cable spanning the small gap between *existing* buildings,
# anchored to masonry (no hanging stars or standalone vector sky art).
wire=[]
for j in range(24):
    t=j/23
    wire.append((-1.85+5.5*t,6.25,6.25-1.1*t-.45*math.sin(math.pi*t)))
curve('Anchored roof-to-roof festoon cable',wire,.019,FRAME,stage=23)
for j in range(1,23,2):
    x,y,z=wire[j]
    sphere('Bulb connected to real festoon cable',(x,y,z-.075),(.060,)*3,WHITELED if j%3 else LAMP,stage=23,segments=8)
# Stage 24: the planted ring gains discreet illuminated winter hedging.
for j in range(16):
    a=j*math.tau/16
    x,y=5.05*math.cos(a),-.25+5.05*math.sin(a)
    sphere('Last perimeter ground lights',(x,y,.25),(.065,)*3,WHITELED,stage=24,segments=10)
# Stage 25: finale lights stay firmly attached to both roof perimeters.
for x0,x1,y,z in [(-11.8,-2.1,4.08,6.0),(4.1,10.0,5.08,4.39)]:
    for j in range(27):
        x=x0+j*(x1-x0)/26
        sphere('Finale roofline bulbs physically fastened to buildings',(x,y,z),(.05,)*3,LAMP if j%4 else VIOLET,stage=25,segments=8)

# Gallery-hall-level illumination and fixed cinematic camera.
sun=bpy.data.lights.new('Soft twilight sun','SUN');sun.energy=.95;sun.color=(.72,.76,1)
sun.angle=math.radians(12)
sun_obj=bpy.data.objects.new('Soft twilight sun',sun);scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler=(math.radians(28),math.radians(-20),math.radians(-35))
point_light('Large camera-side softbox',(3,-13,17),(.74,.65,1),2000,14)
point_light('Warm data centre bounce',(-8,2.8,5),(1,.67,.43),420,6)
point_light('Warm workshop bounce',(7,4.1,5),(1,.72,.49),360,6)
point_light('Tree festive glow',(0,-2.1,5),(.68,.53,1),340,5)
cam_data=bpy.data.cameras.new('One camera for all 25 stages')
camera=bpy.data.objects.new('One camera for all 25 stages',cam_data)
scene.collection.objects.link(camera)
camera.location=(0,-27.8,16.5)
look_at(camera,(0,1.3,2.25))
cam_data.type='ORTHO';cam_data.ortho_scale=34
scene.camera=camera
if args.workbench:
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO'
    scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True
    scene.display.shading.show_cavity=True
    scene.display.shading.cavity_type='BOTH'
    scene.display.shading.curvature_ridge_factor=1.1
    scene.display.shading.curvature_valley_factor=1.1

def apply_stage(stage):
    for ob in staged:ob.hide_render = int(ob.get('snow_stage',0))>stage

def render(stage):
    apply_stage(stage)
    scene.render.filepath=f'{args.output}-{stage:02d}.png'
    print(f'XSG rendering real scene, stage {stage:02d}/25, {len(staged)} modeled objects',flush=True)
    bpy.ops.render.render(write_still=True)

os.makedirs(os.path.dirname(args.output) or '.', exist_ok=True)
if args.export:
    # Convert curves and typography, then coalesce meshes by reveal stage and
    # material. One stage/group remains independently toggleable at runtime.
    mesh_objects=[]
    for ob in list(staged):
        if ob.type in {'CURVE','FONT'}:
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True); bpy.context.view_layer.objects.active=ob
            bpy.ops.object.convert(target='MESH')
        if ob.type=='MESH': mesh_objects.append(ob)
    grouped={}
    for ob in mesh_objects:
        stage=int(ob.get('snow_stage',0))
        key=(stage,ob.data.materials[0].name if ob.data.materials else 'none')
        grouped.setdefault(key,[]).append(ob)
    print('Preparing',len(grouped),'deterministic stage/material mesh groups',flush=True)
    for (stage,material_name),parts in grouped.items():
        bpy.ops.object.select_all(action='DESELECT')
        for ob in parts:ob.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1:bpy.ops.object.join()
        parts[0].name=f'Stage_{stage:02d}_{material_name}'
        parts[0]['snow_stage']=stage
    # The web experience supplies consistent studio lights and camera.
    for ob in list(scene.objects):
        if ob.type=='LIGHT':bpy.data.objects.remove(ob,do_unlink=True)
    bpy.ops.export_scene.gltf(filepath=args.output+'.glb', export_format='GLB',
        export_extras=True, export_apply=True, export_cameras=True,
        export_lights=False, export_yup=True)
    print('XSG exported real 3D scene to',args.output+'.glb',flush=True)
elif args.all:
    for s in range(26):render(s)
else:render(max(0,min(25,args.stage)))
