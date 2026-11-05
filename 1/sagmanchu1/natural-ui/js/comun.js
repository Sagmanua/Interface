/**
 * Interfaces naturales · utilidades compartidas por todos los ejercicios.
 * Se carga como script normal y expone window.NUI.
 */
window.NUI = (() => {
  "use strict";

  const MP_VERSION = "0.10.14";
  const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
  const MP_MODELOS = "https://storage.googleapis.com/mediapipe-models";

  /** Conexiones del esqueleto de la mano (21 puntos de MediaPipe). */
  const CONEXIONES_MANO = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
  ];

  const $ = (id) => document.getElementById(id);

  /** Mensaje de estado (tipo: "", "ok" o "error"). */
  function estado(id, texto, tipo = "") {
    const el = $(id);
    if (!el) return;
    el.textContent = texto;
    el.className = `nui-estado ${tipo}`.trim();
  }

  /** Enciende la cámara frontal en un <video>. Devuelve el MediaStream. */
  async function iniciarCamara(video) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador no ofrece cámara (¿estás en http://localhost o https?).");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false
    });
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    return stream;
  }

  function detenerCamara(video) {
    video.srcObject?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }

  /** Carga MediaPipe Tasks Vision (módulo ES) + wasm. Se hace una sola vez. */
  let _vision;
  async function cargarVision() {
    if (!_vision) {
      _vision = (async () => {
        const mod = await import(`${MP_BASE}/+esm`);
        const fileset = await mod.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
        return { mod, fileset };
      })();
    }
    return _vision;
  }

  async function crearHandLandmarker(opciones = {}) {
    const { mod, fileset } = await cargarVision();
    return mod.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${MP_MODELOS}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task` },
      runningMode: "VIDEO",
      numHands: 2,
      ...opciones
    });
  }

  async function crearGestureRecognizer(opciones = {}) {
    const { mod, fileset } = await cargarVision();
    return mod.GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${MP_MODELOS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task` },
      runningMode: "VIDEO",
      numHands: 1,
      ...opciones
    });
  }

  /** Ajusta el canvas al tamaño real del vídeo y devuelve su contexto 2D. */
  function prepararCanvas(canvas, video) {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    return canvas.getContext("2d");
  }

  /** Coordenada X espejada (el vídeo se muestra como un espejo). */
  const espejoX = (x, ancho) => (1 - x) * ancho;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));

  function dibujarMano(ctx, puntos, color = "#3ddc97") {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    for (const [a, b] of CONEXIONES_MANO) {
      ctx.beginPath();
      ctx.moveTo(espejoX(puntos[a].x, W), puntos[a].y * H);
      ctx.lineTo(espejoX(puntos[b].x, W), puntos[b].y * H);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    for (const p of puntos) {
      ctx.beginPath();
      ctx.arc(espejoX(p.x, W), p.y * H, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Cuenta los dedos extendidos de una mano (21 puntos normalizados).
   * Un dedo cuenta como extendido si su punta está más lejos de la muñeca
   * que su articulación media: no depende de la orientación de la mano.
   */
  function contarDedos(p) {
    const muneca = p[0];
    let n = 0;
    const dedos = [[8, 6], [12, 10], [16, 14], [20, 18]]; // punta, articulación PIP
    for (const [punta, pip] of dedos) if (dist(p[punta], muneca) > dist(p[pip], muneca) * 1.1) n++;
    // Pulgar: la punta se aleja de la base del meñique
    if (dist(p[4], p[17]) > dist(p[3], p[17]) * 1.05) n++;
    return n;
  }

  /** Distancia pulgar–índice relativa al tamaño de la mano (0 = juntos). */
  function pinza(p) {
    const tam = dist(p[0], p[9]) || 1;
    return dist(p[4], p[8]) / tam;
  }

  /** Lanza una función en bucle de animación; devuelve una función para pararlo. */
  function bucle(fn) {
    let vivo = true;
    const paso = (t) => {
      if (!vivo) return;
      try { fn(t); } catch (e) { console.error(e); }
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    return () => { vivo = false; };
  }

  return {
    $, estado, iniciarCamara, detenerCamara,
    cargarVision, crearHandLandmarker, crearGestureRecognizer,
    prepararCanvas, espejoX, dist, dibujarMano, contarDedos, pinza, bucle
  };
})();
