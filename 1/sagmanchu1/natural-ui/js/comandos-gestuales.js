/**
 * Ejercicio 2 · Comandos con gestos
 * MediaPipe GestureRecognizer + reglas propias:
 *   - gestos "de mantener" (hay que sostenerlos HOLD_MS para evitar falsos positivos)
 *   - deslizamiento lateral con la palma abierta (swipe)
 *   - un gesto continuo: índice arriba y mover arriba/abajo = volumen
 */
(() => {
  "use strict";
  const N = window.NUI;

  // ====== PARÁMETROS PARA LOS EJERCICIOS ======
  const HOLD_MS = 700;        // tiempo que hay que mantener el gesto
  const COOLDOWN_MS = 1200;   // pausa entre dos acciones
  const SCORE_MIN = 0.6;      // confianza mínima del reconocedor
  const SWIPE_DX = 0.35;      // desplazamiento horizontal mínimo (fracción del ancho)
  const SWIPE_MS = 500;       // ventana de tiempo del swipe

  const PISTAS = ["Pista A · Amanecer", "Pista B · Ciudad", "Pista C · Océano", "Pista D · Bosque"];
  const TEMAS = ["#225a49", "#2b5f9c", "#8a3b6e", "#a8641c", "#4b4b9e"];

  /** gesto de MediaPipe -> acción. Cambia el mapa para el ejercicio 2. */
  const ACCIONES = {
    Closed_Fist: { texto: "Pausa / reproducir", fn: () => { app.pausa = !app.pausa; } },
    Thumb_Up:    { texto: "Me gusta",           fn: () => { app.likes++; } },
    Thumb_Down:  { texto: "No me gusta",        fn: () => { app.dislikes++; } },
    Victory:     { texto: "Cambiar tema",       fn: () => { app.tema = (app.tema + 1) % TEMAS.length; } },
    ILoveYou:    { texto: "Silenciar",          fn: () => { app.silencio = !app.silencio; } }
  };
  // ============================================

  const app = { pista: 0, pausa: false, volumen: 50, likes: 0, dislikes: 0, tema: 0, silencio: false };

  const video = N.$("video"), lienzo = N.$("lienzo"), vacio = N.$("vacio");
  const elGesto = N.$("dGesto"), elProgreso = N.$("barProgreso"), elLog = N.$("registro");
  const elTarjeta = N.$("tarjeta"), elEstadoPista = N.$("dPista"), elVol = N.$("barVol");
  const elLikes = N.$("dLikes"), elVolTxt = N.$("dVol");
  let reconocedor = null, parar = null, ctx = null, ultimoT = -1;

  let gestoActual = null, inicioGesto = 0, consumido = false, enfriamiento = 0;
  let historial = [];   // posiciones de la muñeca para detectar swipes

  function registrar(txt) {
    const li = document.createElement("div");
    li.textContent = `${new Date().toLocaleTimeString()} · ${txt}`;
    elLog.prepend(li);
    while (elLog.children.length > 30) elLog.lastChild.remove();
  }

  function pintar() {
    elTarjeta.textContent = PISTAS[app.pista];
    elTarjeta.style.setProperty("--tarjeta", TEMAS[app.tema]);
    elEstadoPista.textContent = app.pausa ? "⏸ en pausa" : "▶ sonando";
    const vol = app.silencio ? 0 : app.volumen;
    elVol.style.width = `${vol}%`;
    elVolTxt.textContent = app.silencio ? "🔇 silencio" : `🔊 ${vol}%`;
    elLikes.textContent = `👍 ${app.likes}   👎 ${app.dislikes}`;
  }

  N.$("btnCamara").addEventListener("click", async () => {
    if (parar) return;
    try {
      N.estado("estado", "Cargando el modelo de gestos…");
      reconocedor ||= await N.crearGestureRecognizer({ numHands: 1 });
      await N.iniciarCamara(video);
      ctx = N.prepararCanvas(lienzo, video);
      vacio.hidden = true;
      parar = N.bucle(fotograma);
      N.estado("estado", "Listo. Prueba: puño, pulgar, victoria, palma deslizándose, índice arriba.", "ok");
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

  function siguientePista(dir) {
    app.pista = (app.pista + dir + PISTAS.length) % PISTAS.length;
    registrar(dir > 0 ? "Deslizar → siguiente pista" : "Deslizar ← pista anterior");
  }

  function fotograma() {
    if (video.readyState < 2 || video.currentTime === ultimoT) return;
    ultimoT = video.currentTime;
    const ahora = performance.now();

    const res = reconocedor.recognizeForVideo(video, ahora);
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);

    const mano = res.landmarks?.[0];
    const g = res.gestures?.[0]?.[0];
    if (!mano || !g) {
      elGesto.textContent = "–";
      elProgreso.style.width = "0";
      gestoActual = null; historial = [];
      return;
    }

    N.dibujarMano(ctx, mano);
    const nombre = g.score >= SCORE_MIN ? g.categoryName : "None";
    elGesto.textContent = `${nombre} (${Math.round(g.score * 100)}%)`;

    // --- gestos de mantener
    if (nombre !== gestoActual) { gestoActual = nombre; inicioGesto = ahora; consumido = false; }
    const accion = ACCIONES[nombre];
    if (accion && !consumido) {
      const prog = Math.min(1, (ahora - inicioGesto) / HOLD_MS);
      elProgreso.style.width = `${prog * 100}%`;
      if (prog >= 1 && ahora > enfriamiento) {
        accion.fn();
        registrar(accion.texto);
        enfriamiento = ahora + COOLDOWN_MS;
        consumido = true;
      }
    } else if (!accion) {
      elProgreso.style.width = "0";
    }

    // --- volumen continuo con el índice arriba
    if (nombre === "Pointing_Up") {
      const y = mano[8].y;                                  // 0 arriba .. 1 abajo
      app.volumen = Math.round(100 * (1 - Math.min(1, Math.max(0, (y - 0.1) / 0.7))));
      app.silencio = false;
    }

    // --- swipe con la palma abierta (x espejada: derecha = derecha de la pantalla)
    if (nombre === "Open_Palm") {
      historial.push({ t: ahora, x: 1 - mano[0].x });
      historial = historial.filter((h) => ahora - h.t <= SWIPE_MS);
      if (historial.length > 2 && ahora > enfriamiento) {
        const dx = historial[historial.length - 1].x - historial[0].x;
        if (Math.abs(dx) > SWIPE_DX) {
          siguientePista(dx > 0 ? 1 : -1);
          enfriamiento = ahora + COOLDOWN_MS;
          historial = [];
        }
      }
    } else {
      historial = [];
    }
    pintar();
  }

  pintar();
})();
