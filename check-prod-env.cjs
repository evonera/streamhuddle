const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  console.log("Navigating to production site...");
  await page.goto('https://streamhuddle.pages.dev/university', { waitUntil: 'networkidle2' });
  
  const env = await page.evaluate(() => {
    // If it's exposed on window or we can check the convex url initialized
    return {
       convexUrl: typeof window.__CONVEX_URL !== 'undefined' ? window.__CONVEX_URL : 'not found globally'
    };
  });
  console.log("ENV Check:", env);
  
  await browser.close();
})();
