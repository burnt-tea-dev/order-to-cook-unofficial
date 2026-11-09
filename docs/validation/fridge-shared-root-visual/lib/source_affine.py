"""Frozen review helper extraction; no production converter import."""
import ast,copy,hashlib,json,math,re
from pathlib import Path
from PIL import Image
import scene_lib as sl
INDICES = {'west': (3,2,0,1), 'east': (4,5,7,6), 'north': (2,4,6,0),
           'south': (5,3,1,7), 'up': (3,5,4,2), 'down': (0,6,7,1)}

def read(p): return json.loads(Path(p).read_text())

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def write(p,obj): Path(p).write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')

def add(a,b): return [x+y for x,y in zip(a,b)]

def editor(p): return [-p[0],p[1],p[2]]

def rotate(p,r,pivot):
    x,y,z = [a-b for a,b in zip(p,pivot)]
    for axis,deg in enumerate(r):
        c,s=math.cos(math.radians(deg)),math.sin(math.radians(deg))
        if axis==0: y,z=y*c-z*s,y*s+z*c
        elif axis==1: x,z=x*c+z*s,-x*s+z*c
        else: x,y=x*c-y*s,x*s+y*c
    return add([x,y,z],pivot)

def erotation(r): return [-r[0],-r[1],r[2]]

def number(v,t):
    if isinstance(v,(int,float)): return v
    m=re.fullmatch(r'math\.sin\(query\.anim_time \* (\d+(?:\.\d+)?)\) \* (\d+(?:\.\d+)?)',v)
    assert m,('unsupported source expression',v)
    return math.sin(math.radians(t*float(m[1])))*float(m[2])

def easing(kind,u,args):
    if kind is None: return u
    if u>=1: return 1
    if kind=='easeInElastic':
        amount=args[0] if args else 1
        return 1-math.cos(u*math.pi/2)**3*math.cos(u*amount*math.pi)
    assert kind=='easeInBounce',kind
    amount=args[0] if args else .5
    return min(121/16*u*u,121/4*amount*(u-6/11)**2+1-amount,
               121*amount**2*(u-9/11)**2+1-amount**2,
               484*amount**3*(u-10.5/11)**2+1-amount**3)

def sample(ch,t,default):
    if ch is None: return list(default)
    if isinstance(ch,dict) and 'vector' in ch: return sample(ch['vector'],t,default)
    if isinstance(ch,(int,float)): return [ch]*3
    if isinstance(ch,list): return [number(v,t) for v in ch]
    keys=sorted((float(k),v) for k,v in ch.items())
    if t<=keys[0][0]: return sample(keys[0][1],t,default)
    if t>=keys[-1][0]: return sample(keys[-1][1],t,default)
    for (ta,a),(tb,b) in zip(keys,keys[1:]):
        if ta<=t<=tb:
            u=easing(b.get('easing'),(t-ta)/(tb-ta),b.get('easingArgs',[]))
            return [x+(y-x)*u for x,y in zip(sample(a,t,default),sample(b,t,default))]
    raise AssertionError('unreachable')

def posed(p,bone,bones,clip,t):
    while bone is not None:
        b=bones[bone]; tr=clip.get('bones',{}).get(bone,{})
        pivot=editor(b.get('pivot',[0,0,0]))
        scale=sample(tr.get('scale'),t,[1,1,1])
        p=[pivot[i]+(p[i]-pivot[i])*scale[i] for i in range(3)]
        angle=add(b.get('rotation',[0,0,0]),sample(tr.get('rotation'),t,[0,0,0]))
        p=add(rotate(p,erotation(angle),pivot),editor(sample(tr.get('position'),t,[0,0,0])))
        bone=b.get('parent')
    return p

def cube_vertices(c):
    assert not c.get('mirror') and not c.get('inflate') and isinstance(c['uv'],dict)
    o=c['origin']; size=c['size']; x0=-(o[0]+size[0]);x1=x0+size[0];y0,z0=o[1:];y1=y0+size[1];z1=z0+size[2]
    return [[x0,y0,z0],[x0,y0,z1],[x0,y1,z0],[x0,y1,z1],
            [x1,y1,z0],[x1,y1,z1],[x1,y0,z0],[x1,y0,z1]]

def face_corners(c,ratio):
    for side,f in c['uv'].items():
        assert not f.get('uv_rotation'), 'Source appliance faces have no rotated UVs'
        u,v=f['uv'];du,dv=f['uv_size']
        uv=[(u+du,v),(u,v),(u,v+dv),(u+du,v+dv)]
        yield side,INDICES[side],[[x*ratio[0],y*ratio[1]] for x,y in uv]

def selected(phase,count,bone,index):
    if bone not in ('drity_dish','clear_dish'): return True
    if bone=='drity_dish' and phase!=2: return False
    if bone=='clear_dish' and phase not in (4,5): return False
    return count>0 and (count>=3 or index in ([2] if count==1 else [2,5]))

