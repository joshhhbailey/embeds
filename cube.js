import * as THREE from "three";
import * as lil from "lil-gui";
import Stats from "stats.js";

// Setup
import WebGL from "three/examples/jsm/capabilities/WebGL.js";

// Controls
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Post Processing
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

class Cell
{
  constructor(_scene, _spawnPos, _size)
  {
    // Setup
    this.m_scene = _scene;
    this.m_spawnPos = _spawnPos;
    this.m_size = _size;

    // Animation
    this.m_animating = false;
    this.m_angle = 0;
    this.m_explodeDist = _size;
    this.m_explodeDir = new THREE.Vector3();

    // Shader
    this.m_uniforms =
    {
      uTime: {type: "float", value: 0.0},
      uCentre: {type: "bool", value: false}
    }

    this.createCell();
  }

  createCell()
  {
    this.m_geometry = new THREE.BoxGeometry(this.m_size, this.m_size, this.m_size);
    this.m_material = new THREE.ShaderMaterial({
      uniforms: this.m_uniforms,
      fragmentShader: this.fragmentShader(),
      vertexShader: this.vertexShader(),
      wireframe: false
    });
    this.m_mesh = new THREE.Mesh(this.m_geometry, this.m_material);

    this.m_mesh.applyMatrix4(this.m_spawnPos);

    this.m_explodeDir.copy(this.m_mesh.position);
    this.m_scene.add(this.m_mesh);
  }

  resetPosition()
  {
    this.m_mesh.position.x = Math.round(this.m_mesh.position.x);
    this.m_mesh.position.y = Math.round(this.m_mesh.position.y);
    this.m_mesh.position.z = Math.round(this.m_mesh.position.z);

    this.m_animating = false;
  }

  resetRotation()
  {
    this.m_mesh.rotation.x = (Math.PI / 2) * Math.round(this.m_mesh.rotation.x / (Math.PI / 2));
    this.m_mesh.rotation.y = (Math.PI / 2) * Math.round(this.m_mesh.rotation.y / (Math.PI / 2));
    this.m_mesh.rotation.z = (Math.PI / 2) * Math.round(this.m_mesh.rotation.z / (Math.PI / 2));

    this.m_explodeDir.copy(this.m_mesh.position);
    this.m_explodeDir.clamp(
      new THREE.Vector3(-this.m_size, -this.m_size, -this.m_size),
      new THREE.Vector3(this.m_size, this.m_size, this.m_size)
    );
    this.m_explodeDir.round();

    this.m_animating = false;
    this.m_angle = 0;
  }

  vertexShader()
  {
    return `
      varying vec2 vUv; // pass the uv coordinates of each pixel to the frag shader

      void main()
      {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `
  }

  fragmentShader()
  {
    return `
      precision highp float; // set float precision (optional)
      varying vec2 vUv; // identify the uv values as a varying attribute
      uniform float uTime;
      uniform bool uCentre;
  
      void main()
      {
        // Border
        vec2 bl = smoothstep(vec2(0.05), vec2(0.1), vUv);
        vec2 tr = smoothstep(vec2(0.05), vec2(0.1), 1.0 - vUv);
        float mask = bl.x * bl.y * tr.x * tr.y;
        
        // Colour
        vec3 colour;
        if (uCentre)
        {
          colour = vec3(mask);
        }
        else
        {
          colour = vec3(1.0 - mask);
        }
        vec3 rainbow = 0.5 + 0.5 * cos(uTime + vUv.xyx + vec3(0, 2, 4));
        colour *= rainbow;

        gl_FragColor = vec4(colour, 1.0);
      }
    `
  }
}

