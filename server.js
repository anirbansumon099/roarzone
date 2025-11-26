const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { URL } = require("url"); // Node.js এর বিল্ট-ইন URL মডিউল ইমপোর্ট করা হলো

const app = express();
const PORT = process.env.PORT || 3000;

// Load channel.json
let channels = [];
try {
    const filePath = path.join(__dirname, "channel.json");
    channels = JSON.parse(fs.readFileSync(filePath, "utf8"));
    console.log(`[DEBUG] Loaded ${channels.length} channels from channel.json`);
} catch (err) {
    console.error("[ERROR] Failed to load channel.json:", err.message);
    // process.exit(1); 
}

// Fetch tokened m3u8 URL from backend
async function fetchTokenedURL(stream) {
    try {
        const backendURL = `http://tv.roarzone.info//player.php?stream=${stream}`; 
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

// Helper function to extract token and update URL path
function updateM3U8Path(fetchedURL) {
    let finalURL = fetchedURL;

    try {
        // Node's built-in URL class used here
        const urlObj = new URL(fetchedURL);
        const token = urlObj.searchParams.get("token");

        if (token) {
            // index.m3u8 পর্যন্ত অংশটি ফেলে দিয়ে baseUrl তৈরি করা
            const baseUrl = fetchedURL.split('index.m3u8')[0];
            
            // নতুন কাঙ্ক্ষিত পাথের সাথে টোকেন যুক্ত করা
            const updatedPath = `tracks-v1a1/mono.m3u8?token=${token}`;
            finalURL = baseUrl + updatedPath;
            console.log(`[DEBUG] Updated M3U8 link with new path: ${finalURL}`);
        } else {
            console.warn(`[WARN] Token not found in fetched URL. Using original URL.`);
        }
    } catch (e) {
        // If fetchedURL is not a valid URL (e.g., malformed), use the original fetchedURL
        console.error(`[ERROR] Failed to parse URL or token: ${e.message}. Using original URL.`);
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

    // --- টোকেন বের করে URL আপডেট করার লজিক ---
    const finalURL = updateM3U8Path(fetchedURL);
    // --- লজিক শেষ ---
    
    const playlist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.42e01e,mp4a.40.2"
${finalURL}
`;

    console.log(`[DEBUG] Generated master playlist for channel: ${ch.channelname}`);
    res.setHeader("Content-Type", "application/x-mpegURL");
    res.send(playlist);
});

// Aggregated playlist for all channels - সংশোধিত রুট
app.get("/all/playlists.m3u", async (req, res) => {
    console.log("[DEBUG] Generating aggregated playlist for all channels...");
    let playlist = "#EXTM3U\n"; 
    
    for (const ch of channels) {
        const fetchedURL = await fetchTokenedURL(ch.stream); 

        if (!fetchedURL) {
            console.warn(`[WARN] Skipping channel ${ch.channelname} (token not found)`);
            continue;
        }

        const channelProxyURL = `http://roarzone.vercel.app/${ch.id}/master.m3u8`;

        // সঠিক M3U ফরম্যাটে playlist তৈরি করা
        // channelname ব্যবহার করা হলো, যা সাধারণত ডিসপ্লে-এর জন্য ব্যবহৃত হয়
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
