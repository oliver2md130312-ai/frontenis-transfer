const socket = io("https://transfer-airdrop-backend-production.up.railway.app");

let role = "";
let filesToSend = [];

function chooseRole(r) {
  role = r;
  step_role.hidden = true;
  step_name.hidden = false;
}

function enter() {
  const name = deviceName.value || "Dispositivo";
  socket.emit("join", { name, role });
  step_name.hidden = true;
  if (role === "send") step_send.hidden = false;
  else step_receive.hidden = false;
}

files.onchange = e => filesToSend = [...e.target.files];

socket.on("receivers", list => {
  if (role !== "send") return;
  receivers.innerHTML = "";
  list.forEach(r => {
    const div = document.createElement("div");
    div.textContent = r.name;
    div.onclick = async () => {
      await createPeerConnection(socket, r.id, true, filesToSend);
      socket.emit("request-send", { to: r.id });
    };
    receivers.appendChild(div);
  });
});

socket.on("incoming-request", data => {
  const div = document.createElement("div");
  div.innerHTML = `${data.name} quiere enviarte archivos <button>Aceptar</button>`;

  div.querySelector("button").onclick = async () => {
    // Crear PeerConnection y esperar a que esté lista antes de aceptar
    await createPeerConnection(socket, data.from, false);

    // Emitir aceptación al emisor
    socket.emit("accept-request", { to: data.from });

    // Solo ahora eliminar el cartel
    div.remove();
  };

  requests.appendChild(div);
});

socket.on("request-accepted", async data => {
  const pc = await createPeerConnection(socket, data.from, true, filesToSend);

  // Esperar a que DataChannel esté abierto antes de enviar
  const dc = dataChannels[data.from];
  if (dc.readyState === "open") {
    sendFiles(dc, filesToSend);
  } else {
    dc.onopen = () => sendFiles(dc, filesToSend);
  }
});

socket.on("signal", data => {
  handleSignal(socket, data);
});

function sendFiles(dc, files) {
  const b = bar("Enviando");
  (async () => {
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
  })();
}