import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const port=process.env.PORT||4173,url=`http://127.0.0.1:${port}`;
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const errors=[];
const watch=page=>{
  page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`);});
  page.on('pageerror',error=>errors.push(`page: ${error.message}`));
};

try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});watch(page);
  await page.goto(url,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:/打开设置/}).click();
  if(!await page.getByRole('heading',{name:/声音、画面与操作/}).isVisible())throw new Error('settings modal missing');
  await page.screenshot({path:'docs/browser-settings.png',fullPage:true});
  await page.getByRole('button',{name:/关闭设置/}).click();
  await page.screenshot({path:'docs/browser-desktop-menu.png',fullPage:true});
  if(!await page.getByRole('button',{name:/接手这间小店/}).isVisible())throw new Error('menu CTA missing');
  await page.getByRole('button',{name:/接手这间小店/}).click();await page.waitForTimeout(150);
  await page.screenshot({path:'docs/browser-desktop-prep.png',fullPage:true});
  if(!await page.getByRole('button',{name:/开门营业/}).isVisible())throw new Error('prep CTA missing');
  await page.getByRole('button',{name:/开门营业/}).click();await page.waitForTimeout(250);
  await page.screenshot({path:'docs/browser-desktop-open.png',fullPage:true});
  if(!await page.locator('#scene canvas').isVisible())throw new Error('WebGL scene canvas missing');
  const render=await page.evaluate(()=>({drawCalls:window.__canteenSnapshot().drawCalls,aria:document.querySelector('#scene canvas')?.getAttribute('aria-label'),neighborhood:window.__canteenSnapshot().neighborhood}));
  if(!(render.drawCalls>0)||!render.neighborhood||!render.aria?.includes('等距3D'))throw new Error(`3D night market did not render: ${JSON.stringify(render)}`);
  await page.waitForTimeout(7600);const guest=page.locator('[data-guest]').first();
  if(!await guest.isVisible())throw new Error('first guest did not spawn');
  await guest.click();await page.waitForTimeout(250);await page.screenshot({path:'docs/browser-desktop-first-guest.png',fullPage:true});

  const mobile=await browser.newPage({viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});watch(mobile);
  await mobile.goto(url,{waitUntil:'networkidle'});
  if(await mobile.locator('#orientation-gate').isVisible())throw new Error('the portrait menu should stay available');
  await mobile.screenshot({path:'docs/browser-mobile-portrait-menu.png',fullPage:true});
  const tablet=await browser.newPage({viewport:{width:768,height:1024},screen:{width:768,height:1024},isMobile:true,hasTouch:true});watch(tablet);
  await tablet.goto(url,{waitUntil:'networkidle'});await tablet.getByRole('button',{name:/接手这间小店/}).click();
  if(await tablet.getByRole('button',{name:'跳过引导'}).count())await tablet.getByRole('button',{name:'跳过引导'}).click();
  await tablet.getByRole('button',{name:/开门营业/}).click();await tablet.locator('.game-layout').waitFor();
  if(await tablet.locator('#orientation-gate').isVisible())throw new Error('portrait tablet was incorrectly gated');
  await tablet.setViewportSize({width:1024,height:768});
  if(await tablet.locator('#orientation-gate').isVisible())throw new Error('landscape tablet was incorrectly gated');
  await tablet.close();
  await mobile.setViewportSize({width:844,height:390});await mobile.waitForTimeout(100);
  if(await mobile.locator('#orientation-gate').isVisible())throw new Error('phone landscape gate did not clear');
  await mobile.getByRole('button',{name:/接手这间小店/}).click();await mobile.waitForTimeout(100);
  if(await mobile.getByRole('button',{name:'跳过引导'}).count())await mobile.getByRole('button',{name:'跳过引导'}).click();
  await mobile.screenshot({path:'docs/browser-mobile-landscape-prep.png',fullPage:true});
  await mobile.getByRole('button',{name:/开门营业/}).click();
  await mobile.locator('.game-layout').waitFor();
  await mobile.setViewportSize({width:390,height:844});
  await mobile.locator('#orientation-gate').waitFor({state:'visible',timeout:5000});
  await mobile.screenshot({path:'docs/browser-mobile-portrait-orientation.png',fullPage:true});
  await mobile.setViewportSize({width:844,height:390});
  const overflow=await mobile.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  if(overflow.width>overflow.client+2)throw new Error(`mobile overflow ${JSON.stringify(overflow)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('browser check PASS: desktop 3D, phone orientations and tablet orientations');
}finally{
  await browser.close();
}
