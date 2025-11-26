const axios = require("axios");
const express = require("express");
const fs = require("fs");
const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------
// Load channels from JSON
// -------------------------------
let channelsList = [];
try {
    channelsList = JSON.parse(fs.readFileSync("channel.json", "utf-8"));
} catch (err) {
    console.error("channel.json read error:", err.message);
}

// -------------------------------
// Extract Clappr Source (with token)
// -------------------------------
async function extractClapprSource(streamId) {
    const url = `http://103.166.152.22:8080/player.php?stream=${streamId}`;

    try {
        const res = await axios.get(url, { timeout: 10000 });
        const body = res.data;

        // Find Clappr source
        const match = body.match(/source:\s*["'](.*?)["']/);
        return match ? match[1] : null;
    } catch (e) {
        console.log("Fetch error:", e.message);
        return null;
    }
}

// -------------------------------
// Dynamic per-channel playlist
// URL: /tsports/master.m3u8
// -------------------------------
app.get("/:channel_id/master.m3u8", async (req, res) => {
    const channel_id = req.params.channel_id;

    const ch = channelsList.find(c => c.id === channel_id);
    if (!ch) return res.status(404).send("Channel not found");

    const sourceUrl = await extractClapprSource(ch.stream);
    if (!sourceUrl) return res.status(404).send("Source not found");

    const m3u = `#EXTM3U
#EXT-X-VERSION:3
#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}",${ch.name}
${sourceUrl}
`;

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(m3u);
});

// -------------------------------
// Generate MAIN master playlist (all channels)
// URL: /playlist.m3u
// -------------------------------
app.get("/playlist.m3u", async (req, res) => {
    let output = "#EXTM3U\n";

    for (const ch of channelsList) {
        const link = `${req.protocol}://${req.get("host")}/${ch.id}/master.m3u8`;

        output += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}",${ch.name}
${link}
`;
    }

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.send(output);
});

// -------------------------------
// Channel list route
// -------------------------------
app.get("/channels", (req, res) => {
    res.json(channelsList);
});

// -------------------------------
// Start Server
// -------------------------------
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});

module.exports = app;
