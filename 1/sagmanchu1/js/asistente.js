/**
 * jocarsa | iu · Asistente de voz
 *   standby --"assistant"--> active --"stop"--> standby
 *   Comandos de voz sobre la interfaz (js/voz-comandos.js) + modo dictado.
 * Escucha: Web Speech API (Chrome / Edge). Respuestas: POST /api/chat.
 * Voz: POST /api/tts (edge-tts), con speechSynthesis como alternativa.
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
    dictating: "DICTATING",
    thinking: "THINKING…",
    speaking: "SPEAKING…"
  };
  const PLACEHOLDER = {
    "en-US": "Type a command or a question…",
    "es-ES": "Escribe un comando o una pregunta…",
    "ru-RU": "Введите команду или вопрос…"
  };
  // Estos mensajes no se leen en voz alta (largos o redundantes).
  const SIN_VOZ = new Set(["ayuda", "dictar", "finDictado", "siguiente", "anterior"]);

  class AsistenteIU {
    constructor() {
      this.voz = window.jocarsa.iu.voz;
      this.comandos = new this.voz.ComandosVoz();

      this.panel = $("asistente");
      this.log = $("asLog");
      this.estadoEl = $("asEstado");
      this.btnMic = $("asMic");
      this.btnDictado = $("asDictado");
      this.btnAbrir = $("btnAsistente");
      this.selIdioma = $("asIdioma");

      this.SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.reconocedor = null;
      this.escuchando = false; // el usuario quiere el micrófono encendido
      this.activo = false;     // palabra de activación oída
      this.dictando = false;   // modo dictado
      this.hablando = false;
      this.pensando = false;
      this.audio = null;
      this.turnoVoz = 0;
      this.ultimoCampo = null;
      this.campoMarcado = null;
      this.idioma = this.leerIdioma();

      this.selIdioma.value = this.idioma;
      $("asTexto").placeholder = PLACEHOLDER[this.idioma];

      this.enlazar();
      this.pintarEstado();

      if (!this.SR) {
        this.mensaje("system", "Voice input needs Chrome or Edge. You can still type commands.");
      } else if (this.leerPref()) {
        this.iniciarMic(true);
      }
    }

    get T() {
      return this.voz.IDIOMAS[this.idioma].t;
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
      this.btnDictado.addEventListener("click", () => {
        if (this.dictando) {
          this.detenerDictado();
          this.mensaje("system", this.T.dictOff);
          return;
        }
        if (!this.escuchando) this.iniciarMic(true);
        this.mensaje("system", this.iniciarDictado());
      });
      this.selIdioma.addEventListener("change", () => this.cambiarIdioma(this.selIdioma.value));

      $("asForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const campo = $("asTexto");
        const texto = campo.value.trim();
        if (!texto) return;
        campo.value = "";
        this.detenerVoz();
        this.despachar(texto);
      });

      // Recuerda el último campo del formulario enfocado (destino del dictado).
      document.addEventListener("focusin", (e) => {
        const c = e.target;
        if (!c.matches || !c.matches("input,select,textarea")) return;
        if (c.closest("#asistente")) return;
        if (["submit", "button", "hidden", "reset", "file"].includes(c.type)) return;
        this.ultimoCampo = c;
        if (this.dictando) this.marcarCampo(c);
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
      this.detenerDictado();
      this.activo = false;
      this.pintarEstado();
    }

    pintarEstado() {
      let clave = "standby";
      if (!this.escuchando) clave = "off";
      if (this.activo) clave = "active";
      if (this.dictando) clave = "dictating";
      if (this.pensando) clave = "thinking";
      if (this.hablando) clave = "speaking";
      this.estadoEl.textContent = ETIQUETAS[clave];
      this.panel.dataset.estado = clave;
      this.btnMic.classList.toggle("encendido", this.escuchando);
      this.btnAbrir.classList.toggle("encendido", this.escuchando);
      this.btnDictado.classList.toggle("encendido", this.dictando);
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

    // ------------------------------------------------------- preferencias
    leerPref() {
      try { return localStorage.getItem("jocarsa.asistente.mic") === "1"; } catch { return false; }
    }
    guardarPref(valor) {
      try { localStorage.setItem("jocarsa.asistente.mic", valor ? "1" : "0"); } catch { /* ignorar */ }
    }
    leerIdioma() {
      try {
        const g = localStorage.getItem("jocarsa.asistente.idioma");
        if (g && this.voz.IDIOMAS[g]) return g;
      } catch { /* ignorar */ }
      const n = (navigator.language || "en").toLowerCase();
      if (n.startsWith("ru")) return "ru-RU";
      if (n.startsWith("es")) return "es-ES";
      return "en-US";
    }

    cambiarIdioma(id) {
      if (!this.voz.IDIOMAS[id]) return;
      this.idioma = id;
      try { localStorage.setItem("jocarsa.asistente.idioma", id); } catch { /* ignorar */ }
      $("asTexto").placeholder = PLACEHOLDER[id];
      this.detenerVoz();
      if (this.reconocedor) {
        this.reconocedor.lang = id;
        // onend vuelve a arrancar el reconocedor con el idioma nuevo
        try { this.reconocedor.stop(); } catch { /* ignorar */ }
      }
      if (this.escuchando) this.mensaje("system", this.T.standby);
    }

    // ------------------------------------------------------ micrófono
    iniciarMic(silencioso) {
      if (!this.SR) {
        this.abrirPanel();
        return;
      }
      if (this.reconocedor && this.escuchando) return;

      this.escuchando = true;
      this.guardarPref(true);

      const rec = new this.SR();
      rec.lang = this.idioma;
      rec.continuous = true;
      rec.interimResults = false;

      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) this.procesar(e.results[i][0].transcript);
        }
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          this.escuchando = false;
          this.dictando = false;
          this.guardarPref(false);
          if (!silencioso) this.abrirPanel();
          this.mensaje("system", "Microphone permission was denied.");
          this.pintarEstado();
        }
      };
      rec.onend = () => {
        // El navegador corta el reconocimiento tras un silencio: se mantiene vivo.
        if (this.escuchando) setTimeout(() => this.arrancar(rec), 300);
      };

      this.reconocedor = rec;
      this.arrancar(rec);
      this.pintarEstado();
      if (!silencioso) {
        this.abrirPanel();
        this.mensaje("system", this.T.standby);
      }
    }

    arrancar(rec) {
      try { rec.start(); } catch { /* ya iniciado */ }
    }

    pararMic() {
      this.escuchando = false;
      this.activo = false;
      this.guardarPref(false);
      this.detenerVoz();
      this.detenerDictado();
      try { this.reconocedor?.stop(); } catch { /* ignorar */ }
      this.reconocedor = null;
      this.pintarEstado();
    }

    // ------------------------------------------------------- dictado
    iniciarDictado() {
      if (!this.SR) return "Voice input needs Chrome or Edge.";
      const campo = this.comandos.campoActual(this);
      if (!campo) return this.T.noCampo;
      this.dictando = true;
      this.marcarCampo(campo);
      this.ultimoCampo = campo;
      this.pintarEstado();
      return this.T.dictOn;
    }

    detenerDictado() {
      this.dictando = false;
      this.marcarCampo(null);
      this.pintarEstado();
    }

    marcarCampo(campo) {
      this.campoMarcado?.classList.remove("ju-dictando");
      this.campoMarcado = campo;
      campo?.classList.add("ju-dictando");
    }

    // ------------------------------------------------------ lógica de voz
    procesar(bruto) {
      const { IDIOMAS, norm, COMANDOS_EN_DICTADO } = this.voz;
      const L = IDIOMAS[this.idioma];
      let texto = norm(bruto);
      if (!texto) return;

      const esStop = L.stop.some((s) => texto.split(" ").includes(s));

      // --- DICTADO: todo lo que se oye es texto, salvo unos pocos comandos.
      if (this.dictando) {
        const cmd = this.comandos.interpretar(texto, this.idioma);
        if (cmd && COMANDOS_EN_DICTADO.has(cmd.id)) {
          const r = this.comandos.ejecutar(cmd, this);
          if (r) this.mensaje("system", r);
          return;
        }
        if (L.stop.includes(texto)) {
          this.detenerVoz();
          this.detenerDictado();
          this.mensaje("system", this.T.dictOff);
          return;
        }
        const campo = this.comandos.campoActual(this);
        if (!campo) {
          this.detenerDictado();
          this.mensaje("system", this.T.noCampo);
          return;
        }
        if (this.comandos.insertar(campo, bruto.trim(), this.idioma)) {
          this.ultimoCampo = campo;
          this.marcarCampo(campo);
        } else {
          this.mensaje("system", `${this.T.noInsertable} (${bruto.trim()})`);
        }
        return;
      }

      // --- INTERRUPCIÓN
      if (esStop) {
        this.detenerVoz();
        if (this.activo) {
          this.activo = false;
          this.mensaje("system", "Interrupted: back to standby.");
        }
        this.pintarEstado();
        return;
      }

      // --- PALABRA DE ACTIVACIÓN
      if (L.wake.some((w) => texto.includes(w))) {
        this.detenerVoz();
        this.activo = true;
        this.abrirPanel();
        for (const w of L.wake) texto = texto.replaceAll(w, "");
        texto = texto.trim();
        this.pintarEstado();
        if (!texto) {
          this.responder(this.T.escucho);
          return;
        }
      }

      // Mientras habla, solo cuentan "stop" y la palabra de activación (evita oírse a sí mismo).
      if (this.hablando || this.pensando) return;

      if (this.activo && texto) this.despachar(texto);
    }

    /** Comando de interfaz si lo es; si no, consulta al chatbot. */
    despachar(textoOriginal) {
      const texto = this.voz.norm(textoOriginal);
      const cmd = this.comandos.interpretar(texto, this.idioma);

      if (!cmd) {
        this.consultar(textoOriginal);
        return;
      }

      this.abrirPanel();
      this.mensaje("user", textoOriginal);
      const respuesta = this.comandos.ejecutar(cmd, this);
      if (!respuesta) return;
      this.mensaje("bot", respuesta, "command");
      if (!SIN_VOZ.has(cmd.id) && !this.dictando) this.hablar(respuesta);
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
          body: JSON.stringify({ text: texto, lang: this.idioma })
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

    // ----------------------------------------------------------- habla
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
          body: JSON.stringify({ text: texto, lang: this.idioma })
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
          voz.lang = this.idioma;
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
