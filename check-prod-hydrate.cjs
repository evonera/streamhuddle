const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  console.log("Navigating to production site...");
  await page.goto('https://streamhuddle.pages.dev/university', { waitUntil: 'networkidle2' });
  
  console.log("Clicking Browse Roster...");
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.innerText.includes('Browse Roster'));
    if (btn) btn.click();
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const text = await page.evaluate(() => document.body.innerText);
  console.log("PAGE TEXT AFTER CLICK:\n", text.substring(0, 500));
  
  await browser.close();
})();
