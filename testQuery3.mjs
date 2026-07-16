import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://sincere-clownfish-686.convex.cloud");

async function main() {
  try {
    const res = await client.query("roster:getAllCreators");
    console.log("Success! Found", res.length, "creators on sincere-clownfish-686.");
  } catch (err) {
    console.error("Error message:", err.message);
  }
}

main();
