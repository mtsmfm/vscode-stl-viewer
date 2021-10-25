import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { degToRad } from "three/src/math/MathUtils";
import { Settings } from "../preview";

const scene = new THREE.Scene();

scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 1.5));

const renderer = new THREE.WebGLRenderer();
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

interface State {
  cameraPosition: {
    x: number;
    y: number;
    z: number;
  };
}

const vscode = acquireVsCodeApi<State>();
const initialState = vscode.getState();

function getSettings(): Settings {
  const element = document.getElementById("settings");
  if (element) {
    const data = element.getAttribute("data-settings");
    if (data) {
      return JSON.parse(data);
    }
  }

  throw new Error("Could not load settings");
}

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const loader = new STLLoader();
loader.load(
  getSettings().src,
  (geometry) => {
    const material = new THREE.MeshLambertMaterial({
      color: 0x49ef4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const bb = new THREE.Box3();
    bb.setFromObject(mesh);

    if (initialState) {
      camera.position.x = initialState.cameraPosition.x;
      camera.position.y = initialState.cameraPosition.y;
      camera.position.z = initialState.cameraPosition.z;
    } else {
      camera.position.y = -20;
      camera.position.z = bb.max.z + 20;
    }

    const size =
      Math.ceil(
        Math.max(
          Math.abs(bb.max.x),
          Math.abs(bb.min.x),
          Math.abs(bb.max.y),
          Math.abs(bb.min.y)
        ) / 5
      ) * 10;

    const gridHelper = new THREE.GridHelper(size, size / 5);
    scene.add(gridHelper.rotateX(degToRad(90)));
    scene.add(new THREE.AxesHelper(size));
  },
  (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  (error) => {
    console.log(error);
  }
);

window.addEventListener("resize", onWindowResize, false);
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function animate() {
  requestAnimationFrame(animate);

  controls.update();

  render();

  vscode.setState({
    cameraPosition: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
  });
}

function render() {
  renderer.render(scene, camera);
}

animate();
