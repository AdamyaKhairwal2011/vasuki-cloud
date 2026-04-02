const params = new URLSearchParams(window.location.search);
const roomId = params.get("room");
const username = localStorage.getItem("vasuki_user") || "Guest";

document.getElementById("roomId").innerText = roomId;

const socket = new WebSocket("wss://vasuki-meet.onrender.com");

let localStream;
let peers = [];

async function init() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    addVideo(localStream, true);

    socket.send(JSON.stringify({ join: roomId, user: username }));

    socket.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === "chat") addChat(data);
        if (data.type === "users") updateUsers(data.users);

        if (data.offer) {
            const pc = createPeer();
            await pc.setRemoteDescription(data.offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.send(JSON.stringify({ answer }));
        }

        if (data.answer) peers.forEach(pc => pc.setRemoteDescription(data.answer));
        if (data.candidate) peers.forEach(pc => pc.addIceCandidate(data.candidate));
    };
}

function createPeer() {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    pc.ontrack = e => addVideo(e.streams[0]);

    pc.onicecandidate = e => {
        if (e.candidate) socket.send(JSON.stringify({ candidate: e.candidate }));
    };

    peers.push(pc);
    return pc;
}

function addVideo(stream, muted=false) {
    const v = document.createElement("video");
    v.srcObject = stream;
    v.autoplay = true;
    v.muted = muted;
    document.getElementById("videos").appendChild(v);
}

function toggleMute() {
    localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
}

function toggleCamera() {
    localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
}

async function shareScreen() {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
    addVideo(s);
}

function sendChat() {
    const msg = document.getElementById("chatInput").value;
    socket.send(JSON.stringify({ type: "chat", user: username, msg }));
}
init();
