const clipId = "AmorphousTenuousPandaMcaT-vGvjD9b5sW5_j0zM"; // example clip ID
const response = await fetch(`https://api.twitch.tv/helix/clips?id=${clipId}`, {
  headers: {
    "Client-Id": process.env.TWITCH_CLIENT_ID || "v7213iytc8430a9p11m0i2a4w1823s", // standard cli client id
    "Authorization": `Bearer ${process.env.TWITCH_ACCESS_TOKEN || "your-token"}`
  }
});
const data = await response.json();
console.log(data);
