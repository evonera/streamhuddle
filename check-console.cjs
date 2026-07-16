const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    Promise.all(msg.args().map(a => a.jsonValue())).then(args => {
      console.log('BROWSER LOG:', ...args);
    });
  });
  page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => {
    console.error(`REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`);
  });

  console.log('Navigating to page...');
  await page.goto('http://localhost:3000/university', { waitUntil: 'networkidle0' });
  console.log('Page loaded. Waiting a few seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  await browser.close();
})();
