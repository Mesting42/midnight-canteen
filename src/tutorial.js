import { staffRole } from './data.js';
export const TUTORIAL_KEY = 'lantern-canteen:tutorial:v1';

export function beginTutorial(s) {
  const r = s.run;
  const guest = r?.customers.find(c => !['gone', 'leaving'].includes(c.status));
  const dirty = r?.tables.find(t => t.status === 'dirty');
  let step = s.phase === 'prep' ? 'stock' : 'greet';
  if (guest) {
    const job = guest.jobs.map(id => r.jobs.find(j => j.id === id)).find(j => j && j.stage !== 'served');
    step = guest.status === 'queue' ? 'greet' : guest.status === 'pay' ? 'pay' : guest.status === 'eating' ? 'eat' :
      ({ new: 'prep', preparing: 'prep', needsHeat: 'heat', heating: 'heat', needsPlate: 'plate', ready: 'serve', carrying: 'serve' })[job?.stage] || 'eat';
  } else if (dirty) step = 'clean';
  s.tutorial = { version: 1, active: true, completed: false, dismissed: false, step, guest: guest?.id || null, table: guest?.table ?? dirty?.id ?? null, startedAt: r?.elapsed || 0 };
}

export function finishTutorial(s, completed = false) {
  if (!s.tutorial) return;
  s.tutorial.active = false;
  s.tutorial.completed = completed;
  s.tutorial.dismissed = !completed;
  s.tutorial.step = completed ? 'done' : 'skipped';
  if (s.run) s.run.tutorialDuration = (s.run.tutorialDuration || 0) + s.run.elapsed - s.tutorial.startedAt;
}

export function advanceTutorial(s, action, guest = null, job = null) {
  const t = s.tutorial;
  if (!t?.active) return;
  if (action === 'stock' && t.step === 'stock') t.step = 'open';
  if (action === 'open' && ['stock', 'open'].includes(t.step)) { t.step = 'greet'; t.startedAt = 0; }
  if (action === 'greet' && t.step === 'greet' && (!t.guest || t.guest === guest?.id)) {
    t.guest = guest.id; t.table = guest.table; t.step = 'prep';
  }
  if (guest && t.guest !== guest.id) return;
  if (action === 'prep' && t.step === 'prep') t.step = job.stage === 'needsPlate' ? 'plate' : 'heat';
  if (action === 'heated' && t.step === 'heat') t.step = 'plate';
  if (action === 'plate' && t.step === 'plate') t.step = 'serve';
  if (action === 'serve' && t.step === 'serve') {
    const unfinished = guest.jobs.map(id => s.run.jobs.find(j => j.id === id)).find(j => j?.stage !== 'served');
    t.step = unfinished ? ({ new: 'prep', preparing: 'prep', needsHeat: 'heat', heating: 'heat', needsPlate: 'plate', ready: 'serve', carrying: 'serve' })[unfinished.stage] : 'eat';
  }
  if (action === 'eaten' && t.step === 'eat') t.step = 'pay';
  if (action === 'pay' && t.step === 'pay') t.step = guest.table === null ? 'done' : 'clean';
  if (action === 'clean' && t.step === 'clean') finishTutorial(s, true);
  if (t.step === 'done' && t.active) finishTutorial(s, true);
}

export function serviceElapsed(s) {
  const r = s.run;
  if (!r) return 0;
  const pause = s.tutorial?.active ? r.elapsed - s.tutorial.startedAt : 0;
  return Math.max(0, r.elapsed - (r.tutorialDuration || 0) - pause);
}