class Cube
{
  constructor(_scene, _position, _cellSize)
  {
    // Setup
    this.m_scene = _scene;
    this.m_position = _position;
    this.m_cellSize = _cellSize;
    this.m_cells = new Array();

    // Animation
    this.m_animating = false;
    this.m_autoTransform = false;
    this.m_exploding = false;

    this.m_speed = 200;
    this.m_explodeChance = 10;
    this.m_turnFaceChance = 60;
    this.m_maxExplodeDist = 2.0;
    this.m_explodeDirection = 1;   // OUT = 1, IN = -1
    this.m_face = "";
    this.m_turnDirection = 0;   // CW = 1, CCW = -1
    this.m_faceNormals = new Map();
    this.m_faces = ["L", "R", "D", "U", "B", "F"];
    
    this.m_faceNormals.set("L", new THREE.Vector4(-1, 0, 0, -1));   // LEFT  (L) = -x
    this.m_faceNormals.set("R", new THREE.Vector4(1, 0, 0, 1));     // RIGHT (R) = +x
    this.m_faceNormals.set("D", new THREE.Vector4(0, -1, 0, -1));   // DOWN  (D) = -y
    this.m_faceNormals.set("U", new THREE.Vector4(0, 1, 0, 1));     // UP    (U) = +y
    this.m_faceNormals.set("B", new THREE.Vector4(0, 0, -1, -1));   // BACK  (B) = -z
    this.m_faceNormals.set("F", new THREE.Vector4(0, 0, 1, 1));     // FRONT (F) = +z

    this.createCube();
  }

  createCube()
  {
    let min = this.m_position.x - 1;
    let max = this.m_position.x + 1;

    for (let x = min; x <= max; x++)
    {
      for (let y = min; y <= max; y++)
      {
        for (let z = min; z <= max; z++)
        {
          let xPos = this.m_position.x + (x * this.m_cellSize);
          let yPos = this.m_position.y + (y * this.m_cellSize);
          let zPos = this.m_position.z + (z * this.m_cellSize);

          let matrix = new THREE.Matrix4();
          matrix.makeTranslation(xPos, yPos, zPos);

          this.m_cells.push(new Cell(this.m_scene, matrix, this.m_cellSize));
        }
      }
    }
    this.m_cells[13].m_uniforms.uCentre.value = true;
  }

  update(_delta)
  {
    this.updateUniforms(_delta);

    if (this.m_autoTransform)
    {
      this.autoTransform(_delta);
    }

    if (this.m_exploding)
    {
      this.explode(_delta);
    }
    else if (this.m_animating)
    {
      this.turn(_delta);
    }
  }

  updateUniforms(_delta)
  {
    for (let i = 0; i < this.m_cells.length; i++)
    {
      let cell = this.m_cells[i];
      cell.m_uniforms.uTime.value += _delta;
    }
  }

  // Currently will only turn faces of a 3x3x3 cube
  // e.g outer faces of a 5x5x5 cube won't turn.
  turnFace()
  {
    this.m_animating = true;
    let face = this.m_faces[Math.floor(Math.random() * (this.m_faces.length - 1))];
    this.m_turnDirection = (Math.floor(Math.random()) * 2) - 1;

    for (let i = 0; i < this.m_cells.length; i++)
    {
      let cell = this.m_cells[i];
      let facePos = this.m_faceNormals.get(face).w;

      if (Math.round(cell.m_mesh.position.x) <= facePos * cell.m_size && face == "L")
      {
        cell.m_animating = true;
        cell.m_face = face;
      }
      else if (Math.round(cell.m_mesh.position.x) >= facePos * cell.m_size && face == "R")
      {
        cell.m_animating = true;
        cell.m_face = face;
      }
      else if (Math.round(cell.m_mesh.position.y) <= facePos * cell.m_size && face == "D")
      {
        cell.m_animating = true;
        cell.m_face = face;
      }
      else if (Math.round(cell.m_mesh.position.y) >= facePos * cell.m_size && face == "U")
      {
        cell.m_animating = true;
        cell.m_face = face;
      }
      else if (Math.round(cell.m_mesh.position.z) <= facePos * cell.m_size && face == "B")
      {
        cell.m_animating = true;
        cell.m_face = face;
      }
      else if (Math.round(cell.m_mesh.position.z) >= facePos * cell.m_size && face == "F")
      {
        cell.m_animating = true;
        cell.m_face = face;
      }
    }
  }

