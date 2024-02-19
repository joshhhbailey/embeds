import * as THREE from "three";
import * as lil from "lil-gui";
import Stats from "stats.js";

import WebGL from "three/examples/jsm/capabilities/WebGL.js";

class Blob
{
  constructor()
  {
    this.m_uniforms =
    {
      uTime: {type: "float", value: 0},
      uAmplitude: {type: "float", value: 0.8},
      uFrequency: {type: "float", value: 0.125},
      uSpeed: {type: "float", value: 0.5}
    };

    this.createBlob();
  }

  createBlob()
  {
    this.m_geometry = new THREE.IcosahedronGeometry(5, 10);
    this.m_material = new THREE.MeshStandardMaterial({
      onBeforeCompile: (shader) => {
        // Store reference to shader object
        this.m_material.userData.shader = shader;

        // Uniforms
        shader.uniforms.uTime = this.m_uniforms.uTime;
        shader.uniforms.uAmplitude = this.m_uniforms.uAmplitude;
        shader.uniforms.uFrequency = this.m_uniforms.uFrequency;
        shader.uniforms.uSpeed = this.m_uniforms.uSpeed;

        // Inject uniforms
        shader.vertexShader = shader.vertexShader.replace(
          `void main() {`,
          `//
          // Description : Array and textureless GLSL 2D/3D/4D simplex
          //               noise functions.
          //      Author : Ian McEwan, Ashima Arts.
          //  Maintainer : ijm
          //     Lastmod : 20110822 (ijm)
          //     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
          //               Distributed under the MIT License. See LICENSE file.
          //               https://github.com/ashima/webgl-noise
          //

          vec3 mod289(vec3 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
          }

          vec4 mod289(vec4 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
          }

          vec4 permute(vec4 x) {
               return mod289(((x*34.0)+1.0)*x);
          }

          vec4 taylorInvSqrt(vec4 r)
          {
            return 1.79284291400159 - 0.85373472095314 * r;
          }

          float snoise(vec3 v)
          {
            const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
          
            // First corner
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 =   v - i + dot(i, C.xxx) ;
          
            // Other corners
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
          
            //   x0 = x0 - 0.0 + 0.0 * C.xxx;
            //   x1 = x0 - i1  + 1.0 * C.xxx;
            //   x2 = x0 - i2  + 2.0 * C.xxx;
            //   x3 = x0 - 1.0 + 3.0 * C.xxx;
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
            vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y
          
            // Permutations
            i = mod289(i);
            vec4 p = permute( permute( permute(
                       i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                     + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                     + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            
            // Gradients: 7x7 points over a square, mapped onto an octahedron.
            // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
            float n_ = 0.142857142857; // 1.0/7.0
            vec3  ns = n_ * D.wyz - D.xzx;
            
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)
            
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
            
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            
            //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
            //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            
            // Normalise gradients
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;
            
            // Mix final noise value
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                          dot(p2,x2), dot(p3,x3) ) );
          }
        
          varying vec2 vUv; // pass the uv coordinates of each pixel to the frag shader
          varying vec3 vPosition;
          uniform float uTime;
          uniform float uAmplitude;
          uniform float uFrequency;
          uniform float uSpeed;
          void main() {
          float displacement = uAmplitude * snoise(uFrequency * position + (uTime * uSpeed));
          vPosition = position + normal * displacement;
          `
        );

        shader.vertexShader = shader.vertexShader.replace(
          `#include <begin_vertex>`,
          `#include <begin_vertex>
          transformed = vec3(vPosition);
          `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          `void main() {`,
          `uniform float uTime;
          varying vec2 vUv;
          void main() {
          `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          `#include <color_fragment>`,
          `#include <color_fragment>
          vec3 cyclingColour = 0.5 + 0.5 * cos(uTime + vUv.xyx + vec3(0, 2, 4));
          diffuseColor *= vec4(cyclingColour, 1.0);
          `
        );
      }
    });
    
    this.m_mesh = new THREE.Mesh(this.m_geometry, this.m_material);
    this.m_mesh.position.set(0, 0, 0);
  }
  
  update(delta)
  {
    this.m_uniforms.uTime.value += delta;
  }
}

let container = document.querySelector("#scene-container");

let camera, scene, renderer;

let ambientLight, pointLight, directionalLight;