export function tutorialView(s) {
  const t = s.tutorial;
  if (!t || (!t.active && (!t.completed || t.dismissed))) return null;
  const r = s.run;
  const c = r?.customers.find(c => c.id === t.guest) || r?.customers.find(c => c.status === 'queue');
  const jobs = c?.jobs.map(id => r.jobs.find(j => j.id === id)).filter(Boolean) || [];
  const busy = r?.actors.some(a => a.task || a.queue.length);
  const hasShopkeeper = s.staff?.some(id=>staffRole(id)==='shopkeeper');
  const step = t.step;
  const definitions = {
    stock: [1, '先备好今晚的食材', '已替你选好饭团与热汤。点击“补足建议”，按菜单采购食材，库存会真实增加。', '补足建议库存', '[data-action="stockPlan"]', 'stockPlan'],
    open: [1, '准备好了，点亮小店', '右侧库存已经备妥。点击“开门营业”，迎接第一位街坊。', '开门营业', '[data-action="open"]', 'open'],
    greet: [2, c ? '招呼门口的客人' : '街坊正在来店的路上', hasShopkeeper ? '店小二会自动招揽排队的客人；客人随后自行走到椅子上落座。' : c ? '点击箭头指向的客人或这张订单接待。店主会走到门口，客人随后自行走到椅子上落座。' : '第一位客人很快就到。练习期间不会流失客人，放心熟悉操作。', c?.claim ? hasShopkeeper ? '店小二正在招揽客人…' : '正在接待客人…' : c ? '接待这位客人' : '等待第一位客人…', c ? `[data-guest="${c.id}"]` : '.canvas-wrap', 'greet'],
    prep: [3, '先把食材切配好', hasShopkeeper ? '店小二会自动切配订单，并继续处理上锅和装盘。你可以观察他在厨房各工位间走动。' : '点击后厨左侧切配台。店主会走过去处理这份订单；完成后再进行下一步。', busy ? hasShopkeeper ? '店小二正在切配或走动…' : '正在走动或切配…' : hasShopkeeper ? '等待店小二切配…' : '前往切配台', null, 'prep'],
    heat: [3, '让炉火接过这一棒', hasShopkeeper ? '店小二会自动把切好的食材送到炉灶；食物加热完成后，他会继续装盘。' : '点击炉灶将切好的食材下锅。加热时可以看见炉火与蒸汽，煮好后再装盘。', jobs.some(j => j.stage === 'heating') ? '正在加热，请稍候…' : busy ? hasShopkeeper ? '店小二正在上锅…' : '正在上锅…' : hasShopkeeper ? '等待店小二上锅…' : '把料理放上炉灶', null, 'heat'],
    plate: [3, '出锅后，认真装一盘', hasShopkeeper ? '店小二会自动把完成的料理装盘；订单会显示“待送餐”，接下来由你送餐。' : '点击右侧装盘台。完成的餐点会摆在出餐台上，订单也会显示“待送餐”。', busy ? hasShopkeeper ? '店小二正在装盘…' : '正在装盘…' : hasShopkeeper ? '等待店小二装盘…' : '前往装盘台', null, 'plate'],
    serve: [4, '把热饭送到客人面前', '点击对应订单或餐桌。店主会端起料理送到桌边，客人会拿起餐具开始用餐。', busy ? '正在端餐送往桌边…' : '送餐到对应桌位', c ? `[data-guest="${c.id}"]` : null, 'serve'],
    eat: [4, c?.type === 'takeaway' ? '客人正在收好餐点' : '让客人好好吃一顿', '这一步不用操作。看看客人端碗、夹菜和咀嚼的动作；用餐结束后订单会提示结账。', '等待客人用餐结束…', c ? `[data-guest="${c.id}"]` : null, null],
    pay: [5, '收下第一笔营业收入', '点击“待结账”的订单。店主走到桌边收款，现金会增加，客人随后起身离店。', c?.claim ? '正在收款…' : '为这位客人结账', c ? `[data-guest="${c.id}"]` : null, 'pay'],
    clean: [5, '收拾桌面，迎接下一位', hasShopkeeper ? '客人离开后，小二会自动收拾桌面；没有店小二时，可以点击脏桌或水槽清洁。' : '客人离开后会留下餐具。点击脏桌或水槽清洁，让桌位重新可用。', busy ? hasShopkeeper ? '店小二正在清理餐桌…' : '正在清理餐桌…' : hasShopkeeper ? '等待店小二清洁…' : '清洁刚才的餐桌', null, 'clean'],
    done: [5, '第一笔营业，完成了', '你已经会接待、做菜、送餐、收款和清桌了。接下来客人会陆续到店，按这个节奏经营吧。', '开始独立经营', null, 'dismiss'],
  };
  const d = definitions[step];
  if (!d) return null;
  let selection = null;
  if (['prep', 'heat', 'plate'].includes(step)) selection = { kind: 'station', target: ({ prep: 'prep', heat: 'stove', plate: 'plate' })[step] };
  if (['greet', 'serve', 'eat', 'pay'].includes(step) && c) selection = { kind: 'guest', target: c.id };
  if (step === 'clean') selection = { kind: 'table', target: t.table ?? r?.tables.find(t => t.status === 'dirty')?.id };
  const waiting = !d[5] || step === 'greet' && (!c || !!c.claim) || ['prep', 'heat', 'plate', 'serve', 'clean'].includes(step) && busy || step === 'heat' && jobs.some(j => j.stage === 'heating') || step === 'pay' && !!c?.claim;
  return { step, group: d[0], title: d[1], description: d[2], label: d[3], selector: d[4], action: d[5], selection, guest: c?.id, disabled: !!waiting };
}
