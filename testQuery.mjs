import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL || "https://dependable-crow-331.convex.cloud");

async function main() {
  try {
    const res = await client.query("roster:getAllCreators");
    console.log("Success! Found", res.length, "creators.");
  } catch (err) {
    console.error("Error calling getAllCreators:", err);
  }
}

main();
