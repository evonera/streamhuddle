import { ConvexClient } from "convex/browser";

const client = new ConvexClient("https://dependable-crow-331.convex.cloud");
client.query("roster:getEverything", {}).then((res) => {
  console.log("Success! Fetched", res.length, "creators.");
  if (res.length > 0) console.log("First creator:", res[0]);
  process.exit(0);
}).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
