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

// Posisi kamera awal
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
const walkSpeed = 1;
const runSpeed = 3;
const rotationSpeed = 1.5;

// Objek untuk melacak status tombol keyboard
const keyboard = {
    w: false,
    a: false,
    s: false,
    d: false,
    r: false,
    v: false
};
let cameraMode = 'thirdPerson';

// Setup TextureLoader
const textureLoader = new THREE.TextureLoader();

// Memuat tekstur Pokeball untuk marmer
const pokeballTexture = textureLoader.load('textures/pokeball.png'); // Pastikan file pokeball.jpg tersedia

// Memuat tekstur untuk langit dan ground
const skyTexture = textureLoader.load('textures/sky.jpg', () => {
    scene.background = skyTexture;
});

const groundTexture = textureLoader.load('textures/grass.jpg');
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
const modelsToLoad = [
    { name: 'idle', file: 'models/Idle.fbx' },
    { name: 'walk', file: 'models/Walking.fbx' },
    { name: 'run', file: 'models/Running.fbx' }
];

modelsToLoad.forEach(model => {
    loadingPromises.push(loadFBX(model.name, model.file));
});

Promise.all(loadingPromises)
    .then(() => {
        console.log('All models and animations loaded.');
        setupAnimations();
        createFloatingMarbles(); // Panggil fungsi untuk membuat marmer
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

// Event listener untuk tombol keyboard
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keyboard.hasOwnProperty(key)) {
        keyboard[key] = true;
    }
    if (key === 'v') {
        cameraMode = cameraMode === 'thirdPerson' ? 'firstPerson' : 'thirdPerson';
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keyboard.hasOwnProperty(key)) {
        keyboard[key] = false;
    }
});

// Array untuk menyimpan objek marmer
const marbles = [];

// Fungsi untuk membuat 5 marmer dengan tekstur Pokeball
function createFloatingMarbles() {
    const marbleGeometry = new THREE.SphereGeometry(0.8, 32, 32); // Ukuran marmer

    for (let i = 0; i < 5; i++) {
        const marbleMaterial = new THREE.MeshPhysicalMaterial({
            map: pokeballTexture,
            roughness: 0.2,
            metalness: 0.1,
            clearcoat: 1,
            clearcoatRoughness: 0.2
        });

        const marble = new THREE.Mesh(marbleGeometry, marbleMaterial);

        // Atur posisi acak di dalam area ground
        const groundSize = 60;
        marble.position.x = (Math.random() - 0.5) * groundSize;
        marble.position.z = (Math.random() - 0.5) * groundSize;
        marble.position.y = 1; // Ketinggian awal

        marble.castShadow = true;
        scene.add(marble);
        marbles.push(marble);
    }
}

// Fungsi animasi utama
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (character) {
        const hasMovement = keyboard.w || keyboard.r || keyboard.a || keyboard.d;

        // Logika pergerakan karakter
        let currentSpeed = 0;
        if (keyboard.w) {
            currentSpeed = walkSpeed;
            playAnimation('walk');
        } else if (keyboard.r) {
            currentSpeed = runSpeed;
            playAnimation('run');
        }

        if (currentSpeed > 0) {
            const direction = new THREE.Vector3(0, 0, 1);
            direction.applyQuaternion(character.quaternion);
            character.position.addScaledVector(direction, currentSpeed * delta);
        }

        if (keyboard.a) {
            character.rotation.y += rotationSpeed * delta;
        }

        if (keyboard.d) {
            character.rotation.y -= rotationSpeed * delta;
        }

        if (!hasMovement && currentAnimation !== animations.idle) {
            playAnimation('idle');
        }

        // Logika pergerakan kamera
        const cameraTargetPosition = new THREE.Vector3();
        if (cameraMode === 'thirdPerson') {
            const cameraOffset = new THREE.Vector3(0, 2, 5);
            cameraTargetPosition.copy(character.position).add(cameraOffset.applyQuaternion(character.quaternion));
        } else {
            const cameraOffset = new THREE.Vector3(0, 2, -5);
            cameraTargetPosition.copy(character.position).add(cameraOffset.applyQuaternion(character.quaternion));
        }

        camera.position.lerp(cameraTargetPosition, 0.1);
        camera.lookAt(character.position);
    }

    // Gerakkan marmer agar mengambang
    const time = clock.getElapsedTime();
    marbles.forEach((marble, index) => {
        // Gunakan sin(w*t + φ) untuk pergerakan halus, dengan φ (fase) unik untuk setiap marmer
        const phase = index * Math.PI / 2.5;
        const heightOffset = Math.sin(time + phase) * 0.5; // Ketinggian maksimum 0.5
        marble.position.y = 1 + heightOffset;
    });

    if (mixer) {
        mixer.update(delta);
    }

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