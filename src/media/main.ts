import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { degToRad, radToDeg } from "three/src/math/MathUtils";
import { Settings } from "../preview";
import { base64ToArrayBuffer } from "./utils";

interface State {
  cameraPosition?: {
    x: number;
    y: number;
    z: number;
  };
}

const WEBVIEW_API = acquireVsCodeApi<State>();
const WEBVIEW_STATE = WEBVIEW_API.getState();
let settings: Settings;

// -----------------------------------------
// functions

function getSettings(): Settings {
  if (settings != null) {
    return settings;
  }

  const element = document.getElementById("settings");
  if (element) {
    const data = element.getAttribute("data-settings");
    if (data) {
      // cache so we dont need to go over and over the DOM
      settings = JSON.parse(data);
      return settings;
    }
  }

  throw new Error("Could not load settings");
}

function setRenderer() {
  const renderer = new THREE.WebGLRenderer();
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setSize(window.innerWidth, window.innerHeight);

  return renderer;
}

function setScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  return scene;
}

function setCamera(cameraPosition?: State['cameraPosition'], isOrtho?: boolean) {
  if (isOrtho) {
    // TODO: enable ortho camera
    // return new THREE.OrthographicCamera()
  }

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  camera.up = new THREE.Vector3(0, 0, 1);

  if (cameraPosition != null) {
    camera.position.x = cameraPosition.x;
    camera.position.y = cameraPosition.y;
    camera.position.z = cameraPosition.z;
  }

  return camera;
}

function setCameraPosition(
  camera: ReturnType<typeof setCamera>,
  controls: ReturnType<typeof setControls>,
  position: 'isometric'|'top'|'left'|'right'|'bottom',
  mesh: ReturnType<typeof setMesh>,
) {
  const settings = getSettings();
  const viewOffset = settings == null ? 40 : settings.viewOffset;

  const boundingBox = new THREE.Box3();
  boundingBox.setFromObject(mesh);
  const dimensions = boundingBox.getSize(new THREE.Vector3(0, 0, 0));

  controls.reset();

  switch (position) {
  case 'top':
    // DEV: for some reason, 0 messes up the view, to investigate further
    camera.position.set(0, -0.001, boundingBox.max.z + viewOffset);
    break;
  case 'left':
    camera.position.set(-(boundingBox.max.x + viewOffset), 0, dimensions.z / 2);
    break;
  case 'right':
    camera.position.set(boundingBox.max.x + viewOffset, 0, dimensions.z / 2);
    break;
  case 'bottom':
    // DEV: for some reason, 0 messes up the view, to investigate further
    camera.position.set(0, -0.001, -(boundingBox.max.z + viewOffset));
    break;
  case 'isometric':
  default:
    // find the biggest dimension so we can offset it
    let dimension = dimensions.z > dimensions.x ? dimensions.z : dimensions.x;
    dimension = boundingBox.max.z

    camera.position.set(
      dimension + viewOffset / 2, dimension + viewOffset / 2, dimension + viewOffset / 2
    );
    break;
  }

  // make sure we are looking at the mesh
  const meshCenter = boundingBox.getCenter(new THREE.Vector3(0, 0, 0));
  camera.lookAt(meshCenter);
  controls.target = meshCenter;

  controls.update();
}

function setControls(
  renderer: ReturnType<typeof setRenderer>,
  camera: ReturnType<typeof setCamera>,
  mesh: ReturnType<typeof setMesh>
) {
  const controls = new TrackballControls(camera, renderer.domElement);
  controls.panSpeed = 2;
  controls.rotateSpeed = 5;

  const boundingBox = new THREE.Box3();
  boundingBox.setFromObject(mesh);

  const meshCenter = boundingBox.getCenter(new THREE.Vector3(0, 0, 0));
  camera.lookAt(meshCenter);
  controls.target = meshCenter;

  controls.update();

  return controls;
}

