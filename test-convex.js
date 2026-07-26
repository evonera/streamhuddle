const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://sincere-clownfish-686.convex.cloud");
client.query("clipQueue:getLiveQueue", { creatorId: "test" }).then(console.log).catch(console.error);
