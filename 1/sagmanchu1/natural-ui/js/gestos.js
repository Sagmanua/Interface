/**
 * Ejercicio 1 · Gestos con la mano
 * MediaPipe HandLandmarker: 21 puntos por mano, contador de dedos, pinza y un
 * mini juego: mueve el cursor con el índice y "haz clic" juntando pulgar e índice.
 */
(() => {
  "use strict";
  const N = window.NUI;

  // ====== PARÁMETROS PARA LOS EJERCICIOS ======
  const UMBRAL_PINZA = 0.30;   // ratio pulgar-índice / tamaño de mano por debajo del cual hay "clic"
  const MANOS = 2;             // número máximo de manos
  const OBJETIVOS = [          // zonas "clicables" (coordenadas relativas 0..1 del vídeo)
    { x: 0.06, y: 0.08, w: 0.22, h: 0.2, color: "#e0524a", letra: "A", activo: false },
    { x: 0.72, y: 0.08, w: 0.22, h: 0.2, color: "#2b7fd6", letra: "B", activo: false },
    { x: 0.06, y: 0.72, w: 0.22, h: 0.2, color: "#f5b83d", letra: "C", activo: false },
    { x: 0.72, y: 0.72, w: 0.22, h: 0.2, color: "#3ddc97", letra: "D", activo: false }
  ];
  // ============================================

  const video = N.$("video"), lienzo = N.$("lienzo"), vacio = N.$("vacio");
  const elManos = N.$("dManos"), elDedos = N.$("dDedos"), elPinza = N.$("dPinza"), barra = N.$("barPinza");
  let landmarker = null, parar = null, ctx = null, ultimoT = -1, pinzaAntes = false;

  N.$("btnCamara").addEventListener("click", async () => {
    if (parar) return;
    try {
      N.estado("estado", "Cargando el modelo de manos (primera vez ~10 MB)…");
      landmarker ||= await N.crearHandLandmarker({ numHands: MANOS });
      await N.iniciarCamara(video);
      ctx = N.prepararCanvas(lienzo, video);
      vacio.hidden = true;
      parar = N.bucle(fotograma);
      N.estado("estado", "Cámara activa. Enseña una mano a la cámara.", "ok");
    } catch (e) {
      N.estado("estado", `No se pudo iniciar: ${e.message}`, "error");
    }
  });

  N.$("btnParar").addEventListener("click", () => {
    parar?.(); parar = null;
    N.detenerCamara(video);
    ctx?.clearRect(0, 0, lienzo.width, lienzo.height);
    vacio.hidden = false;
    N.estado("estado", "Cámara detenida.");
  });

  function dibujarObjetivos() {
    const W = lienzo.width, H = lienzo.height;
    for (const o of OBJETIVOS) {
      ctx.globalAlpha = o.activo ? 0.85 : 0.35;
      ctx.fillStyle = o.color;
      ctx.fillRect(o.x * W, o.y * H, o.w * W, o.h * H);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.strokeRect(o.x * W, o.y * H, o.w * W, o.h * H);
      ctx.fillStyle = "#fff"; ctx.font = "bold 28px Ubuntu, Arial";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(o.letra + (o.activo ? " ✓" : ""), (o.x + o.w / 2) * W, (o.y + o.h / 2) * H);
    }
  }

  function fotograma(t) {
    if (video.readyState < 2 || video.currentTime === ultimoT) return;
    ultimoT = video.currentTime;

    const res = landmarker.detectForVideo(video, performance.now());
    const W = lienzo.width, H = lienzo.height;
    ctx.clearRect(0, 0, W, H);
    dibujarObjetivos();

    const manos = res.landmarks || [];
    elManos.textContent = manos.length;
    if (!manos.length) {
      elDedos.textContent = "–"; elPinza.textContent = "–"; barra.style.width = "0";
      pinzaAntes = false;
      return;
    }

    elDedos.textContent = manos.map((m) => N.contarDedos(m)).join(" + ");

    manos.forEach((p, i) => N.dibujarMano(ctx, p, i === 0 ? "#3ddc97" : "#f5b83d"));

    // La primera mano controla el cursor (punto medio entre pulgar e índice)
    const p = manos[0];
    const ratio = N.pinza(p);
    const hayClic = ratio < UMBRAL_PINZA;
    elPinza.textContent = ratio.toFixed(2);
    barra.style.width = `${Math.min(100, (ratio / 0.8) * 100)}%`;

    const cx = N.espejoX((p[4].x + p[8].x) / 2, W);
    const cy = ((p[4].y + p[8].y) / 2) * H;
    ctx.beginPath();
    ctx.arc(cx, cy, hayClic ? 12 : 16, 0, Math.PI * 2);
    ctx.fillStyle = hayClic ? "rgba(224,82,74,.9)" : "rgba(255,255,255,.35)";
    ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();

    if (hayClic && !pinzaAntes) {  // flanco de subida = un clic
      for (const o of OBJETIVOS) {
        if (cx >= o.x * W && cx <= (o.x + o.w) * W && cy >= o.y * H && cy <= (o.y + o.h) * H) {
          o.activo = !o.activo;
        }
      }
    }
    pinzaAntes = hayClic;
  }
})();
