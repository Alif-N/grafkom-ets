// Inisialisasi scene, kamera, dan renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Setup renderer
const canvasContainer = document.getElementById('canvas-container');
renderer.setSize(canvasContainer.offsetWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
canvasContainer.appendChild(renderer.domElement);

// Kontrol kamera dengan mouse
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = false;

// Posisi kamera
camera.position.set(0, 1.5, 5);
camera.lookAt(0, 1, 0);

// Setup pencahayaan
const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
scene.add(directionalLight);

// Variabel untuk karakter dan animasi
let character = null;
let mixer = null;
let animations = {};
let animationClips = {};
let currentAnimation = null;
let previousAnimation = null;
let clock = new THREE.Clock();

// Setup TextureLoader
const textureLoader = new THREE.TextureLoader();

// Memuat tekstur untuk langit dan ground
const skyTexture = textureLoader.load('sky.jpg', () => {
    scene.background = skyTexture;
});

const groundTexture = textureLoader.load('grass.jpg');
groundTexture.wrapS = THREE.RepeatWrapping;
groundTexture.wrapT = THREE.RepeatWrapping;
groundTexture.repeat.set(4, 4);

// Membuat ground plane dengan tekstur
const groundGeometry = new THREE.PlaneGeometry(60, 60);
const groundMaterial = new THREE.MeshLambertMaterial({
    map: groundTexture,
    transparent: true,
    opacity: 0.95
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

// Setup FBXLoader
const fbxLoader = new THREE.FBXLoader();

// Array untuk melacak status pemuatan
const loadingPromises = [];

// Fungsi untuk memuat model dan animasi secara asinkron
function loadFBX(name, file) {
    return new Promise((resolve, reject) => {
        fbxLoader.load(file, (fbx) => {
            if (name === 'idle') {
                setupCharacter(fbx);
            }
            if (fbx.animations && fbx.animations.length > 0) {
                animationClips[name] = fbx.animations[0];
                console.log(`Loaded animation: ${name}`);
            } else {
                console.warn(`No animation found in ${file}`);
            }
            resolve();
        }, undefined, (err) => {
            console.error(`Error loading ${file}:`, err);
            reject(err);
        });
    });
}

// Setup karakter utama
function setupCharacter(fbx) {
    character = fbx;
    character.scale.set(0.01, 0.01, 0.01);
    character.position.set(0, 0, 0);
    character.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    mixer = new THREE.AnimationMixer(character);
    scene.add(character);
}

// Memuat semua model dan setup animasi
// HANYA memuat idle dan walk
const modelsToLoad = [
    { name: 'idle', file: 'Idle.fbx' },
    { name: 'walk', file: 'Walking.fbx' }
];

modelsToLoad.forEach(model => {
    loadingPromises.push(loadFBX(model.name, model.file));
});

Promise.all(loadingPromises)
    .then(() => {
        console.log('All models and animations loaded.');
        setupAnimations();
    })
    .catch(err => {
        console.error('Failed to load one or more models:', err);
    });

// Setup animasi setelah semua model diload
function setupAnimations() {
    if (!mixer) {
        return;
    }
    Object.keys(animationClips).forEach(name => {
        const clip = animationClips[name];
        if (clip) {
            animations[name] = mixer.clipAction(clip);
            animations[name].setLoop(THREE.LoopRepeat);
            animations[name].setEffectiveWeight(1.0);
        }
    });
    if (animations.idle) {
        currentAnimation = animations.idle;
        currentAnimation.play();
    }
}

// Event listeners untuk tombol kontrol
document.getElementById('animIdle').addEventListener('click', () => {
    playAnimation('idle');
    updateActiveButton('animIdle');
});

document.getElementById('animWalk').addEventListener('click', () => {
    playAnimation('walk');
    updateActiveButton('animWalk');
});

// Fungsi animasi dengan crossfade blending
const crossFadeDuration = 0.3;
function playAnimation(name) {
    if (!animations[name]) {
        console.warn(`Animation ${name} not loaded`);
        return;
    }
    if (currentAnimation === animations[name]) {
        return;
    }
    previousAnimation = currentAnimation;
    currentAnimation = animations[name];
    currentAnimation.reset();
    currentAnimation.setEffectiveTimeScale(1.0);
    currentAnimation.play();
    if (previousAnimation && previousAnimation !== currentAnimation) {
        previousAnimation.crossFadeTo(currentAnimation, crossFadeDuration, true);
    } else {
        currentAnimation.fadeIn(crossFadeDuration);
    }
}

function updateActiveButton(activeId) {
    document.querySelectorAll('.btn-group-vertical button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(activeId).classList.add('active');
}

// Fungsi animasi utama
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) {
        mixer.update(delta);
    }
    controls.update();
    renderer.render(scene, camera);
}

// Menangani perubahan ukuran jendela
window.addEventListener('resize', () => {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.offsetWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.offsetWidth, window.innerHeight);
});

// Memulai animasi
animate();