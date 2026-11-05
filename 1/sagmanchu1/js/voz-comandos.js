/**
 * jocarsa | iu · Comandos de voz y dictado
 * Diccionarios por idioma (en / es / ru) + intérprete de comandos + inserción
 * de texto dictado en el campo activo del formulario.
 * Se carga ANTES de asistente.js.
 */
window.jocarsa = window.jocarsa || {};
window.jocarsa.iu = window.jocarsa.iu || {};

(() => {
  "use strict";

  /** Minúsculas, sin puntuación, espacios simples (no toca letras ni cirílico). */
  const norm = (t) =>
    String(t).toLowerCase().replace(/[.,;:!?¡¿"“”«»()]/g, " ").replace(/\s+/g, " ").trim();

  const VISTAS_ENTIDAD = {
    clientes: "Clientes",
    formulario: "Formulario",
    login: "Login",
    toasts: "Toasts",
    modal: "Modal / paneles"
  };

  // Orden de evaluación: lo más específico primero.
  const ORDEN = [
    "finDictado", "ayuda", "ejercicios", "limpiarBusqueda", "nuevo", "guardar",
    "cancelar", "cerrar", "dictar", "siguiente", "anterior", "menu",
    "buscar", "ir", "borrar"
  ];

  // Mientras se dicta, solo estos comandos se interpretan; el resto es texto.
  const COMANDOS_EN_DICTADO = new Set([
    "finDictado", "siguiente", "anterior", "borrar", "guardar", "cancelar", "cerrar"
  ]);

  const IDIOMAS = {
    "en-US": {
      nombre: "English",
      wake: ["assistant"],
      stop: ["stop"],
      si: ["yes", "check", "on", "true"],
      no: ["no", "uncheck", "off", "false"],
      cmds: {
        nuevo: /^(new|create|add)( (client|customer|record|entry))?$/,
        guardar: /^(save|submit|confirm)( (form|record|changes))?$/,
        cancelar: /^(cancel|discard)$/,
        cerrar: /^close( (panel|window|drawer|this))?$/,
        dictar: /^(dictate|dictation|start dictation|dictation mode)$/,
        finDictado: /^(stop|end|finish) dictation$/,
        siguiente: /^next( field)?$/,
        anterior: /^(previous|back)( field)?$/,
        borrar: /^(clear|delete|erase)( (field|text|it))?$/,
        limpiarBusqueda: /^(clear|reset) (the )?(search|filter)$/,
        menu: /^(toggle|hide|show|collapse|expand) (the )?menu$/,
        buscar: /^(search|find|filter|look)( for)? (.+)$/,
        ir: /^(go to|open|show)( the)? (.+)$/,
        ejercicios: /^(open )?(the )?(exercises|natural interfaces)$/,
        ayuda: /^(help|commands|what can you do)$/
      },
      vistas: {
        clientes: ["clients", "customers", "client list"],
        formulario: ["form", "forms"],
        login: ["login", "sign in"],
        toasts: ["toasts", "toast", "notifications"],
        modal: ["modal", "panels", "modal panels"]
      },
      t: {
        escucho: "I'm listening. Go ahead.",
        standby: 'Standby. Say "assistant" to wake me, "stop" to silence me.',
        noApp: "The interface is not ready yet.",
        nuevo: "New client form opened.",
        cerrado: "Closed.",
        guardando: "Saving…",
        noForm: "There is no open form to save.",
        buscando: (q) => `Searching “${q}”.`,
        busquedaLimpia: "Search cleared.",
        abriendo: (v) => `Opening ${v}.`,
        dictOn: "Dictation on. Speak into the highlighted field.",
        dictOff: "Dictation off.",
        noCampo: "Click a field first, or open a form.",
        noInsertable: "Could not enter that into this field.",
        campoLimpio: "Field cleared.",
        menu: "Menu toggled.",
        ejercicios: "Opening the natural interfaces exercises…",
        ayuda:
          'Say "assistant" first, then:\n' +
          "• new client · save · cancel · close\n" +
          "• search <text> · clear search\n" +
          "• open clients / form / login / toasts / modal\n" +
          "• dictate → speak into the field; then: next field, previous field, clear field, stop dictation\n" +
          "• menu · exercises · help\n" +
          "Anything else goes to the chat bot."
      }
    },

    "es-ES": {
      nombre: "Español",
      wake: ["asistente"],
      stop: ["stop", "basta", "silencio", "detente"],
      si: ["sí", "si", "marcar", "activar", "verdadero"],
      no: ["no", "desmarcar", "desactivar", "falso"],
      cmds: {
        nuevo: /^(nuevo|crear|añadir|agregar)( (cliente|registro))?$/,
        guardar: /^(guardar|enviar|confirmar)( (formulario|registro|cambios))?$/,
        cancelar: /^(cancelar|descartar)$/,
        cerrar: /^cerrar( (panel|ventana|esto))?$/,
        dictar: /^(dictar|dictado|iniciar dictado|empezar a dictar)$/,
        finDictado: /^(terminar|parar|detener|finalizar|fin de|fin del) (el )?dictado$/,
        siguiente: /^(siguiente|siguiente campo|campo siguiente)$/,
        anterior: /^(anterior|campo anterior|atrás|atras)$/,
        borrar: /^(borrar|vaciar|limpiar)( (campo|texto))?$/,
        limpiarBusqueda: /^(borrar|limpiar|quitar) (la )?(búsqueda|busqueda|filtro)$/,
        menu: /^(ocultar|mostrar|alternar|contraer|expandir) (el )?men[úu]$/,
        buscar: /^(buscar|busca|filtrar|encuentra)( (a|por))? (.+)$/,
        ir: /^(ir a|ve a|abrir|abre|mostrar|muestra)( (la|el|los|las))? (.+)$/,
        ejercicios: /^(abrir )?(los )?(ejercicios|interfaces naturales)$/,
        ayuda: /^(ayuda|comandos|qué puedes hacer|que puedes hacer)$/
      },
      vistas: {
        clientes: ["clientes", "lista de clientes", "listado"],
        formulario: ["formulario", "formularios"],
        login: ["login", "acceso", "inicio de sesión"],
        toasts: ["toasts", "notificaciones", "mensajes"],
        modal: ["modal", "paneles", "ventana modal"]
      },
      t: {
        escucho: "Te escucho. Adelante.",
        standby: 'En espera. Di "asistente" para despertarme, "basta" para silenciarme.',
        noApp: "La interfaz aún no está lista.",
        nuevo: "Formulario de nuevo cliente abierto.",
        cerrado: "Cerrado.",
        guardando: "Guardando…",
        noForm: "No hay ningún formulario abierto que guardar.",
        buscando: (q) => `Buscando “${q}”.`,
        busquedaLimpia: "Búsqueda borrada.",
        abriendo: (v) => `Abriendo ${v}.`,
        dictOn: "Dictado activado. Habla en el campo resaltado.",
        dictOff: "Dictado desactivado.",
        noCampo: "Haz clic en un campo primero, o abre un formulario.",
        noInsertable: "No he podido escribir eso en este campo.",
        campoLimpio: "Campo borrado.",
        menu: "Menú alternado.",
        ejercicios: "Abriendo los ejercicios de interfaces naturales…",
        ayuda:
          'Di "asistente" primero y luego:\n' +
          "• nuevo cliente · guardar · cancelar · cerrar\n" +
          "• buscar <texto> · borrar búsqueda\n" +
          "• abrir clientes / formulario / login / toasts / modal\n" +
          "• dictar → habla en el campo; luego: siguiente, anterior, borrar campo, terminar dictado\n" +
          "• menú · ejercicios · ayuda\n" +
          "Todo lo demás va al chatbot."
      }
    },

    "ru-RU": {
      nombre: "Русский",
      wake: ["ассистент"],
      stop: ["стоп", "хватит", "тихо"],
      si: ["да", "отметить", "включить", "истина"],
      no: ["нет", "снять", "выключить", "ложь"],
      cmds: {
        nuevo: /^(новый|создать|добавить)( (клиент|клиента|запись))?$/,
        guardar: /^(сохранить|отправить|подтвердить)( (форму|запись|изменения))?$/,
        cancelar: /^(отмена|отменить)$/,
        cerrar: /^закрыть( (панель|окно))?$/,
        dictar: /^(диктовка|диктовать|начать диктовку|режим диктовки)$/,
        finDictado: /^(закончить|завершить|остановить|стоп) диктовк[ауи]$/,
        siguiente: /^(далее|дальше|следующее|следующее поле)$/,
        anterior: /^(назад|предыдущее|предыдущее поле)$/,
        borrar: /^(очистить|стереть|удалить)( (поле|текст))?$/,
        limpiarBusqueda: /^(очистить|сбросить) (поиск|фильтр)$/,
        menu: /^(скрыть|показать|свернуть|развернуть) меню$/,
        buscar: /^(найти|найди|поиск|искать|фильтр)( (по|для))? (.+)$/,
        ir: /^(открыть|открой|перейти|перейди|показать|покажи)( (на|в))? (.+)$/,
        ejercicios: /^(открыть )?(упражнения|естественные интерфейсы)$/,
        ayuda: /^(помощь|справка|команды|что ты умеешь)$/
      },
      vistas: {
        clientes: ["клиенты", "клиентов", "список клиентов"],
        formulario: ["форма", "форму", "формы"],
        login: ["вход", "логин", "авторизация"],
        toasts: ["уведомления", "тосты"],
        modal: ["модальное окно", "модальные окна", "панели"]
      },
      t: {
        escucho: "Слушаю. Говорите.",
        standby: 'Режим ожидания. Скажите «ассистент», чтобы разбудить, «стоп», чтобы заглушить.',
        noApp: "Интерфейс ещё не готов.",
        nuevo: "Форма нового клиента открыта.",
        cerrado: "Закрыто.",
        guardando: "Сохраняю…",
        noForm: "Нет открытой формы для сохранения.",
        buscando: (q) => `Ищу «${q}».`,
        busquedaLimpia: "Поиск очищен.",
        abriendo: (v) => `Открываю: ${v}.`,
        dictOn: "Диктовка включена. Говорите в выделенное поле.",
        dictOff: "Диктовка выключена.",
        noCampo: "Сначала щёлкните по полю или откройте форму.",
        noInsertable: "Не удалось ввести это в поле.",
        campoLimpio: "Поле очищено.",
        menu: "Меню переключено.",
        ejercicios: "Открываю упражнения по естественным интерфейсам…",
        ayuda:
          "Сначала скажите «ассистент», затем:\n" +
          "• новый клиент · сохранить · отмена · закрыть\n" +
          "• найти <текст> · очистить поиск\n" +
          "• открыть клиенты / форма / вход / уведомления / модальное окно\n" +
          "• диктовка → говорите в поле; затем: далее, назад, очистить поле, закончить диктовку\n" +
          "• скрыть меню · упражнения · помощь\n" +
          "Всё остальное уходит чат-боту."
      }
    }
  };

  class ComandosVoz {
    /** Devuelve {id, arg?} o null. `texto` ya normalizado con norm(). */
    interpretar(texto, idioma) {
      const L = IDIOMAS[idioma];
      if (!L || !texto) return null;

      for (const id of ORDEN) {
        const re = L.cmds[id];
        const m = re && texto.match(re);
        if (!m) continue;

        if (id === "buscar") {
          const q = m[m.length - 1].trim();
          if (q) return { id, arg: q };
          continue;
        }
        if (id === "ir") {
          const vista = this.resolverVista(L, m[m.length - 1].trim());
          if (vista) return { id, arg: vista };
          continue; // "open the door" no es una vista: que lo responda el bot
        }
        return { id };
      }
      return null;
    }

    resolverVista(L, nombre) {
      return Object.keys(L.vistas).find((k) => L.vistas[k].includes(nombre)) || null;
    }

    /** Ejecuta un comando. `ctx` es el AsistenteIU. Devuelve el mensaje a mostrar. */
    ejecutar(cmd, ctx) {
      const L = IDIOMAS[ctx.idioma];
      const T = L.t;
      const app = window.jocarsa.iu.aplicacion;
      const drawerAbierto = () => app?.drawer?.panel.classList.contains("abierto");
      const buscador = document.getElementById("buscador");

      switch (cmd.id) {
        case "nuevo":
          if (!app?.drawer) return T.noApp;
          app.drawer.abrirCrear();
          return T.nuevo;

        case "cerrar":
        case "cancelar":
          app?.drawer?.cerrar();
          app?.modal?.cerrar();
          return T.cerrado;

        case "guardar": {
          const f =
            (drawerAbierto() && document.getElementById("juDrawerForm")) ||
            document.getElementById("demoForm") ||
            document.getElementById("loginDemo");
          if (!f) return T.noForm;
          f.requestSubmit();
          return T.guardando;
        }

        case "buscar":
          if (!app || !buscador) return T.noApp;
          app.estado.seleccion = VISTAS_ENTIDAD.clientes;
          app.renderEntidades();
          buscador.value = cmd.arg;
          buscador.dispatchEvent(new Event("input", { bubbles: true }));
          return T.buscando(cmd.arg);

        case "limpiarBusqueda":
          if (!buscador) return T.noApp;
          buscador.value = "";
          buscador.dispatchEvent(new Event("input", { bubbles: true }));
          return T.busquedaLimpia;

        case "ir": {
          if (!app) return T.noApp;
          const vista = VISTAS_ENTIDAD[cmd.arg];
          app.estado.seleccion = vista;
          app.renderEntidades();
          app.mostrarVista(vista);
          return T.abriendo(L.vistas[cmd.arg][0]);
        }

        case "dictar":
          return ctx.iniciarDictado();

        case "finDictado":
          ctx.detenerDictado();
          return T.dictOff;

        case "siguiente":
          return this.mover(ctx, 1);

        case "anterior":
          return this.mover(ctx, -1);

        case "borrar": {
          const campo = this.campoActual(ctx);
          if (!campo) return T.noCampo;
          if (campo.type === "checkbox" || campo.type === "radio") campo.checked = false;
          else if (campo.tagName !== "SELECT") campo.value = "";
          this.emitir(campo);
          return T.campoLimpio;
        }

        case "menu":
          document.querySelector(".minimizar")?.click();
          return T.menu;

        case "ejercicios":
          setTimeout(() => { location.href = "natural-ui/index.html"; }, 700);
          return T.ejercicios;

        case "ayuda":
          return T.ayuda;

        default:
          return "";
      }
    }

    // ------------------------------------------------------------ campos
    campoVisible(c, ctx) {
      return Boolean(
        c &&
          c.isConnected &&
          !c.closest("#asistente") &&
          !c.closest(".ju-drawer:not(.abierto)") &&
          c.getClientRects().length > 0 &&
          !c.disabled
      );
    }

    camposDe(scope) {
      return [
        ...scope.querySelectorAll(
          "input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea"
        )
      ].filter((c) => c.getClientRects().length > 0 && !c.disabled);
    }

    /** Campo sobre el que dictar / navegar: el último enfocado o el primero del formulario visible. */
    campoActual(ctx) {
      if (this.campoVisible(ctx.ultimoCampo, ctx)) return ctx.ultimoCampo;

      const drawerAbierto = document.getElementById("juDrawer")?.classList.contains("abierto");
      const scope = drawerAbierto
        ? document.getElementById("juDrawerForm")
        : document.querySelector("#escenario form");
      return scope ? this.camposDe(scope)[0] || null : null;
    }

    mover(ctx, dir) {
      const T = IDIOMAS[ctx.idioma].t;
      const campo = this.campoActual(ctx);
      if (!campo) return T.noCampo;

      const lista = this.camposDe(campo.form || document.body);
      if (!lista.length) return T.noCampo;

      const i = lista.indexOf(campo);
      const siguiente = lista[(i + dir + lista.length) % lista.length];
      siguiente.focus();
      ctx.ultimoCampo = siguiente;
      ctx.marcarCampo(siguiente);
      return "";
    }

    emitir(campo) {
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // ----------------------------------------------------------- dictado
    /** Escribe el texto dictado en `campo` según su tipo. true si se pudo. */
    insertar(campo, crudo, idioma) {
      const L = IDIOMAS[idioma];
      const dicho = norm(crudo);
      const tipo = campo.type;

      if (campo.tagName === "SELECT") {
        const opcion = [...campo.options].find((o) => {
          const t = norm(o.text);
          return t && (t.includes(dicho) || dicho.includes(t));
        });
        if (!opcion) return false;
        campo.value = opcion.value;
        this.emitir(campo);
        return true;
      }

      if (tipo === "checkbox" || tipo === "radio") {
        if (L.si.includes(dicho)) campo.checked = true;
        else if (L.no.includes(dicho)) campo.checked = false;
        else return false;
        this.emitir(campo);
        return true;
      }

      let valor;
      if (tipo === "email" || tipo === "url") {
        valor = crudo
          .toLowerCase()
          .replace(/\s+(at|arroba|собака)\s+/g, "@")
          .replace(/\s+(dot|punto|точка)\s+/g, ".")
          .replace(/\s+/g, "");
        if (tipo === "url" && valor && !/^https?:\/\//.test(valor)) valor = "https://" + valor;
      } else if (tipo === "number") {
        valor = crudo.replace(/(\d)\s+(?=\d)/g, "$1").replace(",", ".").replace(/[^\d.+-]/g, "");
      } else if (tipo === "tel") {
        valor = crudo.replace(/(\d)\s+(?=\d)/g, "$1").replace(/[^\d+]/g, "");
      } else if (tipo === "date") {
        let d = null;
        const m = crudo.match(/(\d{1,2})[\s./-]+(\d{1,2})[\s./-]+(\d{4})/);
        if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])); // día/mes/año
        else {
          const p = Date.parse(crudo);
          if (!Number.isNaN(p)) d = new Date(p);
        }
        if (!d || Number.isNaN(d.getTime())) return false;
        const dos = (n) => String(n).padStart(2, "0");
        valor = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
      } else {
        // texto, búsqueda, textarea: se añade al final
        const texto = campo.value ? crudo : crudo.charAt(0).toUpperCase() + crudo.slice(1);
        valor = campo.value ? `${campo.value} ${texto}` : texto;
      }

      if (!valor) return false;
      campo.value = valor;
      this.emitir(campo);
      return true;
    }
  }

  window.jocarsa.iu.voz = { IDIOMAS, ComandosVoz, norm, COMANDOS_EN_DICTADO };
})();
