# SPDX-License-Identifier: GPL-3.0-only
"""Independent bounded reader and physical-corner oracle for the pinned Java model.
See docs/MOTORCYCLE_SOURCE_MAPPING.md for coordinate and UV authority/limits.
No production converter is imported here. Authored zero dimensions and inflation
are retained; editor-only .001 plane expansion and 1/64 UV inset are not applied.
"""
import re, json, math, itertools
def args(s):
 out=[];depth=0;start=0
 for i,c in enumerate(s):
  depth+= (c=='(')-(c==')')
  if c==',' and depth==0:out.append(s[start:i].strip());start=i+1
 assert depth==0
 return out+[s[start:].strip()]
def call(s,i):
 assert s[i]=='(';start=i+1;d=1;i+=1
 while d:
  d+=(s[i]=='(')-(s[i]==')');i+=1
 return s[start:i-1],i
num=lambda s:float(s.strip().rstrip('Ff'))
def parse_java(text):
 section=text.split('PartDefinition partdefinition = meshdefinition.getRoot();')[1].split('return LayerDefinition.create')[0]
 bones=[]
 for stmt in section.split(';'):
  stmt=stmt.strip()
  if not stmt:continue
  prefix,tail=stmt.split('.addOrReplaceChild',1);parent=prefix.split()[-1]
  inside,end=call(tail,0);assert end==len(tail)
  name,builder,pose=args(inside);name=json.loads(name)
  assert builder.startswith('CubeListBuilder.create()');builder=builder[len('CubeListBuilder.create()'):]
  cubes=[]
  while builder:
   assert builder.startswith('.texOffs('),builder
   uv,j=call(builder,len('.texOffs'));uv=list(map(num,args(uv)));builder=builder[j:]
   assert builder.startswith('.addBox('),builder
   cube,j=call(builder,len('.addBox'));vals=args(cube);assert len(vals)==7
   assert vals[-1].startswith('new CubeDeformation(')
   inflate,jj=call(vals[-1],len('new CubeDeformation'));assert jj==len(vals[-1])
   cubes.append(dict(origin=list(map(num,vals[:3])),size=list(map(num,vals[3:6])),uv=uv,inflate=num(inflate)))
   builder=builder[j:].strip()
  typ=pose.split('(')[0];assert typ in ['PartPose.offset','PartPose.offsetAndRotation']
  pp,j=call(pose,len(typ));assert j==len(pose)
  pp=list(map(num,args(pp)));assert len(pp)==(3 if typ.endswith('offset') else 6)
  bones.append(dict(name=name,parent=None if parent=='partdefinition' else parent,offset=pp[:3],rotation=pp[3:] or [0,0,0],cubes=cubes))
 assert [len(b['cubes']) for b in bones]==[5,2,1,1,1,1,5,1,1,1,1,1,5,5,5,5]
 assert len(bones)==16
 return {b["name"]: b for b in bones}
def add(a,b):return [x+y for x,y in zip(a,b)]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def rot(p,r):
 x,y,z=p
 for axis,t in enumerate(r):
  c,s=math.cos(t),math.sin(t)
  if axis==0:y,z=c*y-s*z,s*y+c*z
  if axis==1:x,z=c*x+s*z,-s*x+c*z
  if axis==2:x,y=c*x-s*y,s*x+c*y
 return [x,y,z]
def jworld(J,n,p):
 b=J[n];p=add(rot(p,b['rotation']),b['offset'])
 return jworld(J,b['parent'],p) if b['parent'] else [p[0],24-p[1],p[2]]
def rpworld(B,n,p):
 b=B[n];pv=[-b['pivot'][0],*b['pivot'][1:]];rx,ry,rz=b.get('rotation',[0,0,0]);r=list(map(math.radians,[-rx,-ry,rz]))
 p=add(rot(sub(p,pv),r),pv)
 return rpworld(B,b['parent'],p) if b.get('parent') else p
