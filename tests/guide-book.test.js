// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {
  GUIDE_CHAPTERS, GUIDE_PAGE_STEPS, guideBookScreen, guidePageCount
} from '../runtime/BP/scripts/guide_book.js';

const paths = new URL('../runtime/RP/', import.meta.url);
const parseLanguage = language => {
  const file = new URL('texts/' + language + '.lang', paths);
  const result = new Map();
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('='), key = line.slice(0, i), value = line.slice(i + 1);
    assert.ok(!result.has(key), `Duplicate ${language} translation: ${key}`);
    result.set(key, value);
  }
  return result;
};
const languages = ['zh_TW','zh_CN','en_US'];
const keys = new Set();
function translationsFrom(message) {
  if (!message) return;
  if ('translate' in message) keys.add(message.translate);
  for (const part of message.rawtext || []) translationsFrom(part);
}
function validateScreen(screen) {
  assert.ok(screen?.title?.rawtext && screen?.body?.rawtext, 'Localized handbook screen required');
  translationsFrom(screen.title);
  translationsFrom(screen.body);
  assert.ok(screen.buttons.length >= 2 && screen.buttons.length <= 10);
  for (const entry of screen.buttons) {
    translationsFrom(entry.label);
    if (!entry.icon) continue;
    assert.match(entry.icon, /^textures\//);
    if (entry.icon.startsWith('textures/ordertocook/')) {
      assert.ok(existsSync(new URL(entry.icon + '.png', paths)), `Missing icon ${entry.icon}`);
    }
  }
}
function chapterRoute(chapter) {return {kind:'chapter',chapter:chapter.id};}
function groupRoute(chapter,group) {return {kind:'group',chapter:chapter.id,group:group.id};}
function pageRoute(chapter,group,page) {return {kind:'page',chapter:chapter.id,group:group.id,page};}
function navigate(screen,index) {
  const action=screen.buttons[index]?.action;
  assert.equal(action?.kind,'goto');
  return action.view;
}

test('existing OTC book has six independent chapters and chapter/topic/entry navigation', () => {
  assert.equal(GUIDE_CHAPTERS.length,6);
  assert.equal(guidePageCount(),26);
  assert.equal(GUIDE_PAGE_STEPS,3);
  const chapterIds=new Set(),groupIds=new Set(),pageIds=new Set();
  for(const chapter of GUIDE_CHAPTERS){
    assert.ok(!chapterIds.has(chapter.id)); chapterIds.add(chapter.id);
    assert.ok(chapter.groups.length>=2);
    for(const group of chapter.groups){
      assert.ok(!groupIds.has(group.id));groupIds.add(group.id);
      assert.ok(group.pages.length>=2);
      for(const id of group.pages){assert.ok(!pageIds.has(id));pageIds.add(id);}
    }
  }
  const home=guideBookScreen();
  validateScreen(home);
  assert.equal(home.buttons.length,8);
  assert.equal(home.buttons.at(-1).action.kind,'close');
  assert.deepEqual(navigate(home,0),{kind:'chapter',chapter:'start'});
  assert.equal(guideBookScreen({kind:'unknown'}).buttons.length,8);
});

test('all pages, counts and navigation paths are reachable without Cookery screens', () => {
  const visited = new Set();
  for(const chapter of GUIDE_CHAPTERS){
    const root=guideBookScreen(chapterRoute(chapter));
    validateScreen(root);
    assert.equal(root.buttons.length, chapter.groups.length+2);
    for(const group of chapter.groups){
      const sub=guideBookScreen(groupRoute(chapter,group));
      validateScreen(sub);
      assert.equal(sub.buttons.length,group.pages.length+3);
      for(let i=0;i<group.pages.length;i++){
        const id=group.pages[i];
        visited.add(id);
        const page=guideBookScreen(pageRoute(chapter,group,id));
        validateScreen(page);
        const buttonKinds=page.buttons.map(b=>b.action.kind);
        assert.ok(buttonKinds.includes('goto'));
        assert.equal(buttonKinds.at(-1),'close');
        assert.equal(buttonKinds.filter(k=>k==='goto').length,2+(i>0?1:0)+(i<group.pages.length-1?1:0));
        const first=page.buttons.find(b=>b.action.kind==='goto');
        assert.ok(first);
        assert.ok(JSON.stringify(page.body).includes('otc.guide.page.'+id+'.step3'));
      }
    }
  }
  assert.equal(visited.size,26);
  for(const language of languages){
    const map=parseLanguage(language);
    for(const key of keys) {
      assert.ok(map.has(key),`Missing ${language}: ${key}`);
      assert.ok(map.get(key).trim(),`Empty ${language}: ${key}`);
    }
  }
});

test('book menu opens in its own item and icon; never adds a second Cookery guide', () => {
  const item=JSON.parse(readFileSync(new URL('BP/items/guide.json',new URL('../runtime/',import.meta.url)), 'utf8'));
  assert.equal(item['minecraft:item'].description.identifier,'ordertocook:guide');
  const textures=JSON.parse(readFileSync(new URL('textures/item_texture.json',paths),'utf8'));
  assert.equal(textures.texture_data.ordertocook_guide.textures,'textures/items/book_normal');
  const recipe=JSON.parse(readFileSync(new URL('BP/recipes/guide.json',new URL('../runtime/',import.meta.url)), 'utf8'));
  assert.equal(recipe['minecraft:recipe_shaped'].result.item,'ordertocook:guide');
  assert.deepEqual(recipe['minecraft:recipe_shaped'].pattern,['BP']);
  assert.equal(readFileSync(new URL('../runtime/BP/scripts/main.js',import.meta.url),'utf8').includes(
    "itemStack?.typeId === 'ordertocook:guide'"),true);
  const combined=JSON.stringify(GUIDE_CHAPTERS);
  assert.doesNotMatch(combined,/kaleidoscope_cookery|cookery:guide|guidebook_extension/);
});

test('administrator actions are contextual and never exposed to regular players', () => {
  const chapter=GUIDE_CHAPTERS.find(x=>x.id==='progress');
  const group=chapter.groups.find(x=>x.id==='achievements');
  const page=pageRoute(chapter,group,'advanced_admin');
  assert.equal(guideBookScreen(page,false).buttons.some(x=>x.action.kind==='test_kit'),false);
  assert.equal(guideBookScreen(page,true).buttons.some(x=>x.action.kind==='test_kit'),true);
  const progress=guideBookScreen(pageRoute(chapter,group,'progress_tracker'));
  assert.equal(progress.buttons[0].action.kind,'progress');
  const about=guideBookScreen(pageRoute(chapter,chapter.groups[1],'limitations'));
  assert.equal(about.buttons[0].action.kind,'about');
});
