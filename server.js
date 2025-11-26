const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

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
    process.exit(1);
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
        console.log("[DEBUG] Backend response snippet:", html.slice(0, 300));

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

// Single channel master playlist
app.get("/:id/master.m3u8", async (req, res) => {
    const id = req.params.id;
    console.log(`[DEBUG] Requested channel id: ${id}`);

    const ch = channels.find(c => c.id == id);
    if (!ch) return res.status(404).send("#EXTM3U\n#EXT-X-ERROR: Channel Not Found");

    const finalURL = await fetchTokenedURL(ch.stream);
    if (!finalURL) return res.status(500).send("#EXTM3U\n#EXT-X-ERROR: Token Not Found");

    const playlist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.42e01e,mp4a.40.2"
${finalURL}
`;

    console.log(`[DEBUG] Generated master playlist for channel: ${ch.channelname}`);
    res.setHeader("Content-Type", "application/x-mpegURL");
    res.send(playlist);
});

// Aggregated playlist for all channels
app.get("/all/playlists.m3u", async (req, res) => {
    console.log("[DEBUG] Generating aggregated playlist for all channels...");
    let playlist = "#EXTM3U\n";
	let formattedText = "#EXTM3U\n";
    

    for (const ch of channels) {
        const finalURL = await fetchTokenedURL(ch.stream);
        if (!finalURL) {
            console.warn(`[WARN] Skipping channel ${ch.channelname} (token not found)`);
            continue;
        }

        playlist += `#EXTINF:-1,${ch.name} \n 
        http://roarzone.vercel.app/${ch.id}/master.m3u8\n`;
		// আপনার রো টেক্সট (single line string)
 let rowText  = playlist;
    
    //"#EXTM3U #EXTINF:-1,T Sports http://roarzone.vercel.app/1/master.m3u8 #EXTINF:-1,Channel 9 http://roarzone.vercel.app/9/master.m3u8";

// প্রতিটি চ্যানেল আলাদা লাইনে আনার জন্য space বা pattern দিয়ে split করতে হবে
// এখানে আমরা #EXTINF দিয়ে split করব
let channels = rowText.split("#EXTINF:");

// এবার নতুন ফরম্যাটে join করি
// শুরুতে #EXTM3U
channels.forEach((ch, index) => {
    if(ch.trim() !== "") { // খালি অংশ বাদ
        formattedText += "#EXTINF:" + ch.trim() + "\n";
    }
});

console.log(formattedText);


        
        console.log(`[DEBUG] Added channel ${ch.channelname}`);
    }

    res.setHeader("Content-Type", "application/x-mpegURL");
    res.send(formattedText);
});

// Home route
app.get("/", (req, res) => {
    res.send("🎵 Master M3U Playlist Generator Running 🎵");
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
