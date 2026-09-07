import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = process.cwd();
const output = resolve(root, 'test-results');
await mkdir(output, { recursive: true });
const report = { checks: [], externalLinks: [], manual: [
  'PC・スマホ画像の目視比較、読みやすさ・重なりの確認',
  'スマホ実機、拡大表示、支援技術での確認',
  'ライセンス・権利、公開内容、mergeの承認'
] };
async function check(name, task) {
  try { await task(); report.checks.push({ name, status: 'pass' }); }
  catch (error) { report.checks.push({ name, status: 'fail', error: error.message }); }
}
const html = await readFile(resolve(root, 'index.html'), 'utf8');
await check('公開表記とリンク', async () => {
  assert(!/instagram|Back to top/i.test(html), 'Excluded link remains');
  assert(!/href="https:\/\/github.com\/Agate72(?:"|\/earthsimulator)/.test(html), 'Non-public source destination');
  assert(html.includes('mailto:agate72.chibinemo@gmail.com'));
  assert(html.includes('Administrator / Operator: chibinemo'));
  assert(html.includes('Not approved by or associated with Mojang or Microsoft.'));
  assert(html.includes('All-Rights-Reserved'));
});
const browser = await chromium.launch(process.env.HP_BROWSER_CHANNEL ? { channel: process.env.HP_BROWSER_CHANNEL } : {});
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 800, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(resolve(root, 'index.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(output, `after-${width}.png`), fullPage: true });
    await check(`${width}px: HTML・画像・内部リンク`, async () => {
      const result = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
        return {
          unique: new Set(ids).size === ids.length,
          h1: document.querySelectorAll('h1').length,
          anchors: [...document.querySelectorAll('a[href^="#"]')].every(a => a.hash === '' || document.getElementById(a.hash.slice(1))),
          images: [...document.images].every(i => i.complete && i.naturalWidth > 0)
        };
      });
      assert(result.unique && result.h1 === 1 && result.anchors && result.images, JSON.stringify(result));
      assert.deepEqual(errors, []);
      assert.equal(await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(18, 23, 22)');
      assert(await page.locator('.hero').evaluate(e => getComputedStyle(e, '::before').backgroundImage.includes('voxel-earth.png')));
      assert(await page.locator('.hero').evaluate(async e => {
        const css = getComputedStyle(e, '::before').backgroundImage;
        const url = css.match(/url\(["']?(.*?)["']?\)/)?.[1];
        if (!url) return false;
        return new Promise(resolve => {
          const img = new Image();
          const timer = setTimeout(() => resolve(false), 5000);
          img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
          img.onerror = () => { clearTimeout(timer); resolve(false); };
          img.src = url;
        });
      }), 'Earth background must load');
    });
    await check(`${width}px: 横はみ出し`, async () => {
      const bad = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,p,dd,nav,a:not(.skip)')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1 || e.scrollWidth > e.clientWidth + 1);
      }).map(e => ({ tag: e.tagName, text: e.textContent.slice(0, 70) })));
      assert.deepEqual(bad, []);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    });
    await check(`${width}px: keyboard / navigation`, async () => {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'skip');
      assert(await page.locator('.skip').evaluate(e => e.getBoundingClientRect().top >= 0));
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).hash, '#main');
      await page.locator('nav a[href="#start"]').click();
      assert.equal(new URL(page.url()).hash, '#start');
      const nav = page.locator('nav a[href="#start"]');
      await page.keyboard.press('Tab');
      await nav.focus();
      assert.notEqual(await nav.evaluate(e => getComputedStyle(e).outlineStyle), 'none');
      await page.locator('.hero a[href="#project"]').click();
      assert.equal(new URL(page.url()).hash, '#project');
      if (width < 800) {
        const box = await page.locator('#start .button').boundingBox();
        assert(box.width >= 44 && box.height >= 44);
      }
    });
    if (process.env.HP_BASELINE_DIR) {
      await page.goto(pathToFileURL(resolve(process.env.HP_BASELINE_DIR, 'index.html')).href);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: resolve(output, `before-${width}.png`), fullPage: true });
    }
    await context.close();
  }
} finally { await browser.close(); }

// External availability is reported separately: a remote outage is not proof of a broken page.
for (const url of [...new Set([...html.matchAll(/href="(https:[^"]+)"/g)].map(m => m[1]))]) {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    report.externalLinks.push({ url, status: response.status, result: response.ok ? 'pass' : 'unverified' });
  } catch (error) { report.externalLinks.push({ url, result: 'unverified', error: error.message }); }
}
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.checks.some(c => c.status === 'fail')) process.exitCode = 1;
