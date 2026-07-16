const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  let found = false;
  page.on('response', async response => {
    if (response.url().endsWith('.js')) {
      const text = await response.text();
      if (text.includes('sincere-clownfish')) {
        console.log("FOUND IN:", response.url());
        found = true;
      }
    }
  });

  console.log("Navigating to production site...");
  await page.goto('https://streamhuddle.pages.dev/university', { waitUntil: 'networkidle2' });
  
  console.log("Found in JS:", found);
  await browser.close();
})();
