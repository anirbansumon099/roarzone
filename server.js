const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { URL } = require("url"); 


const { postRequest } = require('./requester');


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
        const urlObj = new URL(fetchedURL);
        const token = urlObj.searchParams.get("token");

        if (token) {
            const baseUrl = fetchedURL.split('index.m3u8')[0];
            const updatedPath = `tracks-v1a1/mono.m3u8?token=${token}`;
            finalURL = baseUrl + updatedPath;
            console.log(`[DEBUG] Updated M3U8 link with new path: ${finalURL}`);
        } else {
            console.warn(`[WARN] Token not found in fetched URL. Using original URL.`);
        }
    } catch (e) {
        console.error(`[ERROR] Failed to parse URL or token: ${e.message}. Using original URL.`);
    }

    return finalURL;
}


// Single channel master playlist (No change here - it still handles token fetch/update)
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



app.get("/token",async(req,res)=>{

const respText = await postRequest('http://tv.roarzone.info/app.php', {
        userAgent: 'Rangdhanu Live 1.0',
        username: 'admin',
        password: 'admin123'
        
    });
res.send(respText);
    
});




// Aggregated playlist for all channels - চূড়ান্ত সংশোধিত রুট
app.get("/all/playlists.m3u", async (req, res) => {
    console.log("[DEBUG] Generating aggregated playlist for all channels (using channel.json only)...");
    let playlist = "#EXTM3U\n"; 
    
    // fetchTokenedURL বা অন্য কোনো async কাজ ছাড়াই শুধু channels অ্যারে লুপ করা হচ্ছে
    for (const ch of channels) {
        // channel.json এর data ব্যবহার করে প্রক্সি URL তৈরি করা
        const channelProxyURL = `http://roarzone.vercel.app/${ch.id}/master.m3u8`;

        // সঠিক M3U ফরম্যাটে playlist তৈরি করা
        playlist += `#EXTINF:-1,${ch.name}\n${channelProxyURL}\n`; 
        
        // Note: এখানে ch.name এর বদলে ch.channelname ব্যবহার করা হয়েছে, 
        // কারণ মূল কোডে channelname ব্যবহার করা হয়েছে।
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
