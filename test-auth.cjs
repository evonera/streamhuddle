const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    window.AUTH_LOGS = [];
    const origLog = console.log;
    console.log = function(...args) {
      if (typeof args[0] === 'string' && args[0].includes('AUTH STATE:')) {
        window.AUTH_LOGS.push(args[1]);
      }
      origLog.apply(console, args);
    };
  });
  
  await page.goto('http://localhost:3000/university', { waitUntil: 'domcontentloaded' });
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const logs = await page.evaluate(() => window.AUTH_LOGS);
  console.log('AUTH STATE LOGS:');
  console.log(JSON.stringify(logs, null, 2));
  
  await browser.close();
})();
