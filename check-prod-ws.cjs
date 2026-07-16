const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  console.log("Navigating to production site...");
  await page.goto('https://streamhuddle.pages.dev/university', { waitUntil: 'networkidle2' });
  
  const resources = await page.evaluate(() => {
    return window.performance.getEntriesByType('resource').map(r => r.name);
  });
  console.log('RESOURCES:', resources.filter(url => url.includes('convex')));
  
  await browser.close();
})();
