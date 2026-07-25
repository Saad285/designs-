// -----------------------------------------------------
// Utility: Split Text for Animation
// -----------------------------------------------------
function splitText() {
    document.querySelectorAll('.split-chars').forEach(el => {
        const text = el.innerText;
        el.innerHTML = '';
        text.split('').forEach(char => {
            if (char === ' ') {
                el.innerHTML += `<span class="char-mask" style="width: 0.3em;">&nbsp;</span>`;
            } else {
                el.innerHTML += `<span class="char-mask"><span class="char-inner">${char}</span></span>`;
            }
        });
    });
    document.querySelectorAll('.split-lines').forEach(el => {
        const text = el.innerText;
        el.innerHTML = `<span class="line-mask"><span class="line-inner">${text}</span></span>`;
    });
}
splitText();

// -----------------------------------------------------
// Smooth Scrolling (Lenis + GSAP ScrollTrigger Synchronization)
// -----------------------------------------------------
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
});

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

window.addEventListener("load", () => {
    ScrollTrigger.refresh();
});

// -----------------------------------------------------
// Custom Cursor
// -----------------------------------------------------
const cursor = document.querySelector('.cursor');
let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
let cursorX = mouseX, cursorY = mouseY;

document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

gsap.ticker.add(() => {
    cursorX += (mouseX - cursorX) * 0.2;
    cursorY += (mouseY - cursorY) * 0.2;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
});

document.querySelectorAll('a, button, .magnetic, .nav-circle, .pill-btn, .modal-close').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
    el.addEventListener('mouseleave', () => {
        cursor.classList.remove('hover');
        if (el.classList.contains('magnetic')) gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.3)' });
    });
    if (el.classList.contains('magnetic')) {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const relX = e.clientX - rect.left - rect.width / 2;
            const relY = e.clientY - rect.top - rect.height / 2;
            gsap.to(el, { x: (relX / rect.width) * 15, y: (relY / rect.height) * 15, duration: 0.3, ease: 'power2.out' });
        });
    }
});

// -----------------------------------------------------
// Realistic WebGL Water Ripple (unseen.co liquid effect)
// -----------------------------------------------------
const videoElement = document.getElementById('bg-video');

// Video Playlist & Slowdown Logic
const videoPlaylist = ['bg-video.mp4', 'animate_it_k_and_make_the_far.mp4'];
let currentVideoIndex = 0;

// Slow down the video to give a cinematic effect
videoElement.playbackRate = 0.6;

// When the current video ends, play the next one
videoElement.addEventListener('ended', () => {
    currentVideoIndex = (currentVideoIndex + 1) % videoPlaylist.length;
    videoElement.src = videoPlaylist[currentVideoIndex];
    videoElement.play();
    videoElement.playbackRate = 0.6; // Re-apply slowdown on new source
});

// Remove the HTML 'loop' attribute so the 'ended' event fires
videoElement.removeAttribute('loop');
const sceneContainer = document.querySelector('.scene-container');

// Set up Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Add canvas to scene container, ensure it sits at the back
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.zIndex = '-998';
renderer.domElement.style.pointerEvents = 'none';
sceneContainer.appendChild(renderer.domElement);

// Remove old 2D canvas if present
const oldCanvas = document.getElementById('ripple-canvas');
if (oldCanvas) oldCanvas.remove();

const videoTexture = new THREE.VideoTexture(videoElement);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;

const MAX_RIPPLES = 15;
const ripplesArray = [];
for (let i = 0; i < MAX_RIPPLES; i++) {
    ripplesArray.push(new THREE.Vector3(-1, -1, -9999)); // x, y, time
}

let currentRipple = 0;
const clock = new THREE.Clock();

