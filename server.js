const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Load channel.json
let channels = [];
try {
    channels = JSON.parse(fs.readFileSync("./channel.json", "utf8"));
} catch (err) {
    console.error("Error loading channel.json:", err.message);
}

// Extract final token URL from backend
async function getValidSource(stream) {
    try {
        const backendURL = `http://103.166.152.22:8080/player.php?stream=${stream}`;

        const res = await axios.get(backendURL, {
            timeout: 8000,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        });

        const html = res.data;

        // Extract Clappr "source: 'xxx'"
        const match = html.match(/source:\s*["'](.*?)["']/);

        if (!match) return null;

        return match[1];
    } catch (err) {
        console.error("Fetch Error:", err.message);
        return null;
    }
}

// m3u playlist route
app.get("/:id/master.m3u8", async (req, res) => {
    const id = parseInt(req.params.id);
    const index = id - 1;

    if (!channels[index]) {
        return res.status(404).send("#EXTM3U\n#EXT-X-ERROR: Channel Not Found");
    }

    const ch = channels[index];

    // Extract token link
    const finalSource = await getValidSource(ch.stream);

    if (!finalSource) {
        return res.status(500).send("#EXTM3U\n#EXT-X-ERROR: Token Not Found");
    }

    // Playlist output
    const playlist = `#EXTM3U
#EXTINF:-1, ${ch.channelname}
${finalSource}
`;

    res.setHeader("Content-Type", "application/x-mpegURL");
    res.send(playlist);
});

// Base route
app.get("/", (req, res) => {
    res.send("Playlist Generator is Running...");
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
