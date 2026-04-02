const params = new URLSearchParams(location.search);
const roomId = params.get("room");

const username = localStorage.getItem("vasuki_user") || prompt("Enter name");

document.getElementById("roomId").innerText = "Room: " + roomId;

const socket = new WebSocket("wss://vasuki-meet.onrender.com");

let localStream;
let peer;

async function init() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    addVideo(localStream, true);

    socket.onopen = () => {
        socket.send(JSON.stringify({ join: roomId, user: username }));
    };

    socket.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === "new-user") createOffer();

        if (data.offer) {
            peer = createPeer();
            await peer.setRemoteDescription(data.offer);

            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            socket.send(JSON.stringify({ answer }));
        }

        if (data.answer) await peer.setRemoteDescription(data.answer);
        if (data.candidate) await peer.addIceCandidate(data.candidate);

        if (data.type === "chat") addChat(data);
        if (data.type === "users") updateUsers(data.users);
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

    return pc;
}

async function createOffer() {
    peer = createPeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.send(JSON.stringify({ offer }));
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
    const input = document.getElementById("chatInput");
    socket.send(JSON.stringify({
        type: "chat",
        user: username,
        msg: input.value
    }));
    input.value = "";
}

init();
