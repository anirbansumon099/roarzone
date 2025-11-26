const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Load channel.json
let channels = [];
try {
    channels = JSON.parse(fs.readFileSync("./channel.json", "utf8"));
    console.log(`[DEBUG] Loaded ${channels.length} channels from channel.json`);
} catch (err) {
    console.error("[ERROR] Failed to load channel.json:", err.message);
}

// Function: extract final stream URL from backend
async function getValidSource(stream) {
    try {
        const backendURL = `http://103.166.152.22:8080/player.php?stream=${stream}`;
        console.log(`[DEBUG] Fetching backend URL: ${backendURL}`);

        const response = await axios.get(backendURL, {
            timeout: 10000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "*/*",
                "Referer": "http://103.166.152.22:8080/",
                "Origin": "http://103.166.152.22:8080"
            }
        });

        const html = response.data;

        // DEBUG: first 500 chars of HTML
        console.log("[DEBUG] Backend response snippet:", html.slice(0, 500));

        // Multi-pattern regex to find token URL
        const patterns = [
            /source:\s*["'](.*?)["']/i,
            /sources:\s*\[\s*["'](.*?)["']/i,
            /file:\s*["'](.*?)["']/i,
            /src:\s*["'](.*?)["']/i,
            /url:\s*["'](.*?)["']/i,
            /(https?:\/\/.*?\.m3u8[^"'<\s]*)/i
        ];

        for (const p of patterns) {
            const match = html.match(p);
            if (match && match[1]) {
                console.log("[DEBUG] Found source URL:", match[1]);
                return match[1];
            }
        }

        console.warn("[WARN] No source URL matched in backend HTML");
        return null;

    } catch (err) {
        console.error("[ERROR] Backend fetch failed:", err.message);
        return null;
    }
}

// Playlist route
app.get("/:id/master.m3u8", async (req, res) => {
    const id = req.params.id;
    console.log(`[DEBUG] Requested channel id: ${id}`);

    // Find channel by id field
    const ch = channels.find(c => c.id == id);

    if (!ch) {
        console.warn(`[WARN] Channel with id=${id} not found`);
        return res.status(404).send("#EXTM3U\n#EXT-X-ERROR: Channel Not Found");
    }

    console.log(`[DEBUG] Found channel: ${ch.channelname} (stream: ${ch.stream})`);

    // Get valid token URL
    const finalSource = await getValidSource(ch.stream);

    if (!finalSource) {
        console.error("[ERROR] Could not get valid token URL for channel:", ch.channelname);
        return res.status(500).send("#EXTM3U\n#EXT-X-ERROR: Token Not Found");
    }

    // Generate playlist
    const playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXTINF:-1, ${ch.channelname}
${finalSource}
`;

    console.log(`[DEBUG] Generated playlist for channel: ${ch.channelname}`);
    res.setHeader("Content-Type", "application/x-mpegURL");
    res.send(playlist);
});

// Base route
app.get("/", (req, res) => {
    res.send("🎵 M3U Playlist Generator Running 🎵");
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
