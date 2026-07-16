const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  let foundConsoleLog = false;
  page.on('response', async response => {
    if (response.url().endsWith('.js')) {
      const text = await response.text();
      if (text.includes('AUTH STATE:')) {
        console.log("FOUND 'AUTH STATE:' IN:", response.url());
        foundConsoleLog = true;
      }
    }
  });

  console.log("Navigating to production site...");
  await page.goto('https://streamhuddle.pages.dev/university', { waitUntil: 'networkidle2' });
  
  console.log("Found console log in JS:", foundConsoleLog);
  await browser.close();
})();
