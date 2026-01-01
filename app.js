const socket = io("https://transfer-airdrop-backend-production.up.railway.app");

let role = "";
let filesToSend = [];

// Elegir rol
function chooseRole(r) {
  role = r;
  step_role.hidden = true;
  step_name.hidden = false;
}

// Nombre del dispositivo
function enter() {
  const name = deviceName.value || "Dispositivo";
  socket.emit("join", { name, role });
  step_name.hidden = true;
  if (role === "send") step_send.hidden = false;
  else step_receive.hidden = false;
}

// Selección de archivos
files.onchange = e => filesToSend = [...e.target.files];

// Lista de receptores (solo emisores)
socket.on("receivers", list => {
  if (role !== "send") return;
  receivers.innerHTML = "";
  list.forEach(r => {
    const div = document.createElement("div");
    div.textContent = r.name;
    div.onclick = () => {
      // Crear conexión en el emisor
      createPeerConnection(socket, r.id, true, filesToSend);
      socket.emit("request-send", { to: r.id });
    };
    receivers.appendChild(div);
  });
});

// Receptor recibe solicitud
socket.on("incoming-request", data => {
  const div = document.createElement("div");
  div.innerHTML = `${data.name} quiere enviarte archivos <button>Aceptar</button>`;
  div.querySelector("button").onclick = () => {
    // Crear PeerConnection en receptor
    createPeerConnection(socket, data.from, false);
    socket.emit("accept-request", { to: data.from });
    div.remove();
  };
  requests.appendChild(div);
});

// Emisor recibe confirmación de aceptación
socket.on("request-accepted", data => {
  createPeerConnection(socket, data.from, true, filesToSend);
});

// Señales WebRTC
socket.on("signal", data => {
  handleSignal(socket, data);
});