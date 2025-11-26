const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Load channel.json safely ---
let channels = [];
try {
    const filePath = path.join(__dirname, "channel.json");
    channels = JSON.parse(fs.readFileSync(filePath, "utf8"));
    console.log(`[DEBUG] Loaded ${channels.length} channels from channel.json`);
} catch (err) {
    console.error("[ERROR] Failed to load channel.json:", err.message);
    process.exit(1);
}

// --- Extract final m3u8 URL from backend ---
async function getM3U8Source(stream) {
    try {
        const backendURL = `http://103.166.152.22:8080/player.php?stream=${stream}`;
        console.log(`[DEBUG] Fetching backend URL: ${backendURL}`);

        const res = await axios.get(backendURL, {
            timeout: 10000,
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*",
                "Referer": "http://103.166.152.22:8080/",
                "Origin": "http://103.166.152.22:8080"
            }
        });

        const html = res.data;

        console.log("[DEBUG] Backend response snippet:", html.slice(0, 300));

        // Multi-pattern regex to find tokened m3u8 URL
        const patterns = [
            /source:\s*["'](.*?\.m3u8.*?)["']/i,
            /sources:\s*\[\s*["'](.*?\.m3u8.*?)["']/i,
            /file:\s*["'](.*?\.m3u8.*?)["']/i,
            /(https?:\/\/.*?\.m3u8[^"'<\s]*)/i
        ];

        for (const p of patterns) {
            const match = html.match(p);
            if (match && match[1]) {
                console.log("[DEBUG] Found m3u8 URL:", match[1]);
                return match[1];
            }
        }

        console.warn("[WARN] No m3u8 URL found in backend HTML");
        return null;

    } catch (err) {
        console.error("[ERROR] Backend fetch failed:", err.message);
        return null;
    }
}

// --- Playlist route ---
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
    const finalSource = await getM3U8Source(ch.stream);

    if (!finalSource) {
        console.error("[ERROR] Could not get valid m3u8 URL for channel:", ch.channelname);
        return res.status(500).send("#EXTM3U\n#EXT-X-ERROR: Token Not Found");
    }

    // --- Generate Master M3U8 playlist ---
    const playlist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.42e01e,mp4a.40.2"
${finalSource}
`;

    console.log(`[DEBUG] Generated Master playlist for channel: ${ch.channelname}`);
    res.setHeader("Content-Type", "application/x-mpegURL");
    res.send(playlist);
});

// --- Base route ---
app.get("/", (req, res) => {
    res.send("🎵 M3U Playlist Generator Running 🎵");
});

// --- Start server ---
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
