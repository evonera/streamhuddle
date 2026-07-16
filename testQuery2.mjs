import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://happy-otter-123.convex.cloud");

async function main() {
  try {
    const res = await client.query("roster:getAllCreators");
    console.log("Success! Found", res.length, "creators on happy-otter-123.");
  } catch (err) {
    console.error("Error message:", err.message);
    console.error("Error data:", err.data);
  }
}

main();