# Explicit Cube vertex topology, indices 0..7 correspond to ModelPart var4..var11.
JV=[(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]
# BB setShape corner order, verified against official-source/three_custom lines3..49.
BV={'east':[(1,1,1),(1,1,0),(1,0,1),(1,0,0)],'west':[(0,1,0),(0,1,1),(0,0,0),(0,0,1)],'up':[(0,1,0),(1,1,0),(0,1,1),(1,1,1)],'down':[(0,0,1),(1,0,1),(0,0,0),(1,0,0)],'south':[(0,1,1),(1,1,1),(0,0,1),(1,0,1)],'north':[(1,1,0),(0,1,0),(1,0,0),(0,0,0)]}
def jfaces(c):
 u,v=c['uv'];w,h,d=c['size'];a=u;b=u+d;cc=u+d+w;dd=u+d+2*w;e=u+2*d+w;f=u+2*d+2*w
 # Java y-down DOWN becomes physical BB UP; other face labels stay.
 polys={'up':([5,4,0,1],[b,v,cc,v+d]),'down':([2,3,7,6],[cc,v+d,dd,v]),'west':([0,4,7,3],[a,v+d,b,v+d+h]),'north':([1,0,3,2],[b,v+d,cc,v+d+h]),'east':([5,1,2,6],[cc,v+d,e,v+d+h]),'south':([4,5,6,7],[e,v+d,f,v+d+h])}
 out={}
 for face,(ids,(u1,v1,u2,v2)) in polys.items():
  uv=[(u2,v1),(u1,v1),(u1,v2),(u2,v2)]
  pairs={tuple([JV[i][0],1-JV[i][1],JV[i][2]]):list(q) for i,q in zip(ids,uv)}
  out[face]=[pairs[k] for k in BV[face]]
 return out
def rpfaces(c):
 u,v=c['uv'];w,h,d=c['size']
 # Official Blockbench box-UV layout, then physical horizontal mirror.
 rr={'east':[u,v+d,u+d,v+d+h],'west':[u+d+w,v+d,u+2*d+w,v+d+h],'up':[u+d+w,v+d,u+d,v],'down':[u+d+2*w,v,u+d+w,v+d],'south':[u+2*d+w,v+d,u+2*d+2*w,v+d+h],'north':[u+d,v+d,u+d+w,v+d+h]}
 if c.get('mirror',False):
  rr={f:[q[2],q[1],q[0],q[3]] for f,q in rr.items()}
  rr['east'],rr['west']=rr['west'],rr['east']
 return {f:[[a,b],[c,b],[a,d],[c,d]] for f,(a,b,c,d) in rr.items()}
def bbrect(q):
 a,b=q[0];c,d=q[3];assert q==[[a,b],[c,b],[a,d],[c,d]]
 return [a,b,c,d]

def compare(text, geometry, expected_offsets=None):
 # Explicit caller-supplied model-space adaptations; default remains exact Java.
 # Do not conceal them inside the source parser or physical-corner oracle.
 if expected_offsets:
  import copy
  geometry=copy.deepcopy(geometry)
  lookup={b['name']:b for b in geometry['minecraft:geometry'][0]['bones']}
  for (bone,index),offset in expected_offsets.items():
   cube=lookup[bone]['cubes'][index]
   cube['origin']=[a-b for a,b in zip(cube['origin'],offset)]
 J=parse_java(text); B={b['name']:b for b in geometry['minecraft:geometry'][0]['bones']}
 assert list(J)==list(B), 'bone identities'
 corner_max=uv_max=0; bad_corners=bad_uv=0
 for n,j in J.items():
  b=B[n]; assert b.get('parent')==j['parent'], n
  assert len(j['cubes'])==len(b['cubes']), n
  for jc,bc in zip(j['cubes'],b['cubes']):
   assert jc['size']==bc['size'] and jc['uv']==bc['uv'], n
   assert jc['inflate']==bc.get('inflate',0), n
   inf=jc['inflate']; sz=jc['size']; lo=[-bc['origin'][0]-sz[0],*bc['origin'][1:]]
   err=0
   for bits in itertools.product([0,1],repeat=3):
    jp=[jc['origin'][a]+sz[a]*bits[a]+inf*(2*bits[a]-1) for a in range(3)]
    rb=[bits[0],1-bits[1],bits[2]]
    bp=[lo[a]+sz[a]*rb[a]+inf*(2*rb[a]-1) for a in range(3)]
    err=max(err,math.dist(jworld(J,n,jp),rpworld(B,n,bp)))
   jf,bf=jfaces(jc),rpfaces(bc)
   uv=max(abs(x-y) for f in BV for a,b in zip(jf[f],bf[f]) for x,y in zip(a,b))
   corner_max=max(corner_max,err); uv_max=max(uv_max,uv)
   bad_corners+=err>1e-5; bad_uv+=uv>0
 return dict(max_corner_distance=corner_max,max_uv_residual_pixels=uv_max,
             affected_corner_boxes=bad_corners,uv_changed_boxes=bad_uv)


def verify_scene_graph(scene, java, bedrock):
    """Evaluate the serialized UUID hierarchy, never substitute name-based parents.

    Names identify oracle boxes only after the actual outliner graph is decoded.
    Shared group/cube IDs, duplicate references, missing nodes and wrong parent
    identities all fail, including when neutral rotations could conceal them.
    """
    elements = {e['uuid']: e for e in scene['elements']}
    groups = {g['uuid']: g for g in scene['groups']}
    identifiers = [e['uuid'] for e in scene['elements'] + scene['groups']]
    assert len(identifiers) == len(set(identifiers)), 'cross-kind UUID collision'
    parents = {}

    def visit(nodes, parent=None):
        for node in nodes:
            identifier = node if isinstance(node, str) else node['uuid']
            assert identifier not in parents, 'repeated outliner reference'
            parents[identifier] = parent
            if isinstance(node, str):
                assert identifier in elements, 'missing cube'
            else:
                assert identifier in groups, 'missing group'
                visit(node['children'], identifier)

    visit(scene['outliner'])
    assert set(parents) == set(identifiers), 'missing/unreferenced nodes'

    def world(identifier, point):
        parent = parents[identifier]
        if parent is None:
            return point
        group = groups[parent]
        pivot = group['origin']
        point = add(rot(sub(point, pivot), list(map(math.radians, group['rotation']))), pivot)
        return world(parent, point)

    for identifier, group in groups.items():
        label, name = group['name'].rsplit(' ', 1)
        parent_name = java[name]['parent']
        actual_parent = parents[identifier]
        assert (groups[actual_parent]['name'] if actual_parent else None) == (
            label + ' ' + parent_name if parent_name else None), 'wrong serialized group parent'

    max_error = 0
    for identifier, element in elements.items():
        label, name, index = element['name'].rsplit(' ', 2)
        assert groups[parents[identifier]]['name'] == label + ' ' + name, 'wrong cube parent'
        index = int(index.removeprefix('cube'))
        source = label == 'JAVA SOURCE'
        cube = java[name]['cubes'][index] if source else bedrock[name]['cubes'][index]
        assert element['rotation'] == [0, 0, 0]
        for bits in itertools.product([0, 1], repeat=3):
            point = [element['from'][a] if bits[a] == 0 else element['to'][a] for a in range(3)]
            point = [point[a] + element.get('inflate', 0) * (2*bits[a]-1) for a in range(3)]
            actual = world(identifier, point)
            if source:
                java_bits = [bits[0], 1-bits[1], bits[2]]
                local = [cube['origin'][a] + cube['size'][a]*java_bits[a] +
                         cube['inflate']*(2*java_bits[a]-1) for a in range(3)]
                expected = jworld(java, name, local)
                expected[0] -= 20
            else:
                low = [-cube['origin'][0]-cube['size'][0], *cube['origin'][1:]]
                local = [low[a] + cube['size'][a]*bits[a] +
                         cube.get('inflate', 0)*(2*bits[a]-1) for a in range(3)]
                expected = rpworld(bedrock, name, local)
                expected[0] += 20
            max_error = max(max_error, math.dist(actual, expected))
    assert max_error < 1e-5, max_error
    return {'serialized_graph_max_corner_residual': max_error,
            'unique_nodes': len(identifiers), 'corner_checks': 8*len(elements)}
