/**
 * Ejercicio 5 · Realidad virtual con three.js + WebXR
 * - Funciona sin visor: arrastra con el ratón/dedo para mirar alrededor.
 * - Con visor (o emulador WebXR): botón «ENTER VR», selección con la mirada
 *   (dwell) y con los mandos (gatillo).
 * - Un panel 3D muestra la lista de clientes de ../data/clientes.json.
 */
import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";

// ====== PARÁMETROS PARA LOS EJERCICIOS ======
const DWELL_MS = 1200;          // tiempo mirando un objeto para seleccionarlo
const NUM_CUBOS = 6;            // cubos interactivos alrededor
const RADIO = 3.2;              // radio del círculo de cubos (m)
const COLOR_BASE = 0x2b7f65, COLOR_ACTIVO = 0xf5b83d;
// ============================================

const cont = document.getElementById("vr-escena");
const info = document.getElementById("estadoVR");
const poner = (t, tipo = "") => { info.textContent = t; info.className = `nui-estado ${tipo}`.trim(); };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(cont.clientWidth, cont.clientHeight);
renderer.xr.enabled = true;
cont.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07120f);
scene.fog = new THREE.Fog(0x07120f, 6, 16);
const camera = new THREE.PerspectiveCamera(70, cont.clientWidth / cont.clientHeight, 0.05, 50);
camera.position.set(0, 1.6, 0);
camera.rotation.order = "YXZ";

scene.add(new THREE.HemisphereLight(0xcdeee1, 0x10201a, 1.2));
const luz = new THREE.DirectionalLight(0xffffff, 1.2);
luz.position.set(2, 5, 3);
scene.add(luz);

const suelo = new THREE.Mesh(new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0d261f }));
scene.add(suelo);
scene.add(new THREE.GridHelper(18, 36, 0x2b7f65, 0x173f35));

// ---------- cubos interactivos ----------
const objetivos = [];   // todo lo que se puede mirar o apuntar
for (let i = 0; i < NUM_CUBOS; i++) {
  const ang = (i / NUM_CUBOS) * Math.PI * 2 + Math.PI / NUM_CUBOS;   // deja libre el frente (panel)
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: COLOR_BASE }));
  m.position.set(Math.sin(ang) * RADIO, 1.4, -Math.cos(ang) * RADIO);
  m.userData = { tipo: "cubo", activo: false, base: m.position.y };
  scene.add(m);
  objetivos.push(m);
}

// ---------- panel 3D con la lista de clientes ----------
const CV_W = 1024, CV_H = 640, FILA_Y = 120, FILA_H = 66, MAX_FILAS = 7;
const cv = document.createElement("canvas");
cv.width = CV_W; cv.height = CV_H;
const g = cv.getContext("2d");
const textura = new THREE.CanvasTexture(cv);
textura.colorSpace = THREE.SRGBColorSpace;
const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ map: textura }));
panel.position.set(0, 1.6, -2.4);
panel.userData = { tipo: "panel" };
scene.add(panel);
objetivos.push(panel);

let clientes = [
  { id: 1, nombre: "Laura", apellidos: "Martínez García", email: "laura.martinez@example.com", empresa: "Soluciones Levante S.L." },
  { id: 2, nombre: "Carlos", apellidos: "Navarro Pérez", email: "carlos.navarro@example.com", empresa: "Innovación Digital S.A." }
];
let filaHover = -1, filaSel = -1;

fetch("../data/clientes.json").then((r) => r.json()).then((d) => { clientes = d.registros || clientes; pintarPanel(); }).catch(() => { /* usa los de ejemplo */ });

function pintarPanel() {
  g.fillStyle = "#0d261f"; g.fillRect(0, 0, CV_W, CV_H);
  g.fillStyle = "#173f35"; g.fillRect(0, 0, CV_W, 90);
  g.fillStyle = "#ecfff7"; g.font = "bold 44px Ubuntu, Arial"; g.textBaseline = "middle";
  g.fillText("Clientes", 36, 46);
  g.font = "24px Ubuntu, Arial"; g.fillStyle = "#9fe8c7";
  g.fillText("mira una fila durante un instante para seleccionarla", 280, 48);

  clientes.slice(0, MAX_FILAS).forEach((c, i) => {
    const y = FILA_Y + i * FILA_H;
    g.fillStyle = i === filaSel ? "#f5b83d" : i === filaHover ? "#2b7f65" : i % 2 ? "#12312a" : "#0f2a24";
    g.fillRect(24, y, CV_W - 48, FILA_H - 6);
    g.fillStyle = i === filaSel ? "#07120f" : "#ecfff7";
    g.font = "bold 30px Ubuntu, Arial";
    g.fillText(`${c.id}  ${c.nombre} ${c.apellidos}`, 44, y + FILA_H / 2 - 3);
    g.font = "24px Ubuntu, Arial";
    g.textAlign = "right"; g.fillText(c.empresa || "", CV_W - 44, y + FILA_H / 2 - 3); g.textAlign = "left";
  });

  g.fillStyle = "#ecfff7"; g.font = "26px Ubuntu, Arial";
  const sel = clientes[filaSel];
  g.fillText(sel ? `✉ ${sel.email}` : "Ningún cliente seleccionado", 36, CV_H - 36);
  textura.needsUpdate = true;
}
pintarPanel();

