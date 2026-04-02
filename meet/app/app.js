const params = new URLSearchParams(location.search);
const roomId = params.get("room");

const username = localStorage.getItem("vasuki_user") || prompt("Enter name");

document.getElementById("roomId").innerText = "Room: " + roomId;

const socket = new WebSocket("wss://vasuki-meet.onrender.com");

let localStream;
let peer;
let recognition;

// 🎤 INIT
async function init() {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true
        }
    });

    // 🔊 extra audio filtering
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(localStream);
    const filter = audioContext.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 3000;

    source.connect(filter);

    const destination = audioContext.createMediaStreamDestination();
    filter.connect(destination);

    localStream = new MediaStream([
        ...destination.stream.getAudioTracks(),
        ...localStream.getVideoTracks()
    ]);

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

// 🔗 WebRTC
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

    return pc;
}

async function createOffer() {
    peer = createPeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.send(JSON.stringify({ offer }));
}

// 🎥 Video
function addVideo(stream, muted=false) {
    const v = document.createElement("video");
    v.srcObject = stream;
    v.autoplay = true;
    v.muted = muted;
    document.getElementById("videos").appendChild(v);
}

// 🎛 Controls
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

// 💬 Chat
function sendChat() {
    const input = document.getElementById("chatInput");
    socket.send(JSON.stringify({
        type: "chat",
        user: username,
        msg: input.value
    }));
    input.value = "";
}

// 👥 UI Updates
function updateUsers(users) {
    const list = document.getElementById("users");
    list.innerHTML = "";
    users.forEach(u => {
        const li = document.createElement("li");
        li.innerText = u;
        list.appendChild(li);
    });
}

function addChat(data) {
    const box = document.getElementById("chatBox");
    const div = document.createElement("div");
    div.innerText = data.user + ": " + data.msg;
    box.appendChild(div);
}

// 🔗 Invite
function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied");
}

// 🎤 Captions
function startCaptions() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        let text = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
        }
        document.getElementById("captions").innerText = text;
    };

    recognition.start();
}

function stopCaptions() {
    recognition?.stop();
}

init();
