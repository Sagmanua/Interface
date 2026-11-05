/**
 * jocarsa | iu · Asistente de voz
 * Port of app.py's voice loop to the browser:
 *   standby  --"assistant"-->  active  --"stop"-->  standby
 * Listening: Web Speech API (Chrome / Edge). Answers: POST /api/chat.
 * Speaking: POST /api/tts (edge-tts), falling back to speechSynthesis.
 */
window.jocarsa = window.jocarsa || {};
window.jocarsa.iu = window.jocarsa.iu || {};

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ETIQUETAS = {
    off: "MIC OFF",
    standby: "STANDBY",
    active: "ACTIVE",
    thinking: "THINKING…",
    speaking: "SPEAKING…"
  };

  class AsistenteIU {
    constructor() {
      this.panel = $("asistente");
      this.log = $("asLog");
      this.estadoEl = $("asEstado");
      this.btnMic = $("asMic");
      this.btnAbrir = $("btnAsistente");

      this.SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.reconocedor = null;
      this.escuchando = false; // user wants the mic on
      this.activo = false;     // wake word heard (active mode)
      this.hablando = false;
      this.pensando = false;
      this.audio = null;
      this.turnoVoz = 0;

      this.enlazar();
      this.pintarEstado();

      if (!this.SR) {
        this.mensaje("system", "Voice input needs Chrome or Edge. You can still type.");
      } else if (this.leerPref()) {
        this.iniciarMic(true);
      }
    }

    // ---------------------------------------------------------------- UI
    enlazar() {
      this.btnAbrir.addEventListener("click", () => {
        this.panel.classList.contains("abierto") ? this.cerrarPanel() : this.abrirPanel();
      });
      $("asCerrar").addEventListener("click", () => this.cerrarPanel());
      this.btnMic.addEventListener("click", () => {
        this.escuchando ? this.pararMic() : this.iniciarMic(false);
      });
      $("asForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const campo = $("asTexto");
        const texto = campo.value.trim();
        if (!texto) return;
        campo.value = "";
        this.detenerVoz();
        this.consultar(texto);
      });
    }

    abrirPanel() {
      this.panel.classList.add("abierto");
      this.panel.setAttribute("aria-hidden", "false");
      document.body.classList.add("asistente-abierto");
    }

    cerrarPanel() {
      this.panel.classList.remove("abierto");
      this.panel.setAttribute("aria-hidden", "true");
      document.body.classList.remove("asistente-abierto");
      this.detenerVoz();
      this.activo = false;
      this.pintarEstado();
    }

    pintarEstado() {
      let clave = "standby";
      if (!this.escuchando) clave = "off";
      if (this.activo) clave = "active";
      if (this.pensando) clave = "thinking";
      if (this.hablando) clave = "speaking";
      this.estadoEl.textContent = ETIQUETAS[clave];
      this.panel.dataset.estado = clave;
      this.btnMic.classList.toggle("encendido", this.escuchando);
      this.btnAbrir.classList.toggle("encendido", this.escuchando);
      this.btnMic.title = this.escuchando ? "Turn microphone off" : "Turn microphone on";
    }

    mensaje(rol, texto, origen = "") {
      const nodo = document.createElement("div");
      nodo.className = `ju-as-msg ${rol}`;
      const cuerpo = document.createElement("p");
      cuerpo.textContent = texto;
      nodo.appendChild(cuerpo);
      if (origen) {
        const etiqueta = document.createElement("small");
        etiqueta.textContent = origen;
        nodo.appendChild(etiqueta);
      }
      this.log.appendChild(nodo);
      this.log.scrollTop = this.log.scrollHeight;
      return nodo;
    }

    // ------------------------------------------------------- preferences
    leerPref() {
      try { return localStorage.getItem("jocarsa.asistente.mic") === "1"; } catch { return false; }
    }
    guardarPref(valor) {
      try { localStorage.setItem("jocarsa.asistente.mic", valor ? "1" : "0"); } catch { /* ignore */ }
    }

    // ------------------------------------------------------ microphone
    iniciarMic(silencioso) {
      if (!this.SR) {
        this.abrirPanel();
        return;
      }
      this.escuchando = true;
      this.guardarPref(true);

      const rec = new this.SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = false;

      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            this.procesar(e.results[i][0].transcript);
          }
        }
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          this.escuchando = false;
          this.guardarPref(false);
          if (!silencioso) this.abrirPanel();
          this.mensaje("system", "Microphone permission was denied.");
          this.pintarEstado();
        }
      };
      rec.onend = () => {
        // The browser stops recognition after silence: keep it alive.
        if (this.escuchando) setTimeout(() => this.arrancar(rec), 300);
      };

      this.reconocedor = rec;
      this.arrancar(rec);
      this.pintarEstado();
      if (!silencioso) {
        this.abrirPanel();
        this.mensaje("system", 'Standby. Say "assistant" to wake me, "stop" to silence me.');
      }
    }

    arrancar(rec) {
      try { rec.start(); } catch { /* already started */ }
    }

    pararMic() {
      this.escuchando = false;
      this.activo = false;
      this.guardarPref(false);
      this.detenerVoz();
      try { this.reconocedor?.stop(); } catch { /* ignore */ }
      this.pintarEstado();
    }

    // ------------------------------------------------------ voice logic
    procesar(bruto) {
      let texto = bruto.toLowerCase().trim();
      if (!texto) return;

      // INTERRUPT
      if (/\bstop\b/.test(texto)) {
        this.detenerVoz();
        if (this.activo) {
          this.activo = false;
          this.mensaje("system", "Interrupted: back to standby.");
        }
        this.pintarEstado();
        return;
      }

      // WAKE WORD
      if (texto.includes("assistant")) {
        this.detenerVoz();
        this.activo = true;
        this.abrirPanel();
        texto = texto.replaceAll("assistant", "").trim();
        this.pintarEstado();
        if (!texto) {
          this.responder("I'm listening. Go ahead.");
          return;
        }
      }

      // While speaking, only "stop" / the wake word count (avoids hearing itself)
      if (this.hablando || this.pensando) return;

      if (this.activo && texto) this.consultar(texto);
    }

    async consultar(texto) {
      this.abrirPanel();
      this.mensaje("user", texto);
      this.pensando = true;
      this.pintarEstado();
      const espera = this.mensaje("bot", "Thinking…");

      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: texto })
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const datos = await r.json();
        espera.remove();
        this.pensando = false;
        this.mensaje("bot", datos.answer, datos.source);
        this.hablar(datos.answer);
      } catch (error) {
        espera.remove();
        this.pensando = false;
        this.mensaje("system", `Could not reach the assistant server (${error.message}). Run: python server.py`);
        this.pintarEstado();
      }
    }

    responder(texto) {
      this.mensaje("bot", texto);
      this.hablar(texto);
    }

    // ----------------------------------------------------------- speech
    async hablar(texto) {
      this.detenerVoz();
      const turno = ++this.turnoVoz;
      this.hablando = true;
      this.pintarEstado();

      const terminar = () => {
        if (turno !== this.turnoVoz) return;
        this.hablando = false;
        this.pintarEstado();
      };

      try {
        const r = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: texto })
        });
        if (!r.ok) throw new Error("tts");
        const url = URL.createObjectURL(await r.blob());
        if (turno !== this.turnoVoz) return URL.revokeObjectURL(url);
        const audio = new Audio(url);
        this.audio = audio;
        audio.onended = () => { URL.revokeObjectURL(url); terminar(); };
        audio.onerror = terminar;
        await audio.play();
      } catch {
        if (turno !== this.turnoVoz) return;
        if ("speechSynthesis" in window) {
          const voz = new SpeechSynthesisUtterance(texto);
          voz.lang = "en-US";
          voz.onend = terminar;
          voz.onerror = terminar;
          speechSynthesis.speak(voz);
        } else {
          terminar();
        }
      }
    }

    detenerVoz() {
      this.turnoVoz++;
      if (this.audio) {
        this.audio.pause();
        this.audio = null;
      }
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      this.hablando = false;
      this.pintarEstado();
    }
  }

  window.jocarsa.iu.AsistenteIU = AsistenteIU;

  document.addEventListener("DOMContentLoaded", () => {
    window.jocarsa.iu.asistente = new AsistenteIU();
  });
})();
