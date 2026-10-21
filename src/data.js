export const VERSION = 1;
export const INGREDIENTS = {
  rice: { name: '稻米', cost: 2, icon: 'rice' },
  egg: { name: '鸡蛋', cost: 2, icon: 'egg' },
  veg: { name: '时蔬', cost: 2, icon: 'veg' },
  tofu: { name: '豆腐', cost: 3, icon: 'tofu' },
  noodle: { name: '面条', cost: 3, icon: 'noodle' },
  meat: { name: '鲜肉', cost: 4, icon: 'meat' },
  fish: { name: '鲜鱼', cost: 4, icon: 'fish' },
  broth: { name: '高汤', cost: 2, icon: 'soup' },
};
export const DISHES = [
  { id:'rice', name:'海苔饭团', tag:'一口安心', price:18, day:1, method:'assemble', ingredients:{rice:1,veg:1}, prep:1.5, heat:0, plate:1, icon:'rice', description:'温热米饭裹上脆海苔，撒一撮芝麻。' },
  { id:'soup', name:'暖心豆腐汤', tag:'热汤暖夜', price:22, day:1, method:'boil', ingredients:{tofu:1,broth:1}, prep:1.5, heat:4, plate:1, icon:'soup', description:'嫩豆腐和高汤慢慢煮开，葱花收尾。' },
  { id:'egg', name:'金黄玉子烧', tag:'软嫩微甜', price:24, day:2, method:'fry', ingredients:{egg:2}, prep:2, heat:4, plate:1, icon:'egg', description:'鸡蛋在平煎台卷起，切成金黄色小块。' },
  { id:'salad', name:'田园小拌菜', tag:'清爽一碟', price:23, day:3, method:'assemble', ingredients:{veg:2,tofu:1}, prep:2, heat:0, plate:1, icon:'salad', description:'脆生蔬菜与豆腐拌在一起，淋上酱汁。' },
  { id:'noodle', name:'葱香汤面', tag:'长夜有味', price:32, day:4, method:'boil', ingredients:{noodle:1,veg:1,broth:1}, prep:2, heat:5, plate:1, icon:'noodle', description:'细面在高汤中煮透，配上青菜。' },
  { id:'pork', name:'香煎肉饼', tag:'滋滋作响', price:35, day:5, method:'fry', ingredients:{meat:2,veg:1}, prep:2.5, heat:5, plate:1, icon:'pork', description:'肉馅拍成厚饼，在煎台上煎出焦香。' },
  { id:'don', name:'照烧鸡肉饭', tag:'丰盛一碗', price:38, day:6, method:'fry', ingredients:{rice:1,meat:1,veg:1}, prep:2.5, heat:5, plate:1.5, icon:'don', description:'煎好的肉片刷上照烧汁，再装入米饭碗。' },
  { id:'fish', name:'柠香煎鱼', tag:'海风入席', price:42, day:7, method:'fry', ingredients:{fish:1,veg:1}, prep:2.5, heat:5.5, plate:1.5, icon:'fish', description:'鱼排煎得两面金黄，搭配时蔬。' },
  { id:'hotpot', name:'菌菇暖锅', tag:'一起暖和', price:40, day:8, method:'boil', ingredients:{tofu:1,veg:2,broth:1}, prep:2.5, heat:6, plate:1.5, icon:'hotpot', description:'时蔬与豆腐在小锅里炖煮，暖意绵长。' },
  { id:'bento', name:'深夜双拼便当', tag:'带一份回家', price:48, day:9, method:'fry', ingredients:{rice:1,egg:1,meat:1,veg:1}, prep:3, heat:6, plate:2, icon:'bento', description:'煎肉、蛋卷和饭团装进木色便当盒。' },
];
export const dishById = Object.fromEntries(DISHES.map(d=>[d.id,d]));
export const TYPES = [
  { id:'neighbor', name:'街坊阿姨', patience:105, eat:7, color:0xa3799a, hair:0x584744, note:'耐心好 · 喜欢热汤', tip:0.14 },
  { id:'student', name:'晚归学生', patience:92, eat:7, color:0x71929e, hair:0x302d30, note:'口味随和 · 单份订单', tip:0.08 },
  { id:'worker', name:'夜班职员', patience:80, eat:6, color:0x566983, hair:0x38302b, note:'赶时间 · 小费较高', tip:0.22 },
  { id:'artist', name:'驻街画师', patience:110, eat:9, color:0xc48a62, hair:0x5b3b28, note:'慢慢享用 · 偏爱时蔬', tip:0.16 },
  { id:'couple', name:'散步同伴', patience:120, eat:9, color:0xb96b69, hair:0x42372d, note:'两人同行 · 两道菜', tip:0.18 },
  { id:'takeaway', name:'外带骑手', patience:85, eat:1.2, color:0xc8a74d, hair:0x2d3334, note:'在入口取餐 · 无需清桌', tip:0.1 },
];
export const DAYS = [
  { title:'亮起第一盏灯', story:'街坊闻着高汤的香气来了。先招呼客人，再做一碗热饭。', event:'试营业', weather:'clear', guests:7, target:72, correct:4, satisfaction:55, duration:140 },
  { title:'巷口的新朋友', story:'玉子烧加入菜单。煎台与汤锅可以同时加热，记得回来装盘。', event:'玉子烧解锁', weather:'clear', guests:8, target:90, correct:5, satisfaction:55, duration:145 },
  { title:'雨声与热汤', story:'夜雨留住了慢慢吃饭的人。耐心增加，汤类更受欢迎。', event:'雨夜 · 耐心 +15 秒', weather:'rain', guests:8, target:98, correct:5, satisfaction:55, duration:145 },
  { title:'有人为你搭把手', story:'阿禾愿意来帮忙送餐和收银。你也可以继续独自掌勺。', event:'服务员开放', weather:'clear', guests:9, target:115, correct:6, satisfaction:55, duration:150 },
  { title:'带走一份暖意', story:'附近的夜班开始了，今晚会有更多外带客，不占用餐桌。', event:'外带之夜', weather:'clear', guests:10, target:130, correct:6, satisfaction:55, duration:150 },
  { title:'两个人的晚餐', story:'散步同伴相约进店。组合订单需要每一道都完成才会结账。', event:'双人订单', weather:'clear', guests:10, target:145, correct:7, satisfaction:55, duration:155 },
  { title:'整洁也是招待', story:'小满可以负责清洁。清爽的餐桌，能接住下一位客人。', event:'清洁员开放', weather:'rain', guests:11, target:158, correct:7, satisfaction:55, duration:155 },
  { title:'街灯下的小节日', story:'附近的手作市集散场了。客人分两拨到来，中间有整理时间。', event:'街区灯会', weather:'festival', guests:11, target:175, correct:8, satisfaction:55, duration:160 },
  { title:'留下熟悉的味道', story:'双拼便当加入菜单。熟客带着朋友来，也有人想把味道带回家。', event:'熟客来访', weather:'clear', guests:12, target:190, correct:8, satisfaction:55, duration:160 },
  { title:'这条街，总有一盏灯', story:'开业季的最后一夜。用学会的节奏，为每个晚归的人做好一餐。', event:'开业季终夜', weather:'festival', guests:12, target:210, correct:9, satisfaction:60, duration:165 },
];
export const UPGRADES = [
  { id:'stove', name:'双炉灶', cost:85, day:2, icon:'stove', description:'增加一个汤锅与煎锅共用炉位，可同时加热两份料理。' },
  { id:'prep', name:'顺手的刀具', cost:65, day:2, icon:'knife', description:'切配时间缩短 35%。' },
  { id:'table', name:'靠窗新座', cost:90, day:3, icon:'table', description:'从 3 张餐桌增加到 4 张。' },
  { id:'wash', name:'高效水槽', cost:60, day:3, icon:'wash', description:'清洁时间从 3.5 秒缩短到 1.7 秒。' },
  { id:'service', name:'伙计备勤角', cost:115, day:4, icon:'service', description:'拓出一处备勤空间，增加 1 个店小二招募名额，并可同时接住更多客人。' },
  { id:'shoes', name:'轻便工作鞋', cost:70, day:4, icon:'shoes', description:'店主移动速度提高 28%。' },
  { id:'queue', name:'厨房记事板', cost:50, day:2, icon:'queue', description:'指令队列从 6 条增加到 10 条。' },
  { id:'warm', name:'保温出餐台', cost:65, day:5, icon:'warm', description:'成品最佳赏味期从 45 秒延长到 90 秒，小费更稳定。' },
];
export const EXPANSIONS = [
  { id:'stove', name:'后厨加灶', day:2, revenue:72, guests:4, effect:'增加一个炉位，让两份料理可以并行加热。' },
  { id:'table', name:'沿街加座', day:3, revenue:150, guests:10, effect:'开放第 4 张餐桌，增加 2 个客位与接待容量。' },
  { id:'service', name:'伙计备勤角', day:4, revenue:260, guests:18, effect:'店小二招募名额 +1，同时提高高峰期接待上限。' },
  { id:'wash', name:'清洁间扩容', day:6, revenue:450, guests:28, effect:'清洁用时缩短，并再增加 1 个店小二招募名额。' },
];
export const STAFF = [
  { id:'shopkeeper', name:'小二', role:'店小二', day:1, cost:85, wage:20, icon:'shopkeeper', unlockText:'第 1 日开店前即可招募：进入「伙伴安排」，支付招募费邀请。', description:'自动招揽可入座的客人，并分担切配、上锅、装盘与清洁。送餐和收银仍由店主或服务员负责。' },
  { id:'server', name:'阿禾', role:'服务员', day:4, cost:55, wage:16, icon:'server', unlockText:'达成第 3 日经营目标并进入第 4 日准备阶段后开放招募。', description:'自动接待、送餐、收银。真实走动，优先照顾已完成的餐点。' },
  { id:'cleaner', name:'小满', role:'清洁员', day:7, cost:45, wage:12, icon:'cleaner', unlockText:'达成第 6 日经营目标并进入第 7 日准备阶段后开放招募。', description:'自动清理已离店的餐桌，让下一位客人及时入座。' },
];
export const POS = { entrance:{x:0,z:3.9}, prep:{x:-2.8,z:-1.9}, stove:{x:-0.8,z:-1.9}, plate:{x:1.3,z:-1.9}, sink:{x:3,z:-1.9}, cashier:{x:3.3,z:1}, tables:[{x:-2.7,z:0.55},{x:0,z:0.55},{x:2.7,z:0.55},{x:-2.7,z:2.65}] };
export const DEFAULT_SETTINGS = { music:0.35, sfx:0.6, quality:'high', slow:false, hints:true, reducedMotion:false };
export function staffRole(id) { return id?.startsWith('shopkeeper-') ? 'shopkeeper' : id; }
export function staffCount(state, role) { return (state.staff||[]).filter(id=>staffRole(id)===role).length; }
export function shopkeeperLimit(state) { return 1+Number(!!state.upgrades?.includes('service'))+Number(!!state.upgrades?.includes('wash')); }
export function staffHireCost(state, role) {
  const person=STAFF.find(item=>item.id===staffRole(role));
  if(!person)return 0;
  return person.cost+(staffRole(role)==='shopkeeper'?staffCount(state,'shopkeeper')*60:0);
}
export function expansionProgress(state) {
  return { revenue:(state.history||[]).reduce((sum,item)=>sum+(item.revenue||0),0), guests:state.totalGuests||0 };
}
export function expansionReady(state, expansion) {
  const progress=expansionProgress(state);
  return state.day>=expansion.day&&progress.revenue>=expansion.revenue&&progress.guests>=expansion.guests;
}
export function recipeCost(dish) { return Object.entries(dish.ingredients).reduce((s,[k,v])=>s+INGREDIENTS[k].cost*v,0); }
export function dailyInfo(state) { return DAYS[Math.min(state.day,10)-1]; }
export function dailyGuestCount(state) { return dailyInfo(state).guests+Number(!!state.upgrades?.includes('table'))+Number(!!state.upgrades?.includes('service'))*2; }
export function unlocked(state) { return DISHES.filter(d=>d.day<=state.day); }
export function stockPlan(state) {
  const result=Object.fromEntries(Object.keys(INGREDIENTS).map(k=>[k,0]));
  const guests=dailyGuestCount(state)+(state.day>=6?3:0);
  for(const id of state.menu) for(const [k,v] of Object.entries(dishById[id].ingredients)) result[k]+=Math.ceil(guests*v/state.menu.length)+2;
  return result;
}
