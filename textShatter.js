import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

const initTextShatter = () => {
    const canvas = document.getElementById('text-shatter-canvas');
    if (!canvas) return;

    const wrap = document.getElementById('text-shatter-wrap');
    let width = wrap.offsetWidth;
    let height = wrap.offsetHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 80;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Particle count: 128 x 128 = 16,384 particles
    const WIDTH = 128;
    const PARTICLES = WIDTH * WIDTH;

    let gpuCompute;
    let velocityVariable;
    let positionVariable;
    let particleUniforms;
    let particlesMesh;

    // Load Font
    const fontLoader = new FontLoader();
    fontLoader.load('https://unpkg.com/three@0.128.0/examples/fonts/helvetiker_bold.typeface.json', (font) => {
        
        // Generate Text Geometry
        const textGeo = new TextGeometry("Let's work\ntogether!", {
            font: font,
            size: 8,
            height: 1,
            curveSegments: 3,
            bevelEnabled: true,
            bevelThickness: 0.5,
            bevelSize: 0.2,
            bevelOffset: 0,
            bevelSegments: 2
        });
        
        textGeo.center();
        const textMesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial());
        
        // Sample points on the surface
        const sampler = new MeshSurfaceSampler(textMesh).build();
        const sampledPositions = new Float32Array(PARTICLES * 4); // xyzw for textures
        
        const tempPosition = new THREE.Vector3();
        for (let i = 0; i < PARTICLES; i++) {
            sampler.sample(tempPosition);
            sampledPositions[i * 4 + 0] = tempPosition.x;
            sampledPositions[i * 4 + 1] = tempPosition.y;
            sampledPositions[i * 4 + 2] = tempPosition.z;
            sampledPositions[i * 4 + 3] = 1.0;
        }

        initGPGPU(sampledPositions);
        initParticles();
        animate();
        
        // Show text area once loaded
        gsap.to(canvas, {opacity: 1, duration: 1});
    });

    const velocityShader = `
        uniform float time;
        uniform vec2 mousePos;
        
        void main() {
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            vec4 pos = texture2D(texturePosition, uv);
            vec4 vel = texture2D(textureVelocity, uv);
            vec4 orig = texture2D(textureOriginal, uv);
            
            vec3 p = pos.xyz;
            vec3 v = vel.xyz;
            vec3 o = orig.xyz;

            // Mouse Repulsion
            vec3 mPos = vec3(mousePos.x, mousePos.y, 0.0);
            float dist = distance(p, mPos);
            if (dist < 15.0) {
                vec3 dir = normalize(p - mPos);
                v += dir * (15.0 - dist) * 0.1;
            }

            // Spring Force back to original
            vec3 spring = (o - p) * 0.05;
            v += spring;

            // Friction / Damping
            v *= 0.85;

            gl_FragColor = vec4(v, 1.0);
        }
    `;

    const positionShader = `
        void main() {
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            vec4 pos = texture2D(texturePosition, uv);
            vec4 vel = texture2D(textureVelocity, uv);
            
            pos.xyz += vel.xyz;
            
            gl_FragColor = pos;
        }
    `;

    function initGPGPU(sampledPositions) {
        gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
        
        const dtPosition = gpuCompute.createTexture();
        const dtVelocity = gpuCompute.createTexture();
        const dtOriginal = gpuCompute.createTexture();

        const pArray = dtPosition.image.data;
        const vArray = dtVelocity.image.data;
        const oArray = dtOriginal.image.data;

        for (let i = 0; i < pArray.length; i++) {
            pArray[i] = sampledPositions[i];
            vArray[i] = 0;
            oArray[i] = sampledPositions[i];
        }

        velocityVariable = gpuCompute.addVariable("textureVelocity", velocityShader, dtVelocity);
        positionVariable = gpuCompute.addVariable("texturePosition", positionShader, dtPosition);

        gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
        gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);

        velocityVariable.material.uniforms["time"] = { value: 0.0 };
        velocityVariable.material.uniforms["mousePos"] = { value: new THREE.Vector2(-999, -999) };
        velocityVariable.material.uniforms["textureOriginal"] = { value: dtOriginal };

        const error = gpuCompute.init();
        if (error !== null) {
            console.error("GPGPU Init Error:", error);
        }
    }

    function initParticles() {
        const geometry = new THREE.BufferGeometry();
        
        const uvs = new Float32Array(PARTICLES * 2);
        const rand = new Float32Array(PARTICLES);
        
        let p = 0;
        for (let j = 0; j < WIDTH; j++) {
            for (let i = 0; i < WIDTH; i++) {
                uvs[p++] = i / (WIDTH - 1);
                uvs[p++] = j / (WIDTH - 1);
            }
        }
        for(let i=0; i<PARTICLES; i++) {
            rand[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

        particleUniforms = {
            texturePosition: { value: null },
            color1: { value: new THREE.Color(0xffffff) },
            color2: { value: new THREE.Color(0xddeeff) }
        };

        const material = new THREE.ShaderMaterial({
            uniforms: particleUniforms,
            vertexShader: `
                uniform sampler2D texturePosition;
                attribute float aRand;
                varying float vRand;
                
                void main() {
                    vRand = aRand;
                    vec4 posTemp = texture2D(texturePosition, uv);
                    vec3 pos = posTemp.xyz;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    
                    // Point size
                    gl_PointSize = (1.5 + vRand * 2.5) * (100.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color1;
                uniform vec3 color2;
                varying float vRand;
                
                void main() {
                    // Circle
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    if(length(coord) > 0.5) discard;
                    
                    vec3 color = mix(color1, color2, vRand);
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        particlesMesh = new THREE.Points(geometry, material);
        scene.add(particlesMesh);
    }

    const mouse = new THREE.Vector2(-999, -999);
    wrap.addEventListener('mousemove', (e) => {
        const rect = wrap.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / width) * 2 - 1;
        const ny = -((e.clientY - rect.top) / height) * 2 + 1;
        
        const vec = new THREE.Vector3(nx, ny, 0.5);
        vec.unproject(camera);
        vec.sub(camera.position).normalize();
        const distance = -camera.position.z / vec.z;
        const pos = camera.position.clone().add(vec.multiplyScalar(distance));
        
        mouse.x = pos.x;
        mouse.y = pos.y;
    });

    wrap.addEventListener('mouseleave', () => {
        mouse.x = -999;
        mouse.y = -999;
    });

    window.addEventListener('resize', () => {
        if (!wrap) return;
        width = wrap.offsetWidth;
        height = wrap.offsetHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });

    function animate() {
        requestAnimationFrame(animate);
        
        if (gpuCompute && velocityVariable && positionVariable && particlesMesh) {
            velocityVariable.material.uniforms["mousePos"].value.copy(mouse);
            
            gpuCompute.compute();
            
            particleUniforms["texturePosition"].value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
        }
        
        renderer.render(scene, camera);
    }
};

if (document.readyState === 'complete') {
    initTextShatter();
} else {
    window.addEventListener('DOMContentLoaded', initTextShatter);
}
