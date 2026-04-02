const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};
const users = {};

app.get("/health", (req, res) => res.send("OK"));

wss.on("connection", (ws) => {

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.join) {
            ws.room = data.join;
            ws.username = data.user || "Guest";

            if (!rooms[ws.room]) rooms[ws.room] = [];
            rooms[ws.room].push(ws);

            if (!users[ws.room]) users[ws.room] = [];
            users[ws.room].push(ws.username);

            broadcast(ws.room, { type: "users", users: users[ws.room] });

            // notify others
            rooms[ws.room].forEach(client => {
                if (client !== ws) {
                    client.send(JSON.stringify({ type: "new-user" }));
                }
            });
        }

        if (data.type === "chat") {
            broadcast(ws.room, data);
        }

        // relay WebRTC signals
        rooms[ws.room]?.forEach(client => {
            if (client !== ws && client.readyState === 1) {
                client.send(JSON.stringify(data));
            }
        });
    });

    ws.on("close", () => {
        if (ws.room && rooms[ws.room]) {
            rooms[ws.room] = rooms[ws.room].filter(c => c !== ws);
            users[ws.room] = users[ws.room].filter(u => u !== ws.username);
            broadcast(ws.room, { type: "users", users: users[ws.room] });
        }
    });
});

function broadcast(room, data) {
    rooms[room]?.forEach(c => c.send(JSON.stringify(data)));
}

server.listen(process.env.PORT || 3000);
