const clipId = "AmorphousTenuousPandaMcaT-vGvjD9b5sW5_j0zM"; // example clip ID
const response = await fetch("https://gql.twitch.tv/gql", {
  method: "POST",
  headers: {
    "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko", // public web client id
    "Content-Type": "text/plain;charset=UTF-8"
  },
  body: JSON.stringify([
    {
      "operationName": "VideoAccessToken_Clip",
      "variables": { "slug": clipId },
      "extensions": {
        "persistedQuery": {
          "version": 1,
          "sha256Hash": "36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11"
        }
      }
    }
  ])
});
const data = await response.json();
console.log(JSON.stringify(data, null, 2));
