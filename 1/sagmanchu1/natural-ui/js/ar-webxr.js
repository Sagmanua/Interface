/**
 * Ejercicio 4b · WebXR AR: coloca cubos sobre superficies reales (hit-test).
 * Requiere un móvil Android con Chrome (ARCore) y HTTPS (o http://localhost vía USB).
 */
import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";

// ====== PARÁMETROS PARA LOS EJERCICIOS ======
const TAMANO = 0.1;                // lado del cubo en metros
const COLORES = [0xe0524a, 0x2b7fd6, 0xf5b83d, 0x3ddc97, 0xb06ad8];
// ============================================

const cont = document.getElementById("ar-escena");
const msg = document.getElementById("estadoXR");
const poner = (t, tipo = "") => { msg.textContent = t; msg.className = `nui-estado ${tipo}`.trim(); };

async function iniciar() {
  if (!navigator.xr || !(await navigator.xr.isSessionSupported("immersive-ar").catch(() => false))) {
    poner("WebXR AR no está disponible en este dispositivo/navegador. Prueba en Chrome para Android, o en el escritorio con la extensión «Immersive Web Emulator».", "error");
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(cont.clientWidth, cont.clientHeight);
  renderer.xr.enabled = true;
  cont.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, cont.clientWidth / cont.clientHeight, 0.01, 20);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.4));

  const retic = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x3ddc97 })
  );
  retic.matrixAutoUpdate = false;
  retic.visible = false;
  scene.add(retic);

  const controlador = renderer.xr.getController(0);
  controlador.addEventListener("select", () => {
    if (!retic.visible) return;
    const cubo = new THREE.Mesh(
      new THREE.BoxGeometry(TAMANO, TAMANO, TAMANO),
      new THREE.MeshStandardMaterial({ color: COLORES[Math.floor(Math.random() * COLORES.length)] })
    );
    cubo.position.setFromMatrixPosition(retic.matrix);
    cubo.position.y += TAMANO / 2;
    scene.add(cubo);
  });
  scene.add(controlador);

  cont.appendChild(ARButton.createButton(renderer, { requiredFeatures: ["hit-test"] }));

  let fuente = null, pedida = false;
  renderer.setAnimationLoop((_, frame) => {
    if (frame) {
      const espacio = renderer.xr.getReferenceSpace();
      const sesion = renderer.xr.getSession();
      if (!pedida) {
        sesion.requestReferenceSpace("viewer").then((v) =>
          sesion.requestHitTestSource({ space: v }).then((s) => { fuente = s; }));
        sesion.addEventListener("end", () => { pedida = false; fuente = null; });
        pedida = true;
      }
      if (fuente) {
        const hits = frame.getHitTestResults(fuente);
        if (hits.length) {
          retic.visible = true;
          retic.matrix.fromArray(hits[0].getPose(espacio).transform.matrix);
        } else {
          retic.visible = false;
        }
      }
    }
    renderer.render(scene, camera);
  });

  window.addEventListener("resize", () => {
    camera.aspect = cont.clientWidth / cont.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(cont.clientWidth, cont.clientHeight);
  });
  poner("WebXR AR disponible. Pulsa «START AR», apunta al suelo o a una mesa y toca la pantalla para colocar cubos.", "ok");
}

iniciar().catch((e) => poner(`Error: ${e.message}`, "error"));