  turnCube()
  {
    let face = this.m_faces[Math.floor(Math.random() * (this.m_faces.length - 1))];
    let direction = (Math.floor(Math.random()) * 2) - 1;
    this.m_animating = true;
    this.m_turnDirection = direction;

    for (let i = 0; i < this.m_cells.length; i++)
    {
      let cell = this.m_cells[i];
      cell.m_animating = true;
      cell.m_face = face;
    }
  }

  autoTransform(_delta)
  {
    if (this.m_animating || this.m_exploding)
    {
      return;
    }

    let move = Math.floor(Math.random() * 100);
    if (move < this.m_explodeChance)
    {
      this.m_exploding = true;
    }
    else if (move >= this.m_explodeChance && move < this.m_turnFaceChance)
    {
      this.turnFace();
    }
    else
    {
      this.turnCube();
    }
  }

  explode(_delta)
  {
    for (let i = 0; i < this.m_cells.length; i++)
    {
      let cell = this.m_cells[i];
      if (this.m_exploding)
      {
        let move = new THREE.Vector3();
        move.copy(cell.m_explodeDir);
        move = move.multiplyScalar(_delta * (this.m_speed / 45.0) * this.m_explodeDirection);

        cell.m_explodeDist += _delta * (this.m_speed / 45.0);
        cell.m_mesh.position.add(move);

        if (Math.abs(cell.m_explodeDist) >= this.m_maxExplodeDist * this.m_cellSize)
        {
          this.resetExplode();
        }
      }
    }
  }

  turn(_delta)
  {
    for (let i = 0; i < this.m_cells.length; i++)
    {
      let cell = this.m_cells[i];
      if (cell.m_animating)
      {
        // Animate rotation
        cell.m_angle += _delta * this.m_speed;
        let rot = new THREE.Matrix4();
        rot.makeRotationAxis(this.m_faceNormals.get(cell.m_face), THREE.MathUtils.degToRad(_delta * this.m_speed * this.m_turnDirection));
        cell.m_mesh.applyMatrix4(rot);

        // Reset transforms
        if (Math.abs(cell.m_angle) >= 90)
        {
          cell.resetRotation();
          cell.resetPosition();
          this.m_animating = false;
        }
      }
    }
  }

  resetExplode()
  {
    this.m_exploding = false;
    this.m_explodeDirection = this.m_explodeDirection * -1.0;

    for (let i = 0; i < this.m_cells.length; i++)
    {
      let cell = this.m_cells[i];
      cell.m_explodeDist = cell.m_size;
    }
  }
}

let container = document.querySelector("#scene-container");

let camera, scene, renderer, composer, controls;

let cube;

let toneMappingProperties, toneMappingType;

let bloomProperties, debugProperties;

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
	const webGLError = WebGL.getWebGLErrorMessage();
	document.getElementById("webgl-error-container").appendChild(webGLError);
}