let blob;

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
  camera.position.set(0, 0, 25);

  // SCENE
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xF0F0EE);

  // LIGHTS
  ambientLight = new THREE.AmbientLight(new THREE.Vector3(1.0, 1.0, 1.0), 0.5);
  scene.add(ambientLight);

  pointLight = new THREE.PointLight(new THREE.Vector3(1.0, 1.0, 1.0), 0.2);
  pointLight.position.set(0, 5, 10);
  scene.add(pointLight);

  directionalLight = new THREE.DirectionalLight(new THREE.Vector3(1.0, 1.0, 1.0), 0.5);
  directionalLight.position.set(0, 0, 1);
  scene.add(directionalLight);

  // HERO ELEMENT
  blob = new Blob();
  scene.add(blob.m_mesh);

  // RENDERER
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.append(renderer.domElement);

  // EVENTS
  tanFOV = Math.tan(((Math.PI / 180) * camera.fov / 2));
  windowHeight = container.clientHeight;

  window.addEventListener("resize", onWindowResize, false);

  // GUI
  const gui = new lil.GUI();
  gui.close();

  // Geometry
  const geometryFolder = gui.addFolder("Geometry");
  geometryFolder.close();

    // Transform
    const transformFolder = geometryFolder.addFolder("Transform");
    transformFolder.close();

      // Scale
      const scaleFolder = transformFolder.addFolder("Scale");
      scaleFolder.close();
      scaleFolder.add(blob.m_mesh.scale, "x", 0, 2, 0.1).name("X");
      scaleFolder.add(blob.m_mesh.scale, "y", 0, 2, 0.1).name("Y");
      scaleFolder.add(blob.m_mesh.scale, "z", 0, 2, 0.1).name("Z");

    // Material
    const materialFolder = geometryFolder.addFolder("Material");
    materialFolder.close();
    materialFolder.add(blob.m_material, "wireframe").name("Wireframe");

      // Noise
      const noiseFolder = materialFolder.addFolder("Noise");
      noiseFolder.close();
      noiseFolder.add(blob.m_uniforms.uAmplitude, "value", 0, 1, 0.01).name("Amplitude");
      noiseFolder.add(blob.m_uniforms.uFrequency, "value", 0, 1, 0.01).name("Frequency");
      noiseFolder.add(blob.m_uniforms.uSpeed, "value", 0, 1, 0.01).name("Speed");

  // Lighting
  const lightingFolder = gui.addFolder("Lighting");
  lightingFolder.close();
    
    // Ambient
    const ambientFolder = lightingFolder.addFolder("Ambient");
    ambientFolder.close();
    ambientFolder.add(ambientLight, "intensity", 0, 1, 0.01).name("Intensity");

    // Point
    const pointFolder = lightingFolder.addFolder("Point");
    pointFolder.close();
    pointFolder.add(pointLight, "intensity", 0, 1, 0.01).name("Intensity");

      // Position
      const pointPosFolder = pointFolder.addFolder("Position");
      pointPosFolder.close();
      pointPosFolder.add(pointLight.position, "x", -1, 1, 0.1).name("X");
      pointPosFolder.add(pointLight.position, "y", -1, 1, 0.1).name("Y");
      pointPosFolder.add(pointLight.position, "z", -1, 1, 0.1).name("Z");

    // Directional
    const directionalFolder = lightingFolder.addFolder("Directional");
    directionalFolder.close();
    directionalFolder.add(directionalLight, "intensity", 0, 1, 0.01).name("Intensity");

      // Position
      const directionalPosFolder = directionalFolder.addFolder("Position");
      directionalPosFolder.close();
      directionalPosFolder.add(directionalLight.position, "x", -1, 1, 0.1).name("X");
      directionalPosFolder.add(directionalLight.position, "y", -1, 1, 0.1).name("Y");
      directionalPosFolder.add(directionalLight.position, "z", -1, 1, 0.1).name("Z");
}

function onWindowResize(event)
{
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.fov = (360 / Math.PI) * Math.atan(tanFOV * (container.clientHeight / windowHeight));
    
  camera.updateProjectionMatrix();
  camera.lookAt(scene.position);

  renderer.setSize(container.clientWidth, container.clientHeight);
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
    blob.update(delta);

    // Render
    renderer.render(scene, camera);

    stats.end();
  })
}
