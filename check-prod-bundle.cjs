const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://streamhuddle.pages.dev/university', { waitUntil: 'networkidle2' });
  
  const envCheck = await page.evaluate(() => {
    // We can't access import.meta.env directly, but maybe we can find it in the scripts?
    return document.documentElement.innerHTML.includes('convex.cloud');
  });
  console.log("CONVEX CLOUD URL IN HTML?:", envCheck);
  
  await browser.close();
})();
