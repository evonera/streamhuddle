const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('response', response => {
    console.log('RESPONSE:', response.status(), response.url());
  });

  console.log("Navigating to production site...");
  await page.goto('https://streamhuddle.pages.dev/university', { waitUntil: 'networkidle2' });
  
  await browser.close();
})();
