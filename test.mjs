import { ConvexClient } from "convex/browser";

const client = new ConvexClient("https://dependable-crow-331.convex.cloud");
client.query("roster:getAllCreators", {}).then((res) => {
  console.log("Success! Fetched", res.length, "creators.");
  process.exit(0);
}).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