def source_mesh(scene,g,clip,t,texture,off,name,phase=None,count=0):
    """Keep source parent/child group connections; bake S/R/T into mesh corners.
    Group rotations are zero after the affine bake, preventing a second transform.
    Original pivots/parent links and sampled channels remain in the manifest.
    """
    root=scene.group(name,off);tex=scene.texture(texture);w,h=Image.open(texture).size
    ratio=[w/g['description']['texture_width'],h/g['description']['texture_height']]
    bones={b['name']:b for b in g['bones']};nodes={};samples={};used=[]
    for b in g['bones']:
        assert not b.get('mirror') and not b.get('inflate')
        nodes[b['name']]=scene.group(b['name'],off,parent=nodes.get(b.get('parent'),root))
        samples[b['name']]={'parent':b.get('parent'),'authored_pivot':b.get('pivot',[0,0,0]),
                           'channels':{k:sample(clip.get('bones',{}).get(b['name'],{}).get(k),t,d)
                                       for k,d in [('position',[0]*3),('rotation',[0]*3),('scale',[1]*3)]}}
        for ci,c in enumerate(b.get('cubes',[]),1):
            if phase is not None and not selected(phase,count,b['name'],ci): continue
            verts=[add(posed(rotate(v,erotation(c.get('rotation',[0]*3)),editor(c.get('pivot',[0]*3))),b['name'],bones,clip,t),off) for v in cube_vertices(c)]
            faces={}
            for side,ids,uv in face_corners(c,ratio):
                p,q,r=[verts[j] for j in ids[:3]];v=[q[i]-p[i] for i in range(3)];z=[r[i]-p[i] for i in range(3)]
                area=sum(x*x for x in (v[1]*z[2]-v[2]*z[1],v[2]*z[0]-v[0]*z[2],v[0]*z[1]-v[1]*z[0]))
                if area<1e-20: continue
                faces[side]={'vertices':[f'v{i}' for i in ids],'uv':{f'v{i}':p for i,p in zip(ids,uv)},'texture':tex}
            uid=sl.uid();scene.j['elements'].append({'name':f'{b["name"]} original cube {ci}','uuid':uid,'type':'mesh',
                'origin':[0,0,0],'rotation':[0,0,0],'vertices':{f'v{i}':v for i,v in enumerate(verts)},
                'faces':faces,'visibility':True,'export':True})
            nodes[b['name']]['children'].append(uid);used.append({'bone':b['name'],'cube':ci,'faces':len(faces)})
    return {'bone_hierarchy':samples,'drawn_cubes':used,'png_dimensions':[w,h],
            'virtual_uv_dimensions':[g['description']['texture_width'],g['description']['texture_height']],'pixel_uv_ratio':ratio}

def expression(text,states):
    text=re.sub(r"q\.block_state\('([^']+)'\)",lambda m:repr(states[m[1]]),text)
    text=text.replace('&&',' and ').replace('||',' or ')
    text=re.sub(r'\btrue\b','True',text);text=re.sub(r'\bfalse\b','False',text)
    tree=ast.parse(text,mode='eval')
    allowed=(ast.Expression,ast.BoolOp,ast.And,ast.Or,ast.BinOp,ast.Add,ast.Mult,ast.Compare,ast.Eq,ast.GtE,ast.LtE,ast.Gt,ast.Lt,ast.Constant,ast.UnaryOp,ast.USub)
    assert all(isinstance(n,allowed) for n in ast.walk(tree)),text
    return eval(compile(tree,'<verified-state-expression>','eval'),{'__builtins__':{}},{})

def binding(root,block,states):
    d=read(root/f'runtime/BP/blocks/{block}.json')['minecraft:block'];c=copy.deepcopy(d['components'])
    for p in d['permutations']:
        if expression(p['condition'],states): c.update(p['components'])
    g=c['minecraft:geometry'];gid=g if isinstance(g,str) else g['identifier']
    path=root/'runtime/RP/models/blocks'/f'{gid.removeprefix("geometry.ordertocook.")}.geo.json'
    assert read(path)['minecraft:geometry'][0]['description']['identifier']==gid
    tex=read(root/'runtime/RP/textures/terrain_texture.json')['texture_data']
    mats=c['minecraft:material_instances'];texture_map={k:root/'runtime/RP'/(tex[v['texture']]['textures']+'.png') for k,v in mats.items()}
    visible={} if isinstance(g,str) else {k:expression(v,states) if isinstance(v,str) else v for k,v in g.get('bone_visibility',{}).items()}
    return path,texture_map,visible,c

def canonical(scene,path,textures,visibility,off,name):
    groups=len(scene.j['groups']);elements=len(scene.j['elements'])
    scene.bedrock(path,textures,off,name=name)
    for g in scene.j['groups'][groups:]:
        if not visibility.get(g['name'],True):g['visibility']=False
    for e in scene.j['elements'][elements:]:
        for bone,show in visibility.items():
            if not show and e['name'].startswith(bone+'_'):e['visibility']=False
