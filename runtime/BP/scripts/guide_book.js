// SPDX-License-Identifier: GPL-3.0-only
// Order To Cook's independent handbook. Cookery owns its own guide and is never
// imported, modified, registered with, or needed by this navigation tree.
const I = Object.freeze({
  book: 'textures/items/book_normal',
  order: 'textures/ordertocook/item/order',
  money: 'textures/ordertocook/item/chef_coin_100',
  upgrade: 'textures/ordertocook/item/otc_upgrade_box',
  food: 'textures/ordertocook/item/food_plate',
  clean: 'textures/ordertocook/item/clean_plate',
  bag: 'textures/items/takeout_bag',
  bike: 'textures/items/motorcycle',
  helmet: 'textures/ordertocook/item/delivery_helmet',
  fridge: 'textures/ordertocook/block/refrigerator',
  stove: 'textures/ordertocook/block/stove',
  counter: 'textures/ordertocook/block/countertop64'
});

export const GUIDE_CHAPTERS = Object.freeze([
  { id: 'start', icon: I.book, groups: [
    { id: 'setup', icon: I.order, pages: ['placing_station', 'first_menu'] },
    { id: 'first_shift', icon: I.food, pages: ['first_order', 'guide_access'] }
  ] },
  { id: 'restaurant', icon: I.money, groups: [
    { id: 'menu', icon: I.order, pages: ['menu_design', 'nutrition_variant'] },
    { id: 'order_management', icon: I.food, pages: ['offer_types', 'timers'] },
    { id: 'management', icon: I.money, pages: ['money_upgrades', 'staff'] }
  ] },
  { id: 'kitchen', icon: I.counter, groups: [
    { id: 'preparation', icon: I.food, pages: ['countertop', 'supplies'] },
    { id: 'appliances', icon: I.fridge, pages: ['refrigerator', 'stove'] }
  ] },
  { id: 'dining', icon: I.clean, groups: [
    { id: 'service', icon: I.food, pages: ['customer_delivery', 'dining_plate'] },
    { id: 'washing', icon: I.clean, pages: ['handwashing', 'dishwasher'] }
  ] },
  { id: 'delivery', icon: I.helmet, groups: [
    { id: 'delivery_steps', icon: I.bag, pages: ['bagging', 'navigation'] },
    { id: 'vehicle', icon: I.bike, pages: ['motorcycle', 'storage'] }
  ] },
  { id: 'progress', icon: I.upgrade, groups: [
    { id: 'achievements', icon: I.money, pages: ['progress_tracker', 'advanced_admin'] },
    { id: 'compatibility', icon: I.book, pages: ['senluo_food', 'limitations'] }
  ] }
].map(chapter => Object.freeze({
  ...chapter, groups: Object.freeze(chapter.groups.map(group => Object.freeze({
    ...group, pages: Object.freeze(group.pages)
  })))
})));

export const GUIDE_PAGE_STEPS = 3;
const key = suffix => ({ translate: `otc.guide.${suffix}` });
const message = (...parts) => ({ rawtext: parts.map(part =>
  part.startsWith('@') ? key(part.slice(1)) : { text: part }) });
const view = (kind, chapter, group, page) => ({ kind, ...(chapter ? { chapter } : {}), ...(group ? { group } : {}), ...(page ? { page } : {}) });
const go = next => ({kind: 'goto', view: next});
const other = kind => ({kind});
const entryIcon = id => (
  id.includes('fridge') || id === 'refrigerator' ? I.fridge :
  id === 'stove' ? I.stove :
  id.includes('motorcycle') || id === 'storage' ? I.bike :
  id.includes('supplies') || id.includes('plate') || id.includes('washing') || id === 'dishwasher' ? I.clean :
  id.includes('upgrade') || id === 'advanced_admin' ? I.money :
  id.includes('bag') || id === 'navigation' ? I.bag :
  id.includes('menu') || id === 'offer_types' || id === 'timers' ? I.order : I.food
);
const chapterFor = id => GUIDE_CHAPTERS.find(chapter => chapter.id === id);
const groupFor = (chapter, id) => chapter?.groups.find(group => group.id === id);
const button = (label, action, icon) => ({label, action, ...(icon ? {icon} : {})});
const backButton = target => button(key('ui.back'), go(target), I.book);
const homeButton = () => button(key('ui.home'), go(view('home')), I.book);
const closeButton = () => button(key('ui.close'), other('close'));
const countLabel = (keyPath, count) => message('@' + keyPath, '\n§8' + count + ' ', '@ui.pages', '§r');

