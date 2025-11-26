const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./database.db');
db.run(`
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    channel_id TEXT UNIQUE,
    sourceUrl TEXT
)
`);

// Load channels from JSON
let channelsList = JSON.parse(fs.readFileSync('channel.json', 'utf-8'));

// Extract source URL from target link
async function extractClapprSource(targetLink) {
    try {
        const res = await axios.get(targetLink);
        const text = res.data;
        const match = text.match(/source:\s*["'](.*?)["']/);
        return match ? match[1] : null;
    } catch(err) {
        console.error("Error fetching target link:", err.message);
        return null;
    }
}

// Update or insert channel in DB
async function updateChannelInDB(name, channel_id) {
    const targetLink = `http://103.166.152.22:8080/player.php?stream=${channel_id}`;
    const newSource = await extractClapprSource(targetLink);
    if(!newSource) return console.log(`${name}: no source found`);

    db.get("SELECT * FROM channels WHERE channel_id=?", [channel_id], (err, row) => {
        if(err) return console.error(err);

        if(row) {
            if(row.sourceUrl !== newSource) {
                db.run("UPDATE channels SET sourceUrl=? WHERE channel_id=?", [newSource, channel_id]);
                console.log(`${name} updated: ${row.sourceUrl} -> ${newSource}`);
            } else {
                console.log(`${name}: no change`);
            }
        } else {
            db.run("INSERT INTO channels(name, channel_id, sourceUrl) VALUES(?,?,?)", [name, channel_id, newSource]);
            console.log(`${name} inserted: ${newSource}`);
        }
    });
}

// Generate per-channel M3U8 playlist
function generateChannelPlaylist(channel_id) {
    db.get("SELECT * FROM channels WHERE channel_id=?", [channel_id], (err, row) => {
        if(err) return console.error(err);
        if(!row || !row.sourceUrl) return;

        const dir = `./playlists/${channel_id}/master`;
        fs.mkdirSync(dir, { recursive: true });

        const m3u = `#EXTM3U\n#EXTINF:-1,${row.name}\n${row.sourceUrl}\n`;
        fs.writeFileSync(`${dir}/playlist.m3u8`, m3u, 'utf-8');
        console.log(`Playlist generated for ${row.name}`);
    });
}

// Update all channels
async function updateAllChannels() {
    for(const ch of channelsList) {
        await updateChannelInDB(ch.name, ch.id);
        generateChannelPlaylist(ch.id);
    }
}

// Run interval only in dev (Vercel serverless cannot use setInterval)
if(process.env.NODE_ENV !== 'production') {
    setInterval(updateAllChannels, 60*1000);
    updateAllChannels();
}

// Express route for per-channel playlist
app.get('/:channel_id/master/playlist.m3u8', (req, res) => {
    const channel_id = req.params.channel_id;
    const filePath = `./playlists/${channel_id}/master/playlist.m3u8`;

    if(fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.sendFile(__dirname + `/${filePath}`);
    } else {
        res.status(404).send("Playlist not found");
    }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