// ---------- retícula (puntero de la mirada) ----------
const reticulaAro = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.026, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
const reticulaRelleno = new THREE.Mesh(new THREE.CircleGeometry(0.018, 32), new THREE.MeshBasicMaterial({ color: 0x3ddc97, depthTest: false, transparent: true }));
reticulaAro.renderOrder = reticulaRelleno.renderOrder = 999;
reticulaRelleno.scale.setScalar(0.001);
const reticula = new THREE.Group();
reticula.add(reticulaAro, reticulaRelleno);
scene.add(reticula);

// ---------- selección ----------
const rayo = new THREE.Raycaster();
const origen = new THREE.Vector3(), dir = new THREE.Vector3(), mat = new THREE.Matrix4();
let mirando = null, desde = 0;

function activar(obj, hit) {
  if (obj.userData.tipo === "cubo") {
    obj.userData.activo = !obj.userData.activo;
    obj.material.color.setHex(obj.userData.activo ? COLOR_ACTIVO : COLOR_BASE);
    obj.userData.salto = performance.now();
  } else if (obj.userData.tipo === "panel" && hit?.uv) {
    const fila = filaDesdeUV(hit.uv);
    if (fila >= 0) { filaSel = fila; pintarPanel(); }
  }
}
function filaDesdeUV(uv) {
  const y = (1 - uv.y) * CV_H;
  const fila = Math.floor((y - FILA_Y) / FILA_H);
  return fila >= 0 && fila < Math.min(clientes.length, MAX_FILAS) ? fila : -1;
}

// mandos
const mandos = [0, 1].map((i) => {
  const c = renderer.xr.getController(i);
  c.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -3)]), new THREE.LineBasicMaterial({ color: 0x3ddc97 })));
  c.addEventListener("selectstart", () => {
    mat.identity().extractRotation(c.matrixWorld);
    rayo.ray.origin.setFromMatrixPosition(c.matrixWorld);
    rayo.ray.direction.set(0, 0, -1).applyMatrix4(mat);
    const h = rayo.intersectObjects(objetivos, false)[0];
    if (h) activar(h.object, h);
  });
  scene.add(c);
  return c;
});

// ---------- mirar con ratón / dedo cuando no hay visor ----------
let arrastrando = false, px = 0, py = 0;
renderer.domElement.addEventListener("pointerdown", (e) => { arrastrando = true; px = e.clientX; py = e.clientY; });
window.addEventListener("pointerup", () => { arrastrando = false; });
window.addEventListener("pointermove", (e) => {
  if (!arrastrando || renderer.xr.isPresenting) return;
  camera.rotation.y -= (e.clientX - px) * 0.005;
  camera.rotation.x = Math.max(-1.2, Math.min(1.2, camera.rotation.x - (e.clientY - py) * 0.005));
  px = e.clientX; py = e.clientY;
});

// ---------- bucle ----------
renderer.setAnimationLoop((t) => {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  cam.getWorldPosition(origen);
  cam.getWorldDirection(dir);
  rayo.set(origen, dir);
  const hit = rayo.intersectObjects(objetivos, false)[0];

  // retícula sobre el punto mirado (o a 2 m si no hay nada)
  const dist = hit ? hit.distance - 0.02 : 2;
  reticula.position.copy(origen).addScaledVector(dir, dist);
  reticula.quaternion.copy(cam.quaternion);
  reticula.scale.setScalar(dist / 2);

  const nuevaFila = hit?.object === panel && hit.uv ? filaDesdeUV(hit.uv) : -1;
  if (nuevaFila !== filaHover) { filaHover = nuevaFila; pintarPanel(); }

  const clave = hit ? (hit.object === panel ? `panel:${nuevaFila}` : hit.object.id) : null;
  if (clave !== mirando) { mirando = clave; desde = t; }
  const prog = hit && (hit.object !== panel || nuevaFila >= 0) ? Math.min(1, (t - desde) / DWELL_MS) : 0;
  reticulaRelleno.scale.setScalar(Math.max(0.001, prog));
  if (prog >= 1) { activar(hit.object, hit); desde = t + 1e9; }   // evita repetir hasta mirar a otro sitio

  // animación de los cubos
  for (const o of objetivos) {
    if (o.userData.tipo !== "cubo") continue;
    o.rotation.y += 0.01;
    const s = o.userData.salto ? Math.max(0, 1 - (t - o.userData.salto) / 400) : 0;
    o.position.y = o.userData.base + Math.sin(s * Math.PI) * 0.3;
  }
  renderer.render(scene, camera);
});

cont.appendChild(VRButton.createButton(renderer));
window.addEventListener("resize", () => {
  camera.aspect = cont.clientWidth / cont.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(cont.clientWidth, cont.clientHeight);
});
poner("Escena lista. Arrastra para mirar alrededor y mantén el punto central sobre un cubo o una fila del panel.", "ok");
