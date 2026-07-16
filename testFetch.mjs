async function check() {
  const htmlRes = await fetch("https://streamhuddle.pages.dev/university");
  const html = await htmlRes.text();
  const match = html.match(/src="(\/assets\/[^"]+\.js)"/g);
  if (match) {
    for (const m of match) {
      const url = m.split('"')[1];
      const jsRes = await fetch("https://streamhuddle.pages.dev" + url);
      const js = await jsRes.text();
      const convexUrl = js.match(/https:\/\/[a-zA-Z0-9-]+\.convex\.cloud/g);
      if (convexUrl) {
        console.log("Found in", url, ":", convexUrl);
      }
    }
  }
}
check();