const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        u_tex: { value: videoTexture },
        u_time: { value: 0 },
        u_aspect: { value: window.innerWidth / window.innerHeight },
        u_ripples: { value: ripplesArray }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D u_tex;
        uniform float u_time;
        uniform float u_aspect;
        uniform vec3 u_ripples[${MAX_RIPPLES}];
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;
            vec2 offset = vec2(0.0);
            
            for(int i = 0; i < ${MAX_RIPPLES}; i++) {
                vec3 rip = u_ripples[i];
                float age = u_time - rip.z;
                
                if(age > 0.0 && age < 4.0) {
                    vec2 dir = uv - rip.xy;
                    dir.x *= u_aspect;
                    float dist = length(dir);
                    
                    float radius = age * 0.15; // Expansion speed
                    float diff = dist - radius;
                    
                    // Gaussian envelope for the ripple crest
                    float envelope = exp(-diff * diff * 200.0);
                    // Fade out over time
                    float decay = max(0.0, 1.0 - age / 4.0);
                    
                    // Sine wave for the ripple shape
                    float wave = sin(diff * 40.0 - age * 5.0);
                    
                    offset += normalize(dir) * wave * envelope * decay * 0.02;
                }
            }
            
            vec2 finalUv = uv + offset;
            
            // Chromatic aberration based on displacement intensity
            float ca = length(offset) * 0.8;
            float r = texture2D(u_tex, finalUv + vec2(ca, 0.0)).r;
            float g = texture2D(u_tex, finalUv).g;
            float b = texture2D(u_tex, finalUv - vec2(ca, 0.0)).b;
            
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `
});

const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shaderMaterial);
scene.add(plane);

function addRipple(x, y) {
    ripplesArray[currentRipple].set(
        x / window.innerWidth,
        1.0 - (y / window.innerHeight), // Invert Y for WebGL UVs
        clock.getElapsedTime()
    );
    currentRipple = (currentRipple + 1) % MAX_RIPPLES;
}

document.addEventListener('mousemove', (e) => {
    // Only drop ripples occasionally to save performance and look natural
    if (Math.random() > 0.6) {
        addRipple(e.clientX, e.clientY);
    }
});

document.addEventListener('click', (e) => {
    // Big burst on click
    for (let i = 0; i < 4; i++) {
        setTimeout(() => addRipple(e.clientX, e.clientY), i * 150);
    }
});

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    shaderMaterial.uniforms.u_aspect.value = window.innerWidth / window.innerHeight;
});

function animateWebGL() {
    requestAnimationFrame(animateWebGL);
    shaderMaterial.uniforms.u_time.value = clock.getElapsedTime();
    renderer.render(scene, camera);
}
animateWebGL();

// -----------------------------------------------------
// GSAP Initial Reveal
// -----------------------------------------------------
gsap.registerPlugin(ScrollTrigger);

const tl = gsap.timeline();
tl.to(".hero-content .char-inner", { y: 0, rotation: 0, duration: 1.2, stagger: 0.02, ease: "power4.out", delay: 0.2 })
  .to(".hero-content .line-inner", { y: 0, duration: 1, ease: "power3.out" }, "-=1")
  .from(".pill-btn", { y: 20, opacity: 0, duration: 1, ease: "power2.out" }, "-=0.8")
  .from(".nav, .widget-bottom-left, .widget-bottom-center, .widget-bottom-right", {
      y: (i, t) => t.classList.contains('nav') ? -20 : 20, opacity: 0, duration: 1, stagger: 0.1, ease: "power2.out"
  }, "-=1");

// -----------------------------------------------------
// Brands Section (Horizontal + Dynamic Themes)
// -----------------------------------------------------
const horizontalContainer = document.querySelector('.horizontal-container');
const slides = gsap.utils.toArray('.brand-slide');

const scrollTween = gsap.to(slides, {
    xPercent: -100 * (slides.length - 1),
    ease: "none",
    scrollTrigger: {
        trigger: ".brands-section",
        pin: true,
        scrub: true,
        end: () => "+=" + horizontalContainer.offsetWidth,
    }
});

let currentTheme = null;

slides.forEach((slide) => {
    ScrollTrigger.create({
        trigger: slide,
        containerAnimation: scrollTween,
        start: "left 60%",
        end: "right 60%",
        onEnter: () => activateSlide(slide),
        onEnterBack: () => activateSlide(slide)
    });
});

function activateSlide(slide) {
    const themeColor = slide.dataset.theme;

    gsap.to(slide.querySelectorAll('.char-inner'), { y: 0, rotation: 0, duration: 1.2, stagger: 0.02, ease: "power4.out", overwrite: "auto" });
    gsap.to(slide.querySelectorAll('.line-inner'), { y: 0, duration: 1, ease: "power3.out", delay: 0.2, overwrite: "auto" });
    gsap.to(slide.querySelectorAll('.stagger-up'), { y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: "power3.out", delay: 0.3, overwrite: "auto" });

    if (currentTheme !== themeColor) {
        currentTheme = themeColor;

        // Fade out the hero video so brand solid color becomes visible
        gsap.to(".scene-container", { opacity: 0, duration: 1, ease: "power2.inOut" });

        gsap.to("body", { backgroundColor: themeColor, duration: 1, ease: "power2.inOut" });
        gsap.to(".nav, .logo", { color: "#ffffff", duration: 1 });
        cursor.classList.add('light-mode');
    }
}

slides.forEach(slide => {
    ScrollTrigger.create({
        trigger: slide,
        containerAnimation: scrollTween,
        start: "right 0%",
        end: "left 100%",
        onLeave: () => resetSlide(slide),
        onLeaveBack: () => resetSlide(slide)
    });
});

function resetSlide(slide) {
    gsap.set(slide.querySelectorAll('.char-inner'), { y: '110%', rotation: 5 });
    gsap.set(slide.querySelectorAll('.line-inner'), { y: '110%' });
    gsap.set(slide.querySelectorAll('.stagger-up'), { y: 30, opacity: 0 });
}

slides.forEach(slide => {
    const imgs = slide.querySelectorAll('.parallax-img');
    imgs.forEach(img => {
        gsap.to(img, {
            y: "15%", ease: "none",
            scrollTrigger: { trigger: slide, containerAnimation: scrollTween, start: "left right", end: "right left", scrub: true }
        });
    });
});

ScrollTrigger.create({
    trigger: ".hero-section",
    start: "bottom center",
    onEnterBack: () => {
        currentTheme = null;

        // Bring video back
        gsap.to(".scene-container", { opacity: 1, duration: 1, ease: "power2.inOut" });

        gsap.to("body", { backgroundColor: "#f7ece8", color: "#2b2626", duration: 1, ease: "power2.inOut" });
        gsap.to(".nav, .logo", { color: "#fff", duration: 1 });
        cursor.classList.remove('light-mode');
    }
});

// Chat Panel (Emotive Stylist)
function openChatPanel() {
    document.getElementById('stylist-panel').classList.add('active');
    lenis.stop(); // Stop scroll when panel is open
}
function closeChatPanel() {
    document.getElementById('stylist-panel').classList.remove('active');
    lenis.start();
}

// -----------------------------------------------------
// Modules Overlay (Globe Icon Click & Spatial Camera)
// -----------------------------------------------------
const modulesCanvas = document.getElementById('modules-canvas');
let currentCardIndex = 0;
let canvasAnimFrame;
let lastScrollTime = 0;

let canvasTargetX = 0;
let canvasTargetY = 0;
let canvasCurrentX = 0;
let canvasCurrentY = 0;

// Warp animation proxy object
const warpSettings = { scale: 1, blur: 0 };

// Hardcoded specific positions from CSS (in vw and vh units)
const cardCoordinates = [
    { x: 1, y: 1 },    // Card 1: 100vw, 100vh
    { x: 2.5, y: 2.5 },// Card 2: 250vw, 250vh
    { x: 3, y: 1 },    // Card 3: 300vw, 100vh
    { x: 1.5, y: 3 }   // Card 4: 150vw, 300vh
];

function updateActiveCard() {
    const clusters = document.querySelectorAll('.module-cluster');
    clusters.forEach(c => {
        c.classList.remove('active-cluster');
        c.querySelector('.module-card').classList.remove('active-card');
    });
    
    const normalizedIndex = ((currentCardIndex % 4) + 4) % 4;
    const activeCluster = clusters[normalizedIndex];
    activeCluster.classList.add('active-cluster');
    activeCluster.querySelector('.module-card').classList.add('active-card');
    
    // Move the user (camera) to center this specific cluster
    const targetCard = cardCoordinates[normalizedIndex];
    canvasTargetX = (window.innerWidth / 2) - (targetCard.x * window.innerWidth);
    canvasTargetY = (window.innerHeight / 2) - (targetCard.y * window.innerHeight);
}

function openModules() {
    const overlay = document.getElementById('modules-overlay');
    const globe = document.getElementById('globe-canvas');
    overlay.classList.add('active');
    lenis.stop();
    
    // Instant jump to first card position
    const targetCard = cardCoordinates[0];
    canvasCurrentX = canvasTargetX = (window.innerWidth / 2) - (targetCard.x * window.innerWidth);
    canvasCurrentY = canvasTargetY = (window.innerHeight / 2) - (targetCard.y * window.innerHeight);
    
    // Reset warp settings for animation
    warpSettings.scale = 0.01;
    warpSettings.blur = 30;
    
    updateActiveCard();
    canvasAnimFrame = requestAnimationFrame(panCanvas);

    // Dramatic Black Hole & Rocket Warp Animation
    const tl = gsap.timeline();
    
    // 1. Black hole expands rapidly
    tl.fromTo(overlay, 
        { clipPath: "circle(0% at 50% 50%)" }, 
        { clipPath: "circle(150% at 50% 50%)", duration: 1.2, ease: "power4.inOut" }
    );

    // 2. The spatial universe rockets forward into view
    tl.to(warpSettings, {
        scale: 1, blur: 0, duration: 1.8, ease: "expo.out" 
    }, "-=0.6");

    // 3. Globe shoots in with a massive spin
    tl.fromTo(globe,
        { scale: 0, rotationZ: 180, opacity: 0 },
        { scale: 1, rotationZ: 0, opacity: 0.95, duration: 2, ease: "expo.out" },
        "-=1.8"
    );
}

function closeModules() {
    const overlay = document.getElementById('modules-overlay');
    const globe = document.getElementById('globe-canvas');
    
    // Reverse warp animation
    const tl = gsap.timeline({
        onComplete: () => {
            overlay.classList.remove('active');
            lenis.start();
            cancelAnimationFrame(canvasAnimFrame);
        }
    });
    
    tl.to(warpSettings, { scale: 0.01, blur: 30, duration: 0.8, ease: "power3.in" })
      .to(globe, { scale: 0, opacity: 0, rotationZ: -90, duration: 0.8, ease: "power3.in" }, 0)
      .to(overlay, { clipPath: "circle(0% at 50% 50%)", duration: 0.8, ease: "power3.in" }, 0.2);
}

// Camera pan loop
function panCanvas() {
    // Lerp for cinematic smooth panning between fixed points
    canvasCurrentX += (canvasTargetX - canvasCurrentX) * 0.05;
    canvasCurrentY += (canvasTargetY - canvasCurrentY) * 0.05;
    
    modulesCanvas.style.transform = `translate3d(${canvasCurrentX}px, ${canvasCurrentY}px, 0) scale(${warpSettings.scale})`;
    modulesCanvas.style.filter = `blur(${warpSettings.blur}px)`;
    
    canvasAnimFrame = requestAnimationFrame(panCanvas);
}

// Swipe/Scroll to move user to the next/prev card
document.getElementById('modules-overlay').addEventListener('wheel', (e) => {
    const now = Date.now();
    if (now - lastScrollTime < 1000) return; // Wait for pan to complete

    if (e.deltaY > 30 || e.deltaX > 30) {
        currentCardIndex++;
        lastScrollTime = now;
        updateActiveCard();
    } else if (e.deltaY < -30 || e.deltaX < -30) {
        currentCardIndex--;
        lastScrollTime = now;
        updateActiveCard();
    }
}, { passive: true });

// Optional: Drag to trigger next/prev
let isDraggingCanvas = false;
let startDragX = 0;
modulesCanvas.addEventListener('mousedown', (e) => {
    isDraggingCanvas = true;
    startDragX = e.clientX;
});
window.addEventListener('mouseup', (e) => {
    if (!isDraggingCanvas) return;
    isDraggingCanvas = false;
    const dx = e.clientX - startDragX;
    if (Math.abs(dx) > 100) {
        if (dx < 0) currentCardIndex++;
        else currentCardIndex--;
        updateActiveCard();
    }
});

// 3D Tilt and Continuous Floating for Module Cards
document.querySelectorAll('.module-card').forEach((el, i) => {
    const animTarget = el.querySelector('.mc-float-wrapper');
    
    // Continuous float animation (all directions movement)
    gsap.to(animTarget, {
        y: "random(-40, 40)",
        x: "random(-40, 40)",
        rotationZ: "random(-3, 3)",
        duration: "random(4, 8)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: i * 0.2
    });

    // 3D Mouse Tilt (Only for main cards, not side images)
    if (el.classList.contains('module-card')) {
        const inner = el.querySelector('.mc-inner');
        const shine = el.querySelector('.mc-shine');
        
        inner.addEventListener('mousemove', (e) => {
            const rect = inner.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateY = ((x - centerX) / centerX) * 15;
        const rotateX = ((centerY - y) / centerY) * 15;

        inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;

        const shineX = (x / rect.width) * 100;
        const shineY = (y / rect.height) * 100;
        shine.style.setProperty('--shine-x', `${shineX}%`);
        shine.style.setProperty('--shine-y', `${shineY}%`);
    });

        inner.addEventListener('mouseleave', () => {
            inner.style.transform = 'rotateX(0) rotateY(0) scale(1)';
            inner.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease';
        });

        inner.addEventListener('mouseenter', () => {
            inner.style.transition = 'transform 0.1s linear, box-shadow 0.4s ease';
        });
    }
});

// -----------------------------------------------------
// 3D Wireframe Globe (Modules Overlay Background)
// -----------------------------------------------------
const globeCanvas = document.getElementById('globe-canvas');

// Setup Three.js for Globe
const globeScene = new THREE.Scene();
const globeCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
globeCamera.position.z = 5;

const globeRenderer = new THREE.WebGLRenderer({ canvas: globeCanvas, alpha: true, antialias: true });
globeRenderer.setSize(window.innerWidth, window.innerHeight);
globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Create Wireframe Sphere (24 width segments, 24 height segments for a dense grid like the image)
const globeGeometry = new THREE.SphereGeometry(2, 24, 24);

// Remove the diagonal lines to make it look like a latitude/longitude grid
const edgesGeometry = new THREE.EdgesGeometry(globeGeometry);
const globeMaterial = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.25,
    linewidth: 1
});
const globeMesh = new THREE.LineSegments(edgesGeometry, globeMaterial);

// Tilt the globe slightly
globeMesh.rotation.z = 0.2;
globeMesh.rotation.x = 0.2;
globeScene.add(globeMesh);

// Add slight subtle mouse tracking to the globe rotation
let targetGlobeRotX = 0.2;
let targetGlobeRotY = 0;
let baseGlobeRotY = 0; // Added for constant spinning

document.addEventListener('mousemove', (e) => {
    if (document.getElementById('modules-overlay').classList.contains('active')) {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        targetGlobeRotY = x * 0.5;
        targetGlobeRotX = 0.2 + y * 0.5;
    }
});

function animateGlobe() {
    requestAnimationFrame(animateGlobe);
    
    // Base constant rotation (fast enough to not look static)
    baseGlobeRotY += 0.004; 
    
    // Lerp to the combined target (mouse parallax + continuous base rotation)
    globeMesh.rotation.x += (targetGlobeRotX - globeMesh.rotation.x) * 0.05;
    
    const finalRotY = baseGlobeRotY + targetGlobeRotY;
    globeMesh.rotation.y += (finalRotY - globeMesh.rotation.y) * 0.05;
    
    globeRenderer.render(globeScene, globeCamera);
}
animateGlobe();

window.addEventListener('resize', () => {
    globeCamera.aspect = window.innerWidth / window.innerHeight;
    globeCamera.updateProjectionMatrix();
    globeRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Mega Menu Logic
const navCircle = document.querySelector('.nav-circle');
if (navCircle) {
    navCircle.addEventListener('click', () => {
        document.body.classList.add('mega-menu-open');
    });
}

window.closeMegaMenu = function() {
    document.body.classList.remove('mega-menu-open');
};

// Cosmic Light-Speed Portal Transition Logic
const chatbotLinks = document.querySelectorAll('a[href="stylist.html"]');
const cosmicTransition = document.getElementById('cosmic-transition');
const warpTunnel = document.querySelector('.warp-tunnel');
const warpRings = document.querySelectorAll('.warp-ring');
const warpCore = document.querySelector('.warp-core');

if (chatbotLinks.length > 0 && cosmicTransition) {
    chatbotLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            
            cosmicTransition.classList.add('active');
            
            const tl = gsap.timeline({
                onComplete: () => {
                    window.location.href = href;
                }
            });
            
            // 1. Zoom the page inward with high-speed motion blur simulation
            tl.to(document.body, {
                scale: 1.15,
                opacity: 0.2,
                filter: "blur(12px)",
                duration: 1.2,
                ease: "power3.in"
            }, 0);
            
            // 2. Cosmic Tunnel expands rapidly
            tl.to(warpTunnel, {
                scale: 2.5,
                filter: "blur(0px)",
                duration: 1.2,
                ease: "expo.inOut"
            }, 0);
            
            // 3. Shockwave rings pulse outwards
            tl.to(warpRings, {
                scale: 4,
                opacity: 0,
                duration: 1.1,
                stagger: 0.15,
                ease: "power2.out"
            }, 0.1);
            
            // 4. Warp Core expands to engulf the screen in dark midnight blue/cyan
            tl.to(warpCore, {
                scale: 2,
                duration: 1.2,
                ease: "power4.inOut"
            }, 0.2);
        });
    });
}

// ==========================================================================
// STYLESCOUT SECTION (React/Framer Replica in Vanilla)
// ==========================================================================
function initStyleScoutSection() {
    const section = document.getElementById('stylescout-section');
    if (!section || typeof THREE === 'undefined') return;

    // 1. Three.js Sprinkling Particles (InstancedMesh)
    const canvas = document.getElementById('stylescout-canvas');
    const width = section.offsetWidth;
    const height = section.offsetHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    window.addEventListener('resize', () => {
        if (!section) return;
        camera.aspect = section.offsetWidth / section.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(section.offsetWidth, section.offsetHeight);
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const pointLight1 = new THREE.PointLight(0x00ffcc, 2);
    pointLight1.position.set(10, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff00ff, 2);
    pointLight2.position.set(-10, -10, -10);
    scene.add(pointLight2);

    const count = 400;
    const geometry = new THREE.DodecahedronGeometry(0.2, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.8 });
    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    
    const particles = [];
    for (let i = 0; i < count; i++) {
        particles.push({
            t: Math.random() * 100,
            factor: 20 + Math.random() * 100,
            speed: 0.01 + Math.random() / 200,
            xFactor: -50 + Math.random() * 100,
            yFactor: -50 + Math.random() * 100,
            zFactor: -50 + Math.random() * 100,
            mx: 0,
            my: 0
        });
    }

    const dummy = new THREE.Object3D();
    scene.add(instancedMesh);

    let scrollY = 0;
    window.addEventListener('scroll', () => {
        scrollY = window.scrollY;
    });

    function animateParticles() {
        requestAnimationFrame(animateParticles);

        particles.forEach((particle, i) => {
            particle.t += particle.speed / 2;
            const t = particle.t;
            const factor = particle.factor;
            const a = Math.cos(t) + Math.sin(t * 1) / 10;
            const b = Math.sin(t) + Math.cos(t * 2) / 10;
            const s = Math.cos(t);

            // Adding a slight scroll interaction effect
            const scrollInfluence = scrollY * 0.01;

            dummy.position.set(
                (particle.mx / 10) * a + particle.xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
                (particle.my / 10) * b + particle.yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10 + scrollInfluence,
                (particle.my / 10) * b + particle.zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
            );
            dummy.scale.set(s, s, s);
            dummy.rotation.set(s * 5, s * 5, s * 5);
            dummy.updateMatrix();

            instancedMesh.setMatrixAt(i, dummy.matrix);
        });
        instancedMesh.instanceMatrix.needsUpdate = true;

        renderer.render(scene, camera);
    }
    animateParticles();

    // 2. GSAP ScrollTrigger for Line and Cards
    const cards = gsap.utils.toArray('.stylescout-card');
    const svgLine = document.querySelector('.stylescout-svg-line .anim-line');

    if (svgLine) {
        // Prepare SVG line for drawing
        const length = svgLine.getTotalLength();
        gsap.set(svgLine, { strokeDasharray: length, strokeDashoffset: length });

        gsap.to(svgLine, {
            strokeDashoffset: 0,
            ease: "none",
            scrollTrigger: {
                trigger: section,
                start: "top 70%",
                end: "top 20%",
                scrub: true
            }
        });
    }

    if (cards.length > 0) {
        cards.forEach((card, i) => {
            gsap.fromTo(card, 
                { y: 100, rotateX: 5, scale: 0.9, opacity: 0 },
                {
                    y: 0, rotateX: 0, scale: 1, opacity: 1,
                    ease: "none",
                    scrollTrigger: {
                        trigger: card,
                        start: "top 85%",
                        end: "top 35%",
                        scrub: true
                    }
                }
            );
        });
    }
}
initStyleScoutSection();

// ==========================================================================
// LUSION EXPERIENCE MASTER PINNED SCRUBBED TIMELINE (Lusion.co 1-to-1 Engineering)
// ==========================================================================

const lusionSec = document.getElementById('lusion-experience');
if (lusionSec) {
    // 1. Setup Master Pinned GSAP ScrollTrigger Scrubbed Timeline
    const masterTL = gsap.timeline({
        scrollTrigger: {
            trigger: "#lusion-scroll-track",
            start: "top top",
            end: "bottom bottom",
            scrub: true
        }
    });

    // --- Sequence 1: Hero Text & Particle Recede ---
    masterTL.to(".lusion-hero-content, .lusion-crosshair-grid, .lusion-scroll-indicator", {
        scale: 0.75, opacity: 0, y: -80, duration: 1
    }, 0)
    .to("#lusion-hero-canvas", { scale: 0.5, opacity: 0.1, duration: 1 }, 0);

    // --- Sequence 2: Marquee Stage Slide In, Track & Slide Out ---
    masterTL.to(".lusion-marquee-stage", { y: "0%", opacity: 1, duration: 1 }, 0.8)
    .to(".lusion-marquee-track", { xPercent: -40, duration: 2.5 }, 1.5)
    .to(".lusion-marquee-stage", { y: "-100%", opacity: 0, duration: 1 }, 3.8);

    // --- Sequence 3: Brands Grid Slide In, Stagger Reveal & Slide Out ---
    masterTL.to(".lusion-brands-stage", { y: "0%", opacity: 1, duration: 1 }, 4.5)
    .from(".brand-item", { y: 40, opacity: 0, stagger: 0.05, duration: 1.5 }, 5)
    .to(".lusion-brands-stage", { y: "-100%", opacity: 0, duration: 1 }, 7);

    // --- Sequence 4: Electric Blue Phase Slide In ---
    masterTL.to(".lusion-blue-stage", { y: "0%", duration: 1.5 }, 7.8)
    .from(".lusion-expertise-header", { y: 60, opacity: 0, duration: 1 }, 8.8);

    // --- Sequence 5: CARDS STACK -> OPENING / FANNING OUT -> 3D FLIP ---
    // Cards start stacked centered:
    gsap.set(".lusion-card", { x: 0, rotate: 0, scale: 0.85 });

    // Open/Fan Out Cards Horizontally:
    masterTL.to(".lusion-card.card-1", { x: -410, rotate: -12, scale: 1, duration: 2 }, 9.5)
    .to(".lusion-card.card-2", { x: -140, rotate: -4, scale: 1, duration: 2 }, 9.5)
    .to(".lusion-card.card-3", { x: 140, rotate: 4, scale: 1, duration: 2 }, 9.5)
    .to(".lusion-card.card-4", { x: 410, rotate: 12, scale: 1, duration: 2 }, 9.5);

    // 3D Flip Cards to reveal white front faces as scroll continues:
    masterTL.to(".lusion-card .card-inner-wrap", {
        rotateY: 180, duration: 2, stagger: 0.25, ease: "power2.inOut"
    }, 11.8);

    // Cards Straighten out & Slide up:
    masterTL.to(".lusion-card", { rotate: 0, duration: 1 }, 14)
    .to(".lusion-cards-container, .lusion-expertise-header, .lusion-outline-bg-text", {
        opacity: 0, y: -100, duration: 1.5
    }, 15.2);

    // --- Sequence 6: Interactive Particle CTA Fade In ---
    masterTL.to(".lusion-particle-cta-wrap", {
        opacity: 1, pointerEvents: "auto", duration: 1.5
    }, 16.5)
    .to(".lusion-particle-cta-wrap", { opacity: 0, y: -80, duration: 1 }, 19);

    // --- Sequence 7: Off-White Light Footer Rolls Up ---
    masterTL.to(".lusion-light-footer", { y: "0%", duration: 2, ease: "power3.out" }, 19.8);
}

// 2. High-Performance WebGL Fluid Swarm Particle Engine (Hero Black Screen)
const heroCanvas = document.getElementById('lusion-hero-canvas');
if (heroCanvas && typeof THREE !== 'undefined') {
    const container = heroCanvas.parentElement;
    let width = container.offsetWidth;
    let height = container.offsetHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 4.5;

    const renderer = new THREE.WebGLRenderer({ canvas: heroCanvas, alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    window.addEventListener('resize', () => {
        if (!container) return;
        width = container.offsetWidth;
        height = container.offsetHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });

    const particleCount = 3500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const initialPos = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        // Spawn in fluid sphere/cloud shape
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = Math.cbrt(Math.random()) * 2.2;

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions[i * 3] = initialPos[i * 3] = x;
        positions[i * 3 + 1] = initialPos[i * 3 + 1] = y;
        positions[i * 3 + 2] = initialPos[i * 3 + 2] = z;

        scales[i] = Math.random() * 0.8 + 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uMouse: { value: new THREE.Vector2(-999, -999) }
        },
        vertexShader: `
            uniform float uTime;
            uniform vec2 uMouse;
            attribute float aScale;
            varying float vDepth;
            
            void main() {
                vec3 pos = position;
                
                // Simplex / Curl Noise approximation for fluid swirl motion
                float time = uTime * 0.5;
                pos.x += sin(time + pos.y * 2.5) * 0.18;
                pos.y += cos(time + pos.z * 2.5) * 0.18;
                pos.z += sin(time + pos.x * 2.5) * 0.18;

                // Mouse Repulsion in 3D
                vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
                
                gl_PointSize = (18.0 * aScale) * (1.0 / -mvPos.z);
                gl_Position = projectionMatrix * mvPos;
                vDepth = -mvPos.z;
            }
        `,
        fragmentShader: `
            varying float vDepth;
            
            void main() {
                // Soft Volumetric Glow Circle with Over-exposed Core (Lusion Style)
                vec2 uv = gl_PointCoord - vec2(0.5);
                float dist = length(uv);
                if (dist > 0.5) discard;
                
                float core = smoothstep(0.5, 0.0, dist);
                float glow = pow(core, 2.5);
                
                // Additive over-exposed white core with subtle cyan/silver edge
                vec3 col = mix(vec3(0.85, 0.95, 1.0), vec3(1.0, 1.0, 1.0), glow);
                gl_FragColor = vec4(col, glow * 0.85);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const particlesMesh = new THREE.Points(geometry, material);
    scene.add(particlesMesh);

    let mouse = new THREE.Vector2(-999, -999);
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;
    });

    const clock = new THREE.Clock();
    function animateSwarm() {
        requestAnimationFrame(animateSwarm);
        const elapsedTime = clock.getElapsedTime();
        material.uniforms.uTime.value = elapsedTime;

        // Slow cinematic rotation of entire particle cloud
        particlesMesh.rotation.y = elapsedTime * 0.08;
        particlesMesh.rotation.x = Math.sin(elapsedTime * 0.05) * 0.1;

        renderer.render(scene, camera);
    }
    animateSwarm();
}

// 3. Manual Click Toggle Flip for Cards
const lusionCards = document.querySelectorAll('.lusion-card');
if (lusionCards.length > 0) {
    lusionCards.forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('flipped');
        });
    });
}

// 4. SDF Geometric Shapes Liquid Particle Wave Engine (Blue Screen Stage)
const pFieldCanvas = document.getElementById('lusion-particle-field-canvas');
if (pFieldCanvas) {
    const pfCtx = pFieldCanvas.getContext('2d');
    let pfWidth = pFieldCanvas.width = pFieldCanvas.parentElement.offsetWidth;
    let pfHeight = pFieldCanvas.height = pFieldCanvas.parentElement.offsetHeight;

    window.addEventListener('resize', () => {
        if (!pFieldCanvas.parentElement) return;
        pfWidth = pFieldCanvas.width = pFieldCanvas.parentElement.offsetWidth;
        pfHeight = pFieldCanvas.height = pFieldCanvas.parentElement.offsetHeight;
    });

    const shapeTypes = ['cross', 'square', 'triangle', 'circle', 'diamond'];
    const pFieldNodes = [];
    const rows = 16;
    const cols = 36;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const baseX = (pfWidth / (cols + 1)) * (c + 1);
            // Liquid wave contour layout
            const waveY = (pfHeight * 0.45) + (Math.sin(c * 0.25) * 40) + ((r / rows) * pfHeight * 0.55);
            pFieldNodes.push({
                baseX: baseX,
                baseY: waveY,
                x: baseX,
                y: waveY,
                vx: 0,
                vy: 0,
                shape: shapeTypes[(r * 3 + c * 7) % shapeTypes.length],
                size: Math.random() * 6 + 8,
                alpha: Math.random() * 0.75 + 0.25,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    let pfMouse = { x: -9999, y: -9999, active: false };

    const ctaWrap = pFieldCanvas.parentElement;
    ctaWrap.addEventListener('mousemove', (e) => {
        const rect = ctaWrap.getBoundingClientRect();
        pfMouse.x = e.clientX - rect.left;
        pfMouse.y = e.clientY - rect.top;
        pfMouse.active = true;
    });

    ctaWrap.addEventListener('mouseleave', () => {
        pfMouse.active = false;
    });

    function drawSDFShape(ctx, shape, x, y, size) {
        ctx.beginPath();
        const h = size / 2;

        if (shape === 'cross') {
            ctx.moveTo(x - h, y); ctx.lineTo(x + h, y);
            ctx.moveTo(x, y - h); ctx.lineTo(x, y + h);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            return;
        } else if (shape === 'square') {
            ctx.rect(x - h / 2, y - h / 2, h, h);
        } else if (shape === 'triangle') {
            ctx.moveTo(x, y - h);
            ctx.lineTo(x + h, y + h);
            ctx.lineTo(x - h, y + h);
            ctx.closePath();
        } else if (shape === 'circle') {
            ctx.arc(x, y, h / 2.2, 0, Math.PI * 2);
        } else if (shape === 'diamond') {
            ctx.moveTo(x, y - h);
            ctx.lineTo(x + h, y);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x - h, y);
            ctx.closePath();
        }

        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    let globalTime = 0;

    function drawLiquidParticleWave() {
        pfCtx.clearRect(0, 0, pfWidth, pfHeight);
        globalTime += 0.03;

        const radius = 160;
        const forceFactor = 18;
        const spring = 0.07;
        const friction = 0.80;

        pFieldNodes.forEach(node => {
            // Continuous Liquid Wave Ripple dynamics
            const waveOffset = Math.sin(globalTime * 1.5 + node.baseX * 0.01 + node.phase) * 6;
            const targetY = node.baseY + waveOffset;

            if (pfMouse.active) {
                const dx = node.x - pfMouse.x;
                const dy = node.y - pfMouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < radius && dist > 0) {
                    const force = (1 - dist / radius) * forceFactor;
                    node.vx += (dx / dist) * force;
                    node.vy += (dy / dist) * force;
                }
            }

            // Spring return to origin
            node.vx += (node.baseX - node.x) * spring;
            node.vy += (targetY - node.y) * spring;

            node.vx *= friction;
            node.vy *= friction;

            node.x += node.vx;
            node.y += node.vy;

            pfCtx.globalAlpha = node.alpha;
            drawSDFShape(pfCtx, node.shape, node.x, node.y, node.size);
        });

        pfCtx.globalAlpha = 1.0;
        requestAnimationFrame(drawLiquidParticleWave);
    }
    drawLiquidParticleWave();
}

// ==========================================================================
// ADVANCED MODULAR TEXT ANIMATION ENGINE (Lusion.co Specification)
// ==========================================================================
function initAdvancedTextAnimations() {
    const textElements = document.querySelectorAll('[data-text-anim]');

    textElements.forEach(el => {
        const animType = el.getAttribute('data-text-anim');
        const text = el.innerText.trim();
        if (!text) return;
        el.innerHTML = ''; // Clear original content

        // 1. Split Logic based on animation type
        if (animType === 'flip-3d' || animType === 'skew-slide') {
            text.split('').forEach(char => {
                if (char === ' ') {
                    el.innerHTML += `<span class="char-mask" style="width: 0.3em; display: inline-block;">&nbsp;</span>`;
                } else {
                    el.innerHTML += `<span class="word-wrap"><span class="char-inner">${char}</span></span>`;
                }
            });
        } else if (animType === 'blur-fade') {
            text.split(' ').forEach(word => {
                el.innerHTML += `<span class="word-wrap"><span class="word-inner">${word}</span></span>&nbsp;`;
            });
        }

        // 2. GSAP ScrollTrigger Animation Logic
        const targets = el.querySelectorAll('.char-inner, .word-inner');
        if (!targets.length) return;

        let toVars = {
            duration: 1.2,
            stagger: 0.03,
            scrollTrigger: {
                trigger: el,
                start: "top 92%",
                toggleActions: "play none none none"
            }
        };

        switch (animType) {
            case 'flip-3d':
                gsap.set(targets, { transformOrigin: "50% 100%", rotationX: -90, y: 40, opacity: 0 });
                toVars.rotationX = 0;
                toVars.y = 0;
                toVars.opacity = 1;
                toVars.ease = "back.out(1.7)";
                break;

            case 'skew-slide':
                gsap.set(targets, { y: "120%", skewY: 15, opacity: 0 });
                toVars.y = "0%";
                toVars.skewY = 0;
                toVars.opacity = 1;
                toVars.ease = "expo.out";
                break;

            case 'blur-fade':
                gsap.set(targets, { filter: "blur(12px)", opacity: 0, y: 20 });
                toVars.filter = "blur(0px)";
                toVars.opacity = 1;
                toVars.y = 0;
                toVars.stagger = 0.05;
                toVars.ease = "power3.out";
                break;
        }

        gsap.to(targets, toVars);
    });
}

// Initialize the Modular Text Animation System
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initAdvancedTextAnimations();
        ScrollTrigger.sort();
        ScrollTrigger.refresh();
    });
} else {
    initAdvancedTextAnimations();
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
}
