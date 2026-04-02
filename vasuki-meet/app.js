const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room");
document.getElementById("roomId").innerText = "Room: " + roomId;

const socket = new WebSocket(`ws://${location.host}`);

let localStream;
let peers = {};

async function init() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    addVideo(localStream);

    socket.send(JSON.stringify({ join: roomId }));

    socket.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.offer) {
            const pc = createPeer();
            await pc.setRemoteDescription(data.offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.send(JSON.stringify({ answer }));
        }

        if (data.answer) {
            Object.values(peers).forEach(pc => pc.setRemoteDescription(data.answer));
        }

        if (data.candidate) {
            Object.values(peers).forEach(pc => pc.addIceCandidate(data.candidate));
        }
    };
}

function createPeer() {
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = e => addVideo(e.streams[0]);

    pc.onicecandidate = e => {
        if (e.candidate) {
            socket.send(JSON.stringify({ candidate: e.candidate }));
        }
    };

    peers[Math.random()] = pc;
    return pc;
}

function addVideo(stream) {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    document.getElementById("videos").appendChild(video);
}

function toggleMute() {
    localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
}

function toggleCamera() {
    localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
}

async function shareScreen() {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
    addVideo(screen);
}

init();
