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
    let room;

    ws.on("message", (msg) => {
        const data = JSON.parse(msg);

        if (data.join) {
            room = data.join;

            if (!rooms[room]) rooms[room] = [];
            rooms[room].push(ws);

            if (!users[room]) users[room] = [];
            users[room].push(data.user);

            broadcast(room, { type: "users", users: users[room] });
        }

        if (data.type === "chat") {
            broadcast(room, data);
        }

        rooms[room]?.forEach(client => {
            if (client !== ws && client.readyState === 1) {
                client.send(JSON.stringify(data));
            }
        });
    });

    ws.on("close", () => {
        if (rooms[room]) rooms[room] = rooms[room].filter(c => c !== ws);
    });
});

function broadcast(room, data) {
    rooms[room]?.forEach(c => c.send(JSON.stringify(data)));
}

server.listen(process.env.PORT || 3000);
