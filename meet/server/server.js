const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

app.get("/health", (req, res) => res.send("OK"));

wss.on("connection", (ws) => {
    let room;

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.join) {
            room = data.join;
            if (!rooms[room]) rooms[room] = [];
            rooms[room].push(ws);
        }

        rooms[room]?.forEach(client => {
            if (client !== ws && client.readyState === 1) {
                client.send(JSON.stringify(data));
            }
        });
    });

    ws.on("close", () => {
        if (rooms[room]) {
            rooms[room] = rooms[room].filter(c => c !== ws);
        }
    });
});

server.listen(process.env.PORT || 3000);
