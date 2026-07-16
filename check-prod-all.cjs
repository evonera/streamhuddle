const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('PAGEERROR:', error.message));

  console.log("Navigating to production site...");
  await page.goto('https://streamhuddle.pages.dev/university', { waitUntil: 'networkidle0' });
  
  await browser.close();
})();
