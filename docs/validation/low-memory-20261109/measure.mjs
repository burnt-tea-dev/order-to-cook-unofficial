import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// Both roots must contain complete, separately materialized source trees.
// This performs API-double and synthetic Node measurements, never native QA.
if (process.argv.length < 4) throw Error('Usage: node measure.mjs BASELINE_ROOT CANDIDATE_ROOT [RESULT_JSON]');
const baseline = resolve(process.argv[2]);
const candidate = resolve(process.argv[3]);
const output = process.argv[4] || 'low-memory-results.json';
const sourceHashes = Object.fromEntries([['baseline', baseline], ['candidate', candidate]].map(([name, root]) => [name, Object.fromEntries(['runtime/BP/scripts/dining.js', 'runtime/BP/scripts/core.js', 'runtime/BP/scripts/appliances.js', 'runtime/BP/scripts/entities.js', 'tests/appliances.harness.js'].map(p => [p, createHash('sha256').update(readFileSync(root + '/' + p)).digest('hex')]))]));
const load = (root,p) => import(pathToFileURL(root+'/'+p));
const mods={baseline:await load(baseline,'runtime/BP/scripts/dining.js'),candidate:await load(candidate,'runtime/BP/scripts/dining.js')};
const h=await load(candidate,'tests/appliances.harness.js');
const hb=await load(baseline,'tests/appliances.harness.js');
let rng=80261109; const random=()=>((rng=Math.imul(rng,1664525)+1013904223>>>0)/2**32); const rand=n=>Math.floor(random()*n);
const dim='minecraft:overworld';
function meal(id,loc={x:id+0.5,y:1.0125,z:0.5}) {return {id:String(id),token:String(id),version:2,dimensionId:dim,location:loc,startedAt:100,finishAt:5600,status:'dirty',reactionPending:false};}
function setup(create,R,M,count=false) {
 let reads=0,visits=0; const restaurants=new Map();
 for(let r=0;r<R;r++) {const list=[];for(let i=r;i<M;i+=R) list.push(meal(i));const dishes=count?new Proxy(list,{get(t,k,rec){if(typeof k==='string'&&/^\d+$/.test(k))reads++;return Reflect.get(t,k,rec);}}):list;restaurants.set(String(r),{id:String(r),pendingDishes:dishes});}
 const ctx={system:{currentTick:0},world:{},restaurants:()=>({*[Symbol.iterator](){for(const r of restaurants.values()){visits++;yield r;}}})};
 return {service:create(ctx),ctx,restaurants,counts:()=>({reads,visits})};
}
const matrix=[];
for(const [R,M,P] of [[1,80,32],[8,800,64],[32,3200,256],[3200,3200,32],[1,3200,1]]) {
 const row={R,M,P};
 for(const name of ['baseline','candidate']) {const f=setup(mods[name].createDiningService,R,M,true);for(let p=0;p<P;p++){const i=p%M;assert.equal(f.service.atBlock({typeId:mods[name].DINING_BLOCK,dimension:{id:dim},location:{x:i,y:1,z:0}})?.meal.id,String(i));}row[name]=f.counts();}
 assert.equal(row.baseline.reads,P*M); assert.equal(row.candidate.reads,M);assert.equal(row.baseline.visits,R*P); assert.equal(row.candidate.visits,R*P);matrix.push(row);
}
let differential=0;
for(let round=0;round<100;round++) {
 const records=new Map();const ctx={system:{currentTick:0},world:{},restaurants:()=>[...records.values()]};
 for(let r=0;r<8;r++){const dishes=[];for(let j=0;j<40;j++){const m=meal(`${r}:${j}`,{x:rand(7)-3+0.5,y:rand(3)+0.01,z:rand(7)-3+0.5});m.dimensionId=['minecraft:overworld','minecraft:nether','minecraft:the_end'][rand(3)];m.startedAt=rand(4);m.status=['eating','dirty','claiming'][rand(3)];if(rand(15)===0)m.location.x=NaN;if(rand(15)===0)m.finishAt=Infinity;dishes.push(m);}records.set(String(r),{id:String(r),pendingDishes:dishes});}
 const a=mods.baseline.createDiningService(ctx),b=mods.candidate.createDiningService(ctx);
 for(let step=0;step<20;step++) {
  const r=records.get(String(rand(8)));if(r){switch(step%5){case 0:r.pendingDishes.push(meal(`new-${step}`));break;case 1:r.pendingDishes.pop();break;case 2:r.pendingDishes=[...r.pendingDishes].reverse();break;case 3:records.set(r.id,{...r,pendingDishes:r.pendingDishes.map(m=>({...m}))});break;case 4:ctx.system.currentTick++;break;}}
  if(step===10)delete ctx.system;if(step===11)ctx.system={currentTick:99};
  for(let q=0;q<40;q++){const block={typeId:q%2?'minecraft:stone':mods.candidate.DINING_BLOCK,dimension:{id:['minecraft:overworld','minecraft:nether','minecraft:the_end'][rand(3)]},location:{x:rand(7)-3,y:rand(3),z:rand(7)-3}};const support=q%3===0?false:q%3===1?true:undefined;const av=a.atBlock(block,support),bv=b.atBlock(block,support);assert.equal(bv?.restaurant,av?.restaurant);assert.equal(bv?.meal,av?.meal);differential++;}
 }
}
const customerCounts={};
for(const [name,harness] of [['baseline',hb],['candidate',h]]) {
 const env=harness.makeEnvironment();const entities=harness.entityServices.createEntityService(env.ctx);env.ctx.resumeCustomerMeal=(...args)=>entities.resumeCustomerMeal(...args);
 const r={id:'r',orders:[],pendingDishes:Array.from({length:80},(_,i)=>meal(i))};env.restaurants.set(r.id,r);
 let queries=0;const gd=env.world.getDimension.bind(env.world);env.world.getDimension=id=>{const d=gd(id);return {...d,getEntities:options=>{if(options.type==='ordertocook:customer')queries++;return d.getEntities(options);}};};
 const service=mods[name].createDiningService(env.ctx);service.tick(6000);queries=0;service.tick(6250);customerCounts[name]=queries;
 for(const m of r.pendingDishes)m.reactionPending=undefined;queries=0;service.tick(6500);customerCounts[name+'LegacyUnknown']=queries;
}
assert.equal(customerCounts.baseline,240);assert.equal(customerCounts.candidate,0);assert.equal(customerCounts.candidateLegacyUnknown,240);
const previewCounts={};for(const [name,harness] of [['baseline',hb],['candidate',h]]){const env=harness.makeEnvironment();let reads=0;env.world.getAllPlayers=()=>{reads++;return [];};const service=harness.appliances.createApplianceService(env.ctx);for(let t=0;t<100;t+=2){env.system.currentTick=t;service.tick();}previewCounts[name]=reads;}assert.equal(previewCounts.baseline,50);assert.equal(previewCounts.candidate,0);
const timing=[];for(const [R,M,P] of [[1,80,32],[8,800,64],[32,3200,256],[3200,3200,32],[1,3200,1]]){const row={R,M,P,baseline:[],candidate:[]};for(let rep=0;rep<6;rep++)for(const name of (rep%2?['candidate','baseline','baseline','candidate']:['baseline','candidate','candidate','baseline'])){const f=setup(mods[name].createDiningService,R,M);const blocks=Array.from({length:P},(_,p)=>({typeId:mods[name].DINING_BLOCK,dimension:{id:dim},location:{x:p%M,y:1,z:0}}));for(let t=0;t<3;t++){f.ctx.system.currentTick++;for(const b of blocks)f.service.atBlock(b);}const start=performance.now();for(let t=0;t<10;t++){f.ctx.system.currentTick++;for(const b of blocks)assert.ok(f.service.atBlock(b));}row[name].push((performance.now()-start)/10);}for(const name of ['baseline','candidate']){const s=[...row[name]].sort((a,b)=>a-b);row[name+'MedianMs']=+(s[s.length/2-1]/2+s[s.length/2]/2).toFixed(4);}timing.push(row);}
const result={sourceHashes,runtime:process.version,scope:'Node V8 synthetic formal-function/API-double testing, not BDS, client, phone, RSS/GC or end-to-end gameplay measurements',matrix,differentialComparisons:differential,customerCounts,previewCounts,timing};writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,timing:timing.map(({baseline,candidate,...r})=>r)},null,2));