function setLights(scene: THREE.Scene) {
  const lights = [new THREE.HemisphereLight(0xffffbb, 0x080820, 1.5)];
  for (let i = 0; i < lights.length; i += 1) {
    scene.add(lights[i]);
  }

  return lights;
}

function setMaterial(materialConfig: Settings['meshMaterial']) {
  switch (materialConfig.type) {
    case 'basic':
      return new THREE.MeshBasicMaterial(materialConfig.config);
    case 'standard':
      return new THREE.MeshStandardMaterial(materialConfig.config);
    case 'normal':
      return new THREE.MeshNormalMaterial(materialConfig.config);
    case 'phong':
      return new THREE.MeshPhongMaterial(materialConfig.config);
    case 'lambert':
    default:
      return new THREE.MeshLambertMaterial(materialConfig.config);
  }
}

function setGrid(
  scene: ReturnType<typeof setScene>,
  boundingBox: THREE.Box2|THREE.Box3,
  gridConfig: Settings['grid']
) {
  const size =
    Math.ceil(
      Math.max(
        Math.abs(boundingBox.max.x),
        Math.abs(boundingBox.min.x),
        Math.abs(boundingBox.max.y),
        Math.abs(boundingBox.min.y)
      ) / 5
    ) * 10;

  const color = gridConfig.color == null ? '#111' : gridConfig.color;
  const gridHelper = new THREE.GridHelper(size, size / 5, color, color);
  scene.add(gridHelper.rotateX(degToRad(90)));

  return gridHelper;
}

function setMesh(scene: ReturnType<typeof setScene>, settings: Settings) {
  const loader = new STLLoader();
  const geometry = loader.parse(base64ToArrayBuffer(getSettings().data));
  const material = setMaterial(settings.meshMaterial);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  return mesh;
}

function setExtras(
  camera: ReturnType<typeof setCamera>,
  scene: ReturnType<typeof setScene>,
  mesh: ReturnType<typeof setMesh>,
  showInfo: boolean,
  showAxes: boolean,
  showBoundingBox: boolean,
) {
  const boundingBox = new THREE.Box3();
  boundingBox.setFromObject(mesh);
  const dimensions = boundingBox.getSize(new THREE.Vector3(0, 0, 0));

  if (showAxes) {
    const size =
      Math.ceil(
        Math.max(
          Math.abs(boundingBox.max.x),
          Math.abs(boundingBox.min.x),
          Math.abs(boundingBox.max.y),
          Math.abs(boundingBox.min.y)
        ) / 5
      ) * 10;

    const axesHelper = new THREE.AxesHelper(size);
    scene.add(axesHelper);
  }

  if (showBoundingBox) {
    const meshBoxHelper = new THREE.Box3Helper(boundingBox, 0xffff00 as any);
    scene.add(meshBoxHelper);
  }

  if (showInfo) {
    const infoText = document.createElement('div');
    infoText.style.position = 'absolute';
    infoText.style.backgroundColor = "#000000";
    infoText.style.color = "#ffffff";
    infoText.style.padding = '20px';
    infoText.style.top = '0';
    infoText.style.left = '0';
    document.body.appendChild(infoText);

    const roundDecimals = (num: number): number => Math.round(num * 100) / 100;

    const updateDebug = () => {
      const debugData = {
        camera_x: roundDecimals(camera.position.x),
        camera_y: roundDecimals(camera.position.y),
        camera_z: roundDecimals(camera.position.z),
        camera_rotation_x: roundDecimals(radToDeg(camera.rotation.x)),
        camera_rotation_y: roundDecimals(radToDeg(camera.rotation.y)),
        camera_rotation_z: roundDecimals(radToDeg(camera.rotation.z)),
        bounding_box_width: roundDecimals(dimensions.x),
        bounding_box_length: roundDecimals(dimensions.y),
        bounding_box_height: roundDecimals(dimensions.z),
        bounding_box_min_x: roundDecimals(boundingBox.min.x),
        bounding_box_max_x: roundDecimals(boundingBox.max.x),
        bounding_box_min_y: roundDecimals(boundingBox.min.y),
        bounding_box_max_y: roundDecimals(boundingBox.max.y),
        bounding_box_min_z: roundDecimals(boundingBox.min.y),
        bounding_box_max_z: roundDecimals(boundingBox.max.z),
      };

      const debugValues = Object.keys(debugData).map((key) => {
        return `${key}: <b>${(debugData as any)[key]}</b>`;
      });
      infoText.innerHTML = debugValues.join('<br>');

      window.requestAnimationFrame(updateDebug);
    };

    updateDebug();
  }
}

