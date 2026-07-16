const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/university', { waitUntil: 'domcontentloaded' });
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const text = await page.evaluate(() => document.body.innerText);
  console.log('PAGE TEXT:');
  console.log(text);
  
  await browser.close();
})();
