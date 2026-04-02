const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

app.get("/health", (req, res) => res.send("OK"));

wss.on("connection", (ws) => {
    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.join) {
            ws.room = data.join;

            if (!rooms[ws.room]) rooms[ws.room] = [];
            rooms[ws.room].push(ws);

            // 🔥 notify others
            rooms[ws.room].forEach(client => {
                if (client !== ws) {
                    client.send(JSON.stringify({ type: "new-user" }));
                }
            });
        }

        // 🔁 relay all WebRTC signals
        rooms[ws.room]?.forEach(client => {
            if (client !== ws && client.readyState === 1) {
                client.send(JSON.stringify(data));
            }
        });
    });

    ws.on("close", () => {
        if (ws.room && rooms[ws.room]) {
            rooms[ws.room] = rooms[ws.room].filter(c => c !== ws);
        }
    });
});

server.listen(process.env.PORT || 3000);