function setStateManager() {
  return {
    getState: (): State => {
      return WEBVIEW_STATE == null ? {} : WEBVIEW_STATE;
    },
    setState: (s: State) => {
      WEBVIEW_API.setState(s);
    },
  };
}

function onWindowResize(
  camera: ReturnType<typeof setCamera>,
  renderer: ReturnType<typeof setRenderer>,
  isOrtho?: boolean
) {
  if (!isOrtho) {
    (camera as THREE.PerspectiveCamera).aspect = window.innerWidth / window.innerHeight;
  }

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onAction(
  evt: Event,
  camera: ReturnType<typeof setCamera>,
  controls: ReturnType<typeof setControls>,
  mesh: ReturnType<typeof setMesh>,
) {
  if ((evt.target as any).closest('.button--isometric') !== null) {
    setCameraPosition(camera, controls, 'isometric', mesh);
  }

  if ((evt.target as any).closest('.button--top') !== null) {
    setCameraPosition(camera, controls, 'top', mesh);
  }

  if ((evt.target as any).closest('.button--left') !== null) {
    setCameraPosition(camera, controls, 'left', mesh);
  }

  if ((evt.target as any).closest('.button--right') !== null) {
    setCameraPosition(camera, controls, 'right', mesh);
  }

  if ((evt.target as any).closest('.button--bottom') !== null) {
    setCameraPosition(camera, controls, 'bottom', mesh);
  }
}

function update(
  camera: ReturnType<typeof setCamera>,
  renderer: ReturnType<typeof setRenderer>,
  scene: ReturnType<typeof setScene>,
  controls: ReturnType<typeof setControls>,
  stateManager: ReturnType<typeof setStateManager>,
) {
  requestAnimationFrame(() => update(camera, renderer, scene, controls, stateManager));

  controls.update();
  renderer.render(scene, camera);

  stateManager.setState({
    ...stateManager.getState(),
    cameraPosition: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
  });
}

function init() {
  const settings = getSettings();
  const stateManager = setStateManager();
  const state = stateManager.getState();

  const renderer = setRenderer();
  document.body.appendChild(renderer.domElement);

  const scene = setScene();
  const camera = setCamera(state.cameraPosition);
  setLights(scene);
  const mesh = setMesh(scene, settings);

  const controls = setControls(renderer, camera, mesh);

  if (state.cameraPosition == null) {
    setCameraPosition(camera, controls, 'isometric', mesh);
  }

  if (settings.grid.enable) {
    const boundingBox = new THREE.Box3();
    boundingBox.setFromObject(mesh);
    setGrid(scene, boundingBox, settings.grid);
  }
  setExtras(
    camera,
    scene,
    mesh,
    settings.showInfo,
    settings.showAxes,
    settings.showBoundingBox
  );

  // set events
  window.addEventListener("resize", () => onWindowResize(camera, renderer, false), false);

  const actionsEl = document.querySelector('.actions');
  if (actionsEl != null) {
    if (!settings.showViewButtons) {
      actionsEl.classList.add('hide');
    } else {
      actionsEl.classList.remove('hide');
    }

    actionsEl.addEventListener('click', evt => onAction(evt, camera, controls, mesh));
  }

  // time to run the loop...
  update(camera, renderer, scene, controls, stateManager);
}

// -----------------------------------------
// runtime

init();
