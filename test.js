import * as THREE from "three";
import Stats from "stats.js";

import WebGL from "three/examples/jsm/capabilities/WebGL.js";

class Cube
{
  constructor(_scene)
  {
    this.m_scene = _scene

    this.createCube()
  }

  createCube()
  {
    this.m_geometry = new THREE.BoxGeometry(5, 5, 5, 1, 1, 1);
    this.m_material = new THREE.MeshBasicMaterial({color: 0xFFFFFF, wireframe: true});
    this.m_mesh = new THREE.Mesh(this.m_geometry, this.m_material);

    this.m_mesh.position.set(0, 0, 0);
    this.m_scene.add(this.m_mesh);
  }

  update(delta)
  {
    this.m_geometry.rotateX(1.00 * delta);
    this.m_geometry.rotateY(1.00 * delta);
    this.m_geometry.rotateZ(1.00 * delta);
  }
}

let camera, scene, renderer;

let cube;

let tanFOV, windowHeight;

const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

const clock = new THREE.Clock();

if (WebGL.isWebGLAvailable())
{
  init();
  tick();
}
else
{
  const webGLErrorElement = document.createElement("div");
  webGLErrorElement.setAttribute("id", "WebGLErrorContainer");
  
	const webGLError = WebGL.getWebGLErrorMessage();
	document.getElementById("WebGLErrorContainer").appendChild(webGLError);
}

function init()
{
  // CAMERA
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(0, 0, 25);

  // SCENE
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);

  // LIGHTS
  // ...

  // MATERIALS
  // ...

  // HERO ELEMENT
  cube = new Cube(scene);
  
  // RENDERER
  renderer = new THREE.WebGLRenderer();
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // CONTROLS
  // ...

  // EVENTS
  tanFOV = Math.tan(((Math.PI / 180) * camera.fov / 2));
  windowHeight = window.innerHeight;

  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize(event)
{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = (360 / Math.PI) * Math.atan(tanFOV * (window.innerHeight / windowHeight));
    
  camera.updateProjectionMatrix();
  camera.lookAt(scene.position);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}

function tick()
{
  renderer.setAnimationLoop(() =>
  {
    stats.begin();

    // Get time between frames (ms)
    const delta = clock.getDelta();

    // Do stuff
    cube.update(delta);

    // Render
    renderer.render(scene, camera);

    stats.end();
  })
}
