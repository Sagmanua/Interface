/**
 * Ejercicio 3 · Rostro: detección, expresiones e identificación
 * face-api.js (vladmandic): detector TinyFaceDetector + 68 puntos + expresiones
 * + descriptor de 128 números para comparar caras.
 * PRIVACIDAD: todo ocurre en tu navegador; las muestras se guardan solo en localStorage.
 */
(() => {
  "use strict";
  const N = window.NUI;

  // ====== PARÁMETROS PARA LOS EJERCICIOS ======
  const UMBRAL_IDENTIDAD = 0.5;   // distancia euclídea máxima para decir "es esa persona"
  const MUESTRAS = 3;             // descriptores a capturar al registrar una cara
  const MS_ENTRE_DESCRIPTORES = 600;
  const MS_PARA_DESBLOQUEAR = 1500;
  const MS_PARA_BLOQUEAR = 3000;
  const CLAVE = "jocarsa.nui.caras";
  const MODELOS = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/";
  const EXPRESIONES = { neutral: "Neutral", happy: "Alegre", sad: "Triste", angry: "Enfadado", fearful: "Asustado", disgusted: "Disgusto", surprised: "Sorpresa" };
  // ============================================

  const video = N.$("video"), lienzo = N.$("lienzo"), vacio = N.$("vacio");
  const opciones = () => new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  let cargado = false, corriendo = false, ctx = null;
  let capturando = null;          // { nombre, muestras: [] }
  let ultimoDesc = 0, ultimaId = null, conocidoDesde = 0, ultimoConocido = 0;

  // ---------- almacenamiento local ----------
  const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
  const guardar = (d) => { try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch { /* ignorar */ } };

  function pintarRegistrados() {
    const d = leer();
    const nombres = Object.keys(d);
    N.$("registrados").textContent = nombres.length
      ? nombres.map((n) => `${n} (${d[n].length} muestras)`).join(" · ")
      : "Nadie registrado todavía.";
  }

  // ---------- barras de expresiones ----------
  const barras = {};
  const cont = N.$("expresiones");
  for (const [k, txt] of Object.entries(EXPRESIONES)) {
    const fila = document.createElement("div");
    fila.innerHTML = `<div class="nui-dato"><span>${txt}</span><b>0%</b></div><div class="nui-barra"><i></i></div>`;
    cont.appendChild(fila);
    barras[k] = { num: fila.querySelector("b"), barra: fila.querySelector("i") };
  }

  // ---------- cámara y modelos ----------
  N.$("btnCamara").addEventListener("click", async () => {
    if (corriendo) return;
    try {
      if (typeof faceapi === "undefined") throw new Error("No se pudo cargar face-api.js (¿sin conexión?).");
      if (!cargado) {
        N.estado("estado", "Cargando modelos de rostro (~6 MB la primera vez)…");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELOS),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELOS),
          faceapi.nets.faceExpressionNet.loadFromUri(MODELOS),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELOS)
        ]);
        cargado = true;
      }
      await N.iniciarCamara(video);
      ctx = N.prepararCanvas(lienzo, video);
      vacio.hidden = true;
      corriendo = true;
      N.estado("estado", "Cámara activa. Colócate frente a la cámara con buena luz.", "ok");
      ciclo();
    } catch (e) {
      N.estado("estado", `No se pudo iniciar: ${e.message}`, "error");
    }
  });

  N.$("btnParar").addEventListener("click", () => {
    corriendo = false;
    N.detenerCamara(video);
    ctx?.clearRect(0, 0, lienzo.width, lienzo.height);
    vacio.hidden = false;
    N.estado("estado", "Cámara detenida.");
  });

  N.$("btnRegistrar").addEventListener("click", () => {
    const nombre = N.$("nombre").value.trim();
    if (!corriendo) return N.estado("estado", "Activa primero la cámara.", "error");
    if (!nombre) return N.estado("estado", "Escribe un nombre para registrar tu cara.", "error");
    capturando = { nombre, muestras: [] };
    N.estado("estado", `Capturando ${MUESTRAS} muestras de «${nombre}»… mira a la cámara y mueve un poco la cabeza.`);
  });

  N.$("btnBorrar").addEventListener("click", () => {
    try { localStorage.removeItem(CLAVE); } catch { /* ignorar */ }
    ultimaId = null;
    pintarRegistrados();
    N.estado("estado", "Datos faciales borrados de este navegador.", "ok");
  });

  async function ciclo() {
    while (corriendo) {
      if (video.readyState >= 2) await analizar();
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  async function analizar() {
    const W = lienzo.width, H = lienzo.height;
    const caras = await faceapi.detectAllFaces(video, opciones()).withFaceLandmarks().withFaceExpressions();
    if (!corriendo) return;
    ctx.clearRect(0, 0, W, H);
    N.$("dCaras").textContent = caras.length;

    const ahora = performance.now();
    if (!caras.length) {
      for (const b of Object.values(barras)) { b.num.textContent = "0%"; b.barra.style.width = "0"; }
      actualizarBloqueo(ahora, null);
      return;
    }

    for (const c of caras) {
      const { x, y, width, height } = c.detection.box;
      const bx = W - (x + width);                         // espejo
      ctx.strokeStyle = "#3ddc97"; ctx.lineWidth = 3;
      ctx.strokeRect(bx, y, width, height);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      for (const p of c.landmarks.positions) ctx.fillRect(W - p.x - 1.5, p.y - 1.5, 3, 3);

      if (ultimaId && ahora - ultimaId.t < 1500) {
        const txt = ultimaId.nombre ? `${ultimaId.nombre} · ${ultimaId.dist.toFixed(2)}` : `desconocido · ${ultimaId.dist.toFixed(2)}`;
        ctx.font = "bold 18px Ubuntu, Arial"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
        ctx.fillStyle = ultimaId.nombre ? "#3ddc97" : "#f5b83d";
        ctx.fillRect(bx, y - 26, ctx.measureText(txt).width + 12, 26);
        ctx.fillStyle = "#07120f";
        ctx.fillText(txt, bx + 6, y - 4);
      }
    }

    // Expresiones de la primera cara
    const ex = caras[0].expressions;
    for (const k of Object.keys(EXPRESIONES)) {
      const v = ex[k] || 0;
      barras[k].num.textContent = `${Math.round(v * 100)}%`;
      barras[k].barra.style.width = `${v * 100}%`;
    }

    // Descriptor (más caro): solo si hay algo que comparar o estamos registrando
    const hayRegistros = Object.keys(leer()).length > 0;
    if ((capturando || hayRegistros) && ahora - ultimoDesc > MS_ENTRE_DESCRIPTORES) {
      ultimoDesc = ahora;
      const d = await faceapi.detectSingleFace(video, opciones()).withFaceLandmarks().withFaceDescriptor();
      if (d) procesarDescriptor(d.descriptor, ahora);
    }
    actualizarBloqueo(ahora, ultimaId && ahora - ultimaId.t < 2000 ? ultimaId.nombre : null);
  }

  function procesarDescriptor(desc, ahora) {
    if (capturando) {
      capturando.muestras.push(Array.from(desc));
      N.estado("estado", `Muestra ${capturando.muestras.length}/${MUESTRAS} de «${capturando.nombre}»…`);
      if (capturando.muestras.length >= MUESTRAS) {
        const d = leer();
        d[capturando.nombre] = (d[capturando.nombre] || []).concat(capturando.muestras);
        guardar(d);
        N.estado("estado", `«${capturando.nombre}» registrado. Ahora el sistema debería reconocerte.`, "ok");
        capturando = null;
        pintarRegistrados();
      }
      return;
    }
    const d = leer();
    let mejor = { nombre: null, dist: Infinity };
    for (const [nombre, muestras] of Object.entries(d)) {
      for (const m of muestras) {
        const dist = faceapi.euclideanDistance(desc, m);
        if (dist < mejor.dist) mejor = { nombre, dist };
      }
    }
    ultimaId = { nombre: mejor.dist < UMBRAL_IDENTIDAD ? mejor.nombre : null, dist: mejor.dist, t: ahora };
    N.$("dIdentidad").textContent = ultimaId.nombre ? `${ultimaId.nombre} (d=${mejor.dist.toFixed(2)})` : `desconocido (d=${mejor.dist.toFixed(2)})`;
  }

  // ---------- "login facial" de demostración ----------
  function actualizarBloqueo(ahora, nombre) {
    const el = N.$("bloqueo");
    if (nombre) {
      conocidoDesde ||= ahora;
      ultimoConocido = ahora;
      if (ahora - conocidoDesde >= MS_PARA_DESBLOQUEAR) {
        el.classList.add("abierto");
        el.textContent = `🔓 Desbloqueado · hola, ${nombre}`;
      } else {
        el.textContent = `Verificando a ${nombre}… ${Math.round(((ahora - conocidoDesde) / MS_PARA_DESBLOQUEAR) * 100)}%`;
      }
    } else {
      conocidoDesde = 0;
      if (ahora - ultimoConocido > MS_PARA_BLOQUEAR) {
        el.classList.remove("abierto");
        el.textContent = "🔒 Bloqueado · muestra una cara registrada";
      }
    }
  }

  pintarRegistrados();
})();
