const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    Promise.all(msg.args().map(async a => {
      if (a.executionContext) {
        const type = a.type();
        if (type === 'object') {
          return await a.evaluate(obj => {
            if (obj instanceof Error) return obj.stack;
            return JSON.stringify(obj);
          }).catch(() => '<eval error>');
        }
      }
      return await a.jsonValue().catch(() => '<json error>');
    })).then(args => {
      console.log('BROWSER LOG:', ...args);
    });
  });
  page.on('pageerror', error => console.error('BROWSER ERROR:', error.stack));
  
  await page.goto('http://localhost:3000/university', { waitUntil: 'domcontentloaded' });
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await browser.close();
})();
