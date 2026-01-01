const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const peerConnections = {};
const dataChannels = {};

function bar(label) {
  const d = document.createElement("div");
  d.innerHTML = `${label}<div class="bar"><span></span></div>`;
  progress.appendChild(d);
  return d.querySelector("span");
}

async function createPeerConnection(socket, id, isSender, files = []) {
  if (peerConnections[id]) return peerConnections[id];

  const pc = new RTCPeerConnection(rtcConfig);
  peerConnections[id] = pc;

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit("signal", { to: id, candidate: e.candidate, from: socket.id });
  };

  if (isSender) {
    const dc = pc.createDataChannel("files");
    dataChannels[id] = dc;
    setupDataChannel(dc, files);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("signal", { to: id, offer, from: socket.id });
  } else {
    pc.ondatachannel = e => {
      const dc = e.channel;
      dataChannels[id] = dc;
      receiveDataChannel(dc);
    };
  }

  return pc;
}

function setupDataChannel(dc, files) {
  const b = bar("Enviando");
  dc.onopen = async () => {
    for (const f of files) {
      dc.send(JSON.stringify({ size: f.size, name: f.name }));
      let s = 0;
      while (s < f.size) {
        const buf = await f.slice(s, s + 16000).arrayBuffer();
        dc.send(buf);
        s += 16000;
        b.style.width = (s / f.size * 100) + "%";
      }
    }
  };
}

function receiveDataChannel(dc) {
  const b = bar("Recibiendo");
  let size = 0, rec = 0, data = [];

  dc.onmessage = m => {
    if (typeof m.data === "string") {
      size = JSON.parse(m.data).size;
      rec = 0; data = [];
      return;
    }
    data.push(m.data);
    rec += m.data.byteLength;
    b.style.width = (rec / size * 100) + "%";
    if (rec === size) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(data));
      a.download = "archivo";
      a.click();
    }
  };
}

function handleSignal(socket, data) {
  const pc = peerConnections[data.from];
  if (!pc) return;

  if (data.offer) {
    pc.setRemoteDescription(new RTCSessionDescription(data.offer))
      .then(() => pc.createAnswer())
      .then(answer => pc.setLocalDescription(answer))
      .then(() => socket.emit("signal", { to: data.from, answer: pc.localDescription, from: socket.id }));
  }

  if (data.answer) pc.setRemoteDescription(new RTCSessionDescription(data.answer));
  if (data.candidate) pc.addIceCandidate(new RTCIceCandidate(data.candidate));
}

window.createPeerConnection = createPeerConnection;
window.setupDataChannel = setupDataChannel;
window.receiveDataChannel = receiveDataChannel;
window.handleSignal = handleSignal;
window.peerConnections = peerConnections;
window.dataChannels = dataChannels;