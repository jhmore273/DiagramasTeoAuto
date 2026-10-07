const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'};
  try { res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless: true, ...(process.env.BROWSER_PATH ? {executablePath: process.env.BROWSER_PATH} : {})});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}, acceptDownloads: true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}/`;
    await page.goto(url);
    const canvas = page.locator('#canvas');
    await canvas.dblclick({position: {x: 120, y: 130}});
    await page.keyboard.type('S_0');
    await canvas.dblclick({position: {x: 350, y: 130}});
    await page.keyboard.type('S_1');
    await canvas.dblclick({position: {x: 350, y: 130}});
    async function arrow(from, to) {
      const box = await canvas.boundingBox();
      await page.keyboard.down('Shift');
      await page.mouse.move(box.x + from[0], box.y + from[1]);
      await page.mouse.down();
      await page.mouse.move(box.x + to[0], box.y + to[1], {steps: 12});
      await page.mouse.up();
      await page.keyboard.up('Shift');
    }
    await arrow([120, 130], [350, 130]);
    await page.keyboard.type('a');
    await arrow([50, 130], [120, 130]);
    await arrow([350, 130], [350, 110]);
    let graph = await page.evaluate(() => ({nodes: nodes.map(n => [n.x, n.y, n.text, n.isAcceptState]), links: links.map(l => l.constructor.name)}));
    assert.deepEqual(graph.nodes, [[120,130,'S_0',false],[350,130,'S_1',true]]);
    assert.deepEqual(graph.links, ['Link','StartLink','SelfLink']);
    await page.locator('#large').click();
    assert.deepEqual(await page.evaluate(() => [canvas.width, canvas.height]), [2400,1600]);
    await page.evaluate(() => { const v=document.getElementById('viewport'); v.scrollLeft=1100; v.scrollTop=700; });
    const box = await page.locator('#viewport').boundingBox();
    await page.mouse.dblclick(box.x+150, box.y+150);
    await page.keyboard.type('lejos');
    assert.equal(await page.evaluate(() => nodes[2].text), 'lejos');
    assert.equal(await page.evaluate(() => nodes[2].x), 1249);
    const backup = await page.evaluate(() => localStorage.fsm);
    await page.setViewportSize({width: 1000, height: 700});
    await page.locator('#normal').click();
    assert.equal(await page.evaluate(() => localStorage.fsm), backup);
    await page.screenshot({path: path.join(root, '..', 'normal-preview.png'), fullPage: true});
    await page.locator('#fullscreen').click();
    assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'editor');
    await page.screenshot({path: path.join(root, '..', 'fullscreen-preview.png')});
    await page.locator('#normal').click();
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    await page.locator('#svg').click();
    assert.match(await page.locator('#output').inputValue(), /<svg/);
    assert.match(await page.locator('#output').inputValue(), /width="2400" height="1600"/);
    assert.match(await page.locator('#output').inputValue(), /lejos/);
    await page.locator('#latex').click();
    assert.match(await page.locator('#output').inputValue(), /tikzpicture/);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#png').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'diagrama.png');
    await page.reload();
    assert.equal(await page.evaluate(() => nodes.length), 3);
    assert.deepEqual(await page.evaluate(() => [canvas.width, canvas.height]), [2400,1600]);
    await page.locator('#large').click();
    assert.equal(await page.evaluate(() => localStorage.fsm), backup);
    await page.setViewportSize({width: 390, height: 844});
    await page.locator('#normal').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // Restore a wide view to exercise moving, backspace and deletion.
    await page.setViewportSize({width: 1280, height: 900});
    await page.evaluate(() => { const v=document.getElementById('viewport'); v.scrollLeft=0; v.scrollTop=0; });
    const base = await canvas.boundingBox();
    await page.mouse.move(base.x+120, base.y+130);
    await page.mouse.down();
    await page.mouse.move(base.x+180, base.y+220, {steps: 8});
    await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => [nodes[0].x,nodes[0].y]), [180,220]);
    await page.keyboard.press('Backspace');
    assert.equal(await page.evaluate(() => nodes[0].text), 'S_');
    await page.keyboard.press('Delete');
    assert.equal(await page.evaluate(() => nodes.length), 2);
    assert.deepEqual(await page.evaluate(() => links.map(l=>l.constructor.name)), ['SelfLink']);
    // A denied fullscreen request must expose a usable expanded view.
    await page.evaluate(() => { document.getElementById('editor').requestFullscreen=()=>Promise.reject(new Error('denied')); });
    await page.locator('#fullscreen').click();
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('no disponible'));
    assert.equal(await page.locator('#large').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    console.log('PASS: editing, transitions, scroll coordinates, resizing, normal mode, fullscreen, exports, persistence, narrow viewport; no browser errors.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
