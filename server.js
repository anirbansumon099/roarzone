const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const { makeAuthPostRequest } = require("./getToken");

const app = express();
const PORT = process.env.PORT || 3000;

// Load channels from channel.json
let channels = [];
try {
    const filePath = path.join(__dirname, "channel.json");
    channels = JSON.parse(fs.readFileSync(filePath, "utf8"));
    console.log(`[DEBUG] Loaded ${channels.length} channels from channel.json`);
} catch (err) {
    console.error("[ERROR] Failed to load channel.json:", err.message);
}

// Fetch tokened m3u8 URL from backend
async function fetchTokenedURL(stream) {
    try {
        const backendURL = `http://tv.roarzone.info/player.php?stream=${stream}`;
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

        const patterns = [
            /source:\s*["'](.*?\.m3u8.*?)["']/i,
            /sources:\s*\[\s*["'](.*?\.m3u8.*?)["']/i,
            /file:\s*["'](.*?\.m3u8.*?)["']/i,
            /(https?:\/\/.*?\.m3u8[^"'<\s]*)/i
        ];

        for (const p of patterns) {
            const match = html.match(p);
            if (match && match[1]) {
                console.log("[DEBUG] Found tokened m3u8 URL:", match[1]);
                return match[1];
            }
        }

        console.warn("[WARN] No m3u8 URL found for stream:", stream);
        return null;
    } catch (err) {
        console.error("[ERROR] Failed fetching backend URL:", err.message);
        return null;
    }
}

// Update M3U8 path with token
function updateM3U8Path(fetchedURL) {
    let finalURL = fetchedURL;

    try {
        const urlObj = new URL(fetchedURL);
        const token = urlObj.searchParams.get("token");

        if (token) {
            const baseUrl = fetchedURL.split('index.m3u8')[0];
            finalURL = `${baseUrl}tracks-v1a1/mono.m3u8?token=${token}`;
            console.log(`[DEBUG] Updated M3U8 link: ${finalURL}`);
        } else {
            console.warn("[WARN] Token not found, using original URL.");
        }
    } catch (e) {
        console.error(`[ERROR] Failed parsing URL: ${e.message}`);
    }

    return finalURL;
}

// Single channel master playlist
app.get("/:id/master.m3u8", async (req, res) => {
    const id = req.params.id;
    console.log(`[DEBUG] Requested channel id: ${id}`);

    const ch = channels.find(c => c.id == id);
    if (!ch) return res.status(404).send("#EXTM3U\n#EXT-X-ERROR: Channel Not Found");

    const fetchedURL = await fetchTokenedURL(ch.stream);
    if (!fetchedURL) return res.status(500).send("#EXTM3U\n#EXT-X-ERROR: Token Not Found");

    const finalURL = updateM3U8Path(fetchedURL);

    const playlist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.42e01e,mp4a.40.2"
${finalURL}
`;

    console.log(`[DEBUG] Generated master playlist for channel: ${ch.channelname}`);
    res.setHeader("Content-Type", "application/x-mpegURL");
    res.send(playlist);
});

// Tracks-v1a1 route with auto token
app.get("/tracks-v1a1/:channel_name/mono.ts.m3u8", async (req, res) => {
    const channelName = req.params.channel_name;
    console.log(`[DEBUG] Requested tracks-v1a1 for channel: ${channelName}`);

    const ch = channels.find(c => c.channelname === channelName);
    if (!ch) return res.status(404).send("#EXTM3U\n#EXT-X-ERROR: Channel Not Found");

    try {
        const result = await makeAuthPostRequest({}); // Replace with actual params if needed

        if (result.success) {
            const server_uri = `http://103.166.152.22:8080/roarzone/${ch.stream}/tracks-v1a1/mono.m3u8?token=`;

            const playlist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.42e01e,mp4a.40.2"
${server_uri + result.data}
`;
            res.setHeader("Content-Type", "application/x-mpegURL");
            res.send(playlist);
        } else {
            res.status(500).send("#EXTM3U\n#EXT-X-ERROR: Auto Token error");
        }
    } catch (err) {
        console.error("[ERROR] /tracks-v1a1 route:", err.message);
        res.status(500).send("#EXTM3U\n#EXT-X-ERROR: Server Error");
    }
});

// Header check route
app.get("/check", (req, res) => {
    const { authorization, 'user-agent': userAgent } = req.headers;

    console.log("[DEBUG] Authorization:", authorization);
    console.log("[DEBUG] User-Agent:", userAgent);

    res.send({
        message: "Headers received",
        authorization,
        userAgent
    });
});

// Token route
app.get("/token", async (req, res) => {
    try {
        const postData = { param1: 'value1', param2: 'value2' };
        const result = await makeAuthPostRequest(postData);

        if (result.success) {
            console.log("✅ Server Response:", result.data);
            res.send(result.data);
        } else {
            console.error("❌ Error:", result.error);
            res.status(500).send(result.error);
        }
    } catch (err) {
        console.error("[ERROR] /token route:", err.message);
        res.status(500).send("Server Error");
    }
});

// Aggregated playlist for all channels
app.get("/all/playlists.m3u", async (req, res) => {
    console.log("[DEBUG] Generating aggregated playlist for all channels...");
    let playlist = "#EXTM3U\n";

    for (const ch of channels) {
        const channelProxyURL = `http://roarzone.vercel.app/${ch.id}/master.m3u8`;
        playlist += `#EXTINF:-1,${ch.channelname}\n${channelProxyURL}\n`;
        console.log(`[DEBUG] Added channel ${ch.channelname}`);
    }

    res.setHeader("Content-Type", "application/x-mpegURL");
    res.send(playlist);
});

// Home route
app.get("/", (req, res) => {
    res.send("🎵 Master M3U Playlist Generator Running 🎵");
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
