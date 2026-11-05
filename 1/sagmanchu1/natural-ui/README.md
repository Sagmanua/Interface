# Interfaces naturales · ejercicios

La **voz y el dictado** están dentro de la aplicación principal (`index.html`, botón 🎙 Assistant).
Esta carpeta reúne el resto de interfaces naturales, una página por ejercicio:

| Archivo | Tema | Tecnología |
|---|---|---|
| `01-gestos.html` | Mano de 21 puntos, dedos, pinza, cursor | MediaPipe HandLandmarker |
| `02-comandos-gestuales.html` | Gestos → acciones (mantener, swipe, volumen continuo) | MediaPipe GestureRecognizer |
| `03-rostro.html` | Detección, expresiones, identificación, login facial de demo | face-api.js |
| `04-ar.html` | AR de cámara (accesorios en la cara) + WebXR AR (hit-test) | canvas · three.js · WebXR |
| `05-vr.html` | Sala VR, mirada-selección, panel con clientes | three.js · WebXR |

Cada `js/*.js` empieza con un bloque `PARÁMETROS PARA LOS EJERCICIOS` y cada página termina con una
lista de retos. `js/comun.js` contiene las utilidades compartidas (cámara, MediaPipe, dibujo de manos).

## Cómo abrirlo

```
python server.py
http://localhost:8000/natural-ui/
```

* Las cámaras solo funcionan en `http://localhost` o `https`.
* Usa Chrome o Edge. La primera vez se descargan modelos de internet (jsdelivr y storage.googleapis.com).
* Privacidad: el vídeo se procesa en el navegador. Las muestras faciales del ejercicio 3 se guardan solo
  en `localStorage` (botón «Borrar datos»). Registra únicamente tu propia cara.
* El login facial es una **demostración**: una foto delante de la cámara lo engaña (no hay prueba de vida).

## Probar AR / VR sin gafas

* Extensión «Immersive Web Emulator» para Chrome/Edge: simula visor y mandos.
* Android + Chrome (ARCore) para el ejercicio 4b. Con el móvil por USB:
  `adb reverse tcp:8000 tcp:8000` y abre `http://localhost:8000/natural-ui/04-ar.html` en el móvil.
