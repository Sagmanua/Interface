/**
 * Ejercicio 4a · Realidad aumentada con la cámara
 * Accesorios virtuales (gafas, sombrero, bigote) anclados a los 68 puntos de la cara.
 * Todo se calcula en el navegador; la foto se descarga sin subirse a ningún sitio.
 */
(() => {
  "use strict";
  const N = window.NUI;

  // ====== PARÁMETROS PARA LOS EJERCICIOS ======
  const MODELOS = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/";
  const COLOR_GAFAS = "#111111";
  const COLOR_SOMBRERO = "#1d1d1d";
  const COLOR_BANDA = "#c0392b";
  const COLOR_BIGOTE = "#3b2314";
  // ============================================

  const video = N.$("video"), lienzo = N.$("lienzo"), vacio = N.$("vacio");
  let cargado = false, corriendo = false, ctx = null;

  const media = (pts, desde, hasta, W) => {
    let x = 0, y = 0, n = 0;
    for (let i = desde; i <= hasta; i++) { x += W - pts[i].x; y += pts[i].y; n++; }
    return { x: x / n, y: y / n };
  };

  function dibujarAccesorios(pts, W) {
    // Puntos 36-41: ojo a la izquierda de la imagen original (derecha tras el espejo)
    const A = media(pts, 42, 47, W);          // ojo que queda a la izquierda de la pantalla
    const B = media(pts, 36, 41, W);          // ojo que queda a la derecha de la pantalla
    const centro = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const d = Math.hypot(B.x - A.x, B.y - A.y);    // distancia entre ojos = escala
    const angulo = Math.atan2(B.y - A.y, B.x - A.x);

    if (N.$("chkSombrero").checked) {
      ctx.save();
      ctx.translate(centro.x, centro.y); ctx.rotate(angulo);
      ctx.fillStyle = COLOR_SOMBRERO;
      ctx.fillRect(-d * 1.1, -d * 1.12, d * 2.2, d * 0.16);              // ala
      ctx.fillRect(-d * 0.68, -d * 2.0, d * 1.36, d * 0.9);              // copa
      ctx.fillStyle = COLOR_BANDA;
      ctx.fillRect(-d * 0.68, -d * 1.22, d * 1.36, d * 0.16);            // banda
      ctx.restore();
    }

    if (N.$("chkGafas").checked) {
      ctx.save();
      ctx.translate(centro.x, centro.y); ctx.rotate(angulo);
      ctx.lineWidth = Math.max(3, d * 0.06);
      ctx.strokeStyle = COLOR_GAFAS; ctx.fillStyle = "rgba(20,20,20,.35)";
      for (const dx of [-d / 2, d / 2]) {
        ctx.beginPath(); ctx.arc(dx, 0, d * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-d * 0.14, 0); ctx.lineTo(d * 0.14, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-d * 0.86, -d * 0.02); ctx.lineTo(-d * 1.15, -d * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(d * 0.86, -d * 0.02); ctx.lineTo(d * 1.15, -d * 0.1); ctx.stroke();
      ctx.restore();
    }

    if (N.$("chkBigote").checked) {
      // Entre la base de la nariz (33) y el labio superior (51)
      const m = { x: (W - pts[33].x + W - pts[51].x) / 2, y: (pts[33].y + pts[51].y) / 2 };
      ctx.save();
      ctx.translate(m.x, m.y + d * 0.04); ctx.rotate(angulo);
      ctx.fillStyle = COLOR_BIGOTE;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(lado * d * 0.25, -d * 0.18, lado * d * 0.6, -d * 0.12, lado * d * 0.72, d * 0.1);
        ctx.bezierCurveTo(lado * d * 0.5, d * 0.02, lado * d * 0.25, d * 0.1, 0, d * 0.1);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  N.$("btnCamara").addEventListener("click", async () => {
    if (corriendo) return;
    try {
      if (typeof faceapi === "undefined") throw new Error("No se pudo cargar face-api.js (¿sin conexión?).");
      if (!cargado) {
        N.estado("estadoAR", "Cargando modelos de rostro…");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELOS),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELOS)
        ]);
        cargado = true;
      }
      await N.iniciarCamara(video);
      ctx = N.prepararCanvas(lienzo, video);
      vacio.hidden = true;
      corriendo = true;
      N.estado("estadoAR", "AR activa. Elige accesorios con las casillas.", "ok");
      ciclo();
    } catch (e) {
      N.estado("estadoAR", `No se pudo iniciar: ${e.message}`, "error");
    }
  });

  N.$("btnParar").addEventListener("click", () => {
    corriendo = false;
    N.detenerCamara(video);
    ctx?.clearRect(0, 0, lienzo.width, lienzo.height);
    vacio.hidden = false;
    N.estado("estadoAR", "Cámara detenida.");
  });

  N.$("btnFoto").addEventListener("click", () => {
    if (!corriendo) return N.estado("estadoAR", "Activa primero la cámara.", "error");
    const c = document.createElement("canvas");
    c.width = lienzo.width; c.height = lienzo.height;
    const g = c.getContext("2d");
    g.translate(c.width, 0); g.scale(-1, 1);            // el vídeo se guarda en espejo, como se ve
    g.drawImage(video, 0, 0, c.width, c.height);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(lienzo, 0, 0);
    const a = document.createElement("a");
    a.download = "ar-foto.png";
    a.href = c.toDataURL("image/png");
    a.click();
  });

  async function ciclo() {
    while (corriendo) {
      if (video.readyState >= 2) {
        const r = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks();
        if (!corriendo) break;
        ctx.clearRect(0, 0, lienzo.width, lienzo.height);
        if (r) dibujarAccesorios(r.landmarks.positions, lienzo.width);
      }
      await new Promise((res) => requestAnimationFrame(res));
    }
  }
})();
