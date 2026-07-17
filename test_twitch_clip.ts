const clipId = "AmorphousTenuousPandaMcaT-vGvjD9b5sW5_j0zM"; // example clip ID
const response = await fetch(`https://clips.twitch.tv/${clipId}`);
const text = await response.text();
const match = text.match(/"clip_url":"(https:\/\/[^"]+\.mp4)"/);
console.log(match ? match[1] : "Not found");
