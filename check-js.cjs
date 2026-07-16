const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const response = await page.goto('http://localhost:3000/src/components/roster-layout.tsx');
  const text = await response.text();
  const lines = text.split('\n');
  
  console.log('--- LINE 280-300 ---');
  for (let i = 279; i < 299; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
  
  await browser.close();
})();
