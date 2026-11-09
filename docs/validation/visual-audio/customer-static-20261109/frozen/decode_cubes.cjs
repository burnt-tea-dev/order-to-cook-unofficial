// Official Blockbench 5.2.2 parseCube in a minimal data-only harness. No GUI.
const fs=require('fs'),vm=require('vm'),path=require('path');
const s=fs.readFileSync(path.join(__dirname,'official-source/js__formats__bedrock__bedrock.js.txt'),'utf8');
const start=s.indexOf('function parseCube('),end=s.indexOf('\n\tfunction parseBone(',start);
if(start<0||end<0)throw Error('parseCube boundaries');
function vec(v=[0,0,0]){let a=v.slice();a.V3_set=function(x){x.forEach((v,i)=>this[i]=v)};return a;}
class Cube{constructor(d){this.from=vec();this.to=vec();this.origin=vec(d.origin);this.rotation=vec(d.rotation);this.faces={};for(let k of ['north','east','south','west','up','down']){let f={uv:[0,0,16,16],texture:false,rotation:0,extend(x){if(x.uv)this.uv=x.uv.slice();if(x.rotation!==undefined)this.rotation=x.rotation}};Object.defineProperty(f,'uv_size',{set(x){this.uv[2]=this.uv[0]+x[0];this.uv[3]=this.uv[1]+x[1]}});this.faces[k]=f;}}addTo(){return this}init(){return this}mapAutoUV(){throw Error('unexpected implicit UV')}}
const c={Cube};vm.createContext(c);vm.runInContext(s.slice(start,end)+'\nthis.decode=parseCube;',c);
const data=JSON.parse(fs.readFileSync(0,'utf8')),output=[];
for(let b of data.bones)for(let [i,q]of(b.cubes||[]).entries()){
 let d=c.decode(q,{name:b.name,color:0,mirror_uv:false},b);output.push({bone:b.name,cube:i,from:d.from,to:d.to,origin:d.origin,rotation:d.rotation,inflate:d.inflate||0,faces:Object.fromEntries(Object.entries(d.faces).map(([k,v])=>[k,{uv:v.uv,rotation:v.rotation,texture:v.texture===null?null:0}]))});
}
process.stdout.write(JSON.stringify(output));