export const guidePageCount = () => GUIDE_CHAPTERS.reduce((total, chapter) =>
  total + chapter.groups.reduce((sum, group) => sum + group.pages.length, 0), 0);

export function guideBookScreen(route = view('home'), isAdmin = false) {
  if (route.kind === 'chapter') {
    const chapter = chapterFor(route.chapter);
    if (!chapter) return guideBookScreen();
    const index = GUIDE_CHAPTERS.indexOf(chapter);
    const groups = chapter.groups;
    const buttons = groups.map(group => button(countLabel(`group.${group.id}.title`, group.pages.length),
      go(view('group', chapter.id, group.id)), group.icon));
    buttons.push(homeButton(), closeButton());
    return {
      title: message('§6', '@chapter.' + chapter.id + '.title', ` §8(${index + 1}/${GUIDE_CHAPTERS.length})§r`),
      body: message('§7', '@chapter.' + chapter.id + '.summary', '\n\n§8', '@ui.choose_group', '§r'),
      buttons
    };
  }
  if (route.kind === 'group') {
    const chapter = chapterFor(route.chapter), group = groupFor(chapter, route.group);
    if (!group) return guideBookScreen();
    const buttons = group.pages.map((id, index) => button(
      message('§e' + (index + 1) + '. §r', '@page.' + id + '.title'),
      go(view('page', chapter.id, group.id, id)), entryIcon(id)));
    buttons.push(backButton(view('chapter', chapter.id)), homeButton(), closeButton());
    return {
      title: message('§6', '@group.' + group.id + '.title'),
      body: message('§7', '@group.' + group.id + '.summary', '\n\n§8', '@ui.choose_page', '§r'),
      buttons
    };
  }
  if (route.kind === 'page') {
    const chapter = chapterFor(route.chapter), group = groupFor(chapter, route.group);
    const index = group?.pages.indexOf(route.page) ?? -1;
    if (index < 0) return guideBookScreen();
    const body = ['§8', '@chapter.' + chapter.id + '.title', ' §8› ', '@group.' + group.id + '.title', '§r\n\n'];
    for (let step = 1; step <= GUIDE_PAGE_STEPS; step++) {
      body.push('§6' + step + '. §r', '@page.' + route.page + '.step' + step);
      if (step < GUIDE_PAGE_STEPS) body.push('\n\n');
    }
    const buttons = [];
    if (route.page === 'progress_tracker') buttons.push(button(key('ui.open_progress'), other('progress'), I.money));
    if (route.page === 'money_upgrades') buttons.push(button(key('ui.open_leaderboard'), other('leaderboard'), I.money));
    if (route.page === 'advanced_admin' && isAdmin) buttons.push(button(key('ui.test_kit'), other('test_kit'), I.upgrade));
    if (route.page === 'limitations') buttons.push(button(key('ui.about'), other('about'), I.book));
    if (index > 0) buttons.push(button(key('ui.previous'), go(view('page', chapter.id, group.id, group.pages[index - 1]))));
    if (index + 1 < group.pages.length) buttons.push(button(key('ui.next'), go(view('page', chapter.id, group.id, group.pages[index + 1]))));
    buttons.push(backButton(view('group', chapter.id, group.id)), homeButton(), closeButton());
    return {
      title: message('§6', '@page.' + route.page + '.title', ` §8(${index + 1}/${group.pages.length})§r`),
      body: message(...body),
      buttons
    };
  }
  const buttons = GUIDE_CHAPTERS.map((chapter, index) => button(
    message('§e' + String(index + 1).padStart(2, '0') + ' §r',
      '@chapter.' + chapter.id + '.title',
      '\n§8' + chapter.groups.length + ' ', '@ui.sections', '§r'),
    go(view('chapter', chapter.id)), chapter.icon));
  buttons.push(button(key('ui.about'), other('about'), I.book), closeButton());
  return {
    title: message('§6§lOrder To Cook§r · ', '@ui.guide'),
    body: message('§7', '@ui.intro', '\n\n§8', '@ui.choose_chapter', '§r'),
    buttons
  };
}