function init()
{
  // CAMERA
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 10000);
  camera.position.set(25, 15, 25);

  // SCENE
  scene = new THREE.Scene();

  // HERO ELEMENT
  cube = new Cube(scene, new THREE.Vector3(), 2);
  
  // RENDERER
  toneMappingProperties = {
    exposure: 1.0,
    toneMapping: 'ACESFilmic',
  };

  toneMappingType = {
    None: THREE.NoToneMapping,
    Linear: THREE.LinearToneMapping,
    Reinhard: THREE.ReinhardToneMapping,
    Cineon: THREE.CineonToneMapping,
    ACESFilmic: THREE.ACESFilmicToneMapping,
  };

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = toneMappingType[toneMappingProperties.toneMapping];
	renderer.toneMappingExposure = toneMappingProperties.exposure;
  container.append(renderer.domElement);

  // POST PROCESSING
  composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  bloomProperties = {
    bloomEnabled: false,
    strength: 0.5,
    radius: 0.2,
    threshold: 0.05
  }

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    bloomProperties.strength,
    bloomProperties.radius,
    bloomProperties.threshold);

  // CONTROLS
  controls = new OrbitControls(camera, renderer.domElement);
	controls.minDistance = new THREE.Vector3().distanceTo(camera.position);
	controls.maxDistance = 50;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minPolarAngle = Math.PI * 0.25;
  controls.maxPolarAngle = Math.PI * 0.75;

  // EVENTS
  tanFOV = Math.tan(((Math.PI / 180) * camera.fov / 2));
  windowHeight = container.clientHeight;

  window.addEventListener("resize", onWindowResize, false);
  window.addEventListener('blur', notFocused, false);
  window.addEventListener('focus', focused, false);

  // DEBUG
  debugProperties = {
    showAxes: false
  }

  const axis = new THREE.AxesHelper(20);

  // GUI
  const gui = new lil.GUI();
  gui.close();

  const cubeFolder = gui.addFolder("Cube");
  cubeFolder.close();

    // Transform
    const transformFolder = cubeFolder.addFolder("Transform");
    transformFolder.close();
    transformFolder.add(cube, "m_autoTransform").name("Auto Transform").onChange(function(value)
    {
      value ? cube.m_autoTransform = true : cube.m_autoTransform = false;
    });
    transformFolder.add(cube, "m_speed", 10, 500, 10).name("Turn Speed");

    // Post Processing
    const ppFolder = cubeFolder.addFolder("Post Processing");
    ppFolder.close();
    
      // Bloom
      const bloomFolder = ppFolder.addFolder("Bloom");
      bloomFolder.close();
      bloomFolder.add(bloomProperties, "bloomEnabled").name("Enable/Disable").onChange(function(value)
      {
        value ? composer.addPass(bloomPass) : composer.removePass(bloomPass);
      });
      bloomFolder.add(bloomProperties, "strength", 0, 3, 0.01).name("Strength").onChange(function(value)
      {
        bloomPass.strength = value;
      });
      bloomFolder.add(bloomProperties, "radius", 0, 1, 0.01).name("Radius").onChange(function(value)
      {
        bloomPass.radius = value;
      });
      bloomFolder.add(bloomProperties, "threshold", 0.05, 1, 0.01).name("Threshold").onChange(function(value)
      {
        bloomPass.threshold = value;
      });

      // Tone Mapping
      const toneMappingFolder = ppFolder.addFolder("Tone Mapping");
      toneMappingFolder.close();
      toneMappingFolder.add(toneMappingProperties, 'toneMapping', Object.keys(toneMappingType)).name("Type").onChange(function(){
        renderer.toneMapping = toneMappingType[toneMappingProperties.toneMapping];
      });
      toneMappingFolder.add(toneMappingProperties, 'exposure', 0, 2).name("Exposure").onChange(function(){
        renderer.toneMappingExposure = toneMappingProperties.exposure;
      });

    // Debug
    const debugFolder = cubeFolder.addFolder("Debug");
    debugFolder.close();
    debugFolder.add(debugProperties, "showAxes").name("Show Axes").onChange(function(value)
    {
      value ? scene.add(axis) : scene.remove(axis);
    });
}

function onWindowResize()
{
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.fov = (360 / Math.PI) * Math.atan(tanFOV * (container.clientHeight / windowHeight));
    
  camera.updateProjectionMatrix();
  camera.lookAt(scene.position);

  renderer.setSize(container.clientWidth, container.clientHeight);
  composer.setSize(container.clientWidth, container.clientHeight);
}

function focused()
{
  clock.start();
}
function notFocused()
{
  clock.stop();
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
    controls.update();

    // Render
    composer.render();

    stats.end();
  })
}
