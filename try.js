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
renderer.toneMappingExposure = 1.2;
canvasContainer.appendChild(renderer.domElement);

// Posisi kamera awal
camera.position.set(0, 1.5, 5);
camera.lookAt(0, 1, 0);

// Setup pencahayaan
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.far = 50;
scene.add(directionalLight);

// Point light untuk efek glow yang lebih baik
const pointLight = new THREE.PointLight(0xff6b35, 0.3, 100);
pointLight.position.set(10, 5, 10);
scene.add(pointLight);

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
    shift: false,
    space: false
};
let cameraMode = 'thirdPerson';

// Variabel untuk jump
let isJumping = false;
let velocityY = 0;
const gravity = 16;
const jumpForce = 8;
const groundLevel = 0;

// Setup TextureLoader
const textureLoader = new THREE.TextureLoader();

// Memuat tekstur Pokeball untuk marmer
const pokeballTexture = textureLoader.load('textures/pokeball.png');

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

// Variabel untuk menyimpan pohon dan bounding box-nya
const trees = [];
const treeBoxes = [];
let characterBox = new THREE.Box3();

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
        createFloatingMarbles();
        createEnvironmentObjects();
        createRandomTrees();
        loadCollectedPokemon();
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

    if (key === ' ') {
        e.preventDefault();
        keyboard.space = true;
    }
    if (key === 'shift') {
        keyboard.shift = true;
    }
    if (key === 'v') {
        cameraMode = cameraMode === 'thirdPerson' ? 'firstPerson' : 'thirdPerson';
    }
    if (key === 'w') {
        keyboard.w = true;
    }
    if (key === 'a') {
        keyboard.a = true;
    }
    if (key === 'd') {
        keyboard.d = true;
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();

    if (key === ' ') {
        e.preventDefault();
        keyboard.space = false;
    }
    if (key === 'shift') {
        keyboard.shift = false;
    }
    if (key === 'w') {
        keyboard.w = false;
    }
    if (key === 'a') {
        keyboard.a = false;
    }
    if (key === 'd') {
        keyboard.d = false;
    }
});

// Array untuk menyimpan objek marmer
const marbles = [];
const marbleRadius = 0.8;
const collisionDistance = 1.5;
const collectedMarbles = new Set();

// Batas ground untuk membatasi pergerakan karakter
const groundBoundary = {
    minX: -30,
    maxX: 30,
    minZ: -30,
    maxZ: 30
};

// Data Pokémon untuk popup card
const pokemonData = [
    { name: 'Pikachu', type: 'Electric', color: '#FFD700' },
    { name: 'Squirtle', type: 'Water', color: '#4A90E2' },
    { name: 'Bulbasaur', type: 'Grass', color: '#7CB342' },
    { name: 'Charmander', type: 'Fire', color: '#FF6B35' },
    { name: 'Meowth', type: 'Normal', color: '#B8860B' }
];

// Elemen UI untuk menampilkan daftar Pokémon
// const pokemonListContainer = document.createElement('div');
// pokemonListContainer.id = 'pokemon-list-container';
// pokemonListContainer.style.cssText = `
//     position: fixed;
//     top: 10px;
//     right: 10px;
//     padding: 15px;
//     background: rgba(0, 0, 0, 0.7);
//     color: white;
//     border-radius: 10px;
//     font-family: sans-serif;
//     max-height: 90vh;
//     overflow-y: auto;
//     z-index: 999;
//     min-width: 200px;
// `;
// document.body.appendChild(pokemonListContainer);

// Fungsi untuk menyimpan data ke localStorage
function saveCollectedPokemon(pokemonName) {
    if (!collectedPokemonNames.includes(pokemonName)) {
        collectedPokemonNames.push(pokemonName);
        localStorage.setItem('collectedPokemon', JSON.stringify(collectedPokemonNames));
        updatePokemonListUI();
    }
}

// Fungsi untuk memuat data dari localStorage saat aplikasi dimulai
function loadCollectedPokemon() {
    const storedData = localStorage.getItem('collectedPokemon');
    if (storedData) {
        collectedPokemonNames = JSON.parse(storedData);
    }
    updatePokemonListUI();
}

// Fungsi untuk mengupdate tampilan daftar Pokémon di UI
function updatePokemonListUI() {
    // Ambil elemen dari HTML
    const pokemonListContainer = document.getElementById('pokemon-list-container');
    
    if (!pokemonListContainer) return; // Keluar jika elemen tidak ditemukan

    let html = '<h3 style="font-size: 1.25rem; margin: 0 0 10px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #333;"><i class="fas fa-box-open me-2"></i>Caught Pokémon 🐾</h3>';
    
    if (collectedPokemonNames.length === 0) {
        html += '<p style="color: #999; margin: 0; font-style: italic;">None yet! Go catch some!</p>';
    } else {
        html += '<ul style="list-style-type: none; padding: 0; margin: 0;">';
        collectedPokemonNames.forEach(name => {
            const pokemon = pokemonData.find(p => p.name === name);
            const color = pokemon ? pokemon.color : '#FFFFFF';
            html += `<li style="padding: 8px 0; border-bottom: 1px dotted #eee; display: flex; align-items: center; font-weight: 500;">
                        <span style="display: inline-block; width: 12px; height: 12px; background-color: ${color}; border-radius: 50%; margin-right: 10px; box-shadow: 0 0 5px ${color};"></span>
                        ${name}
                    </li>`;
        });
        html += '</ul>';
    }
    
    // Hitung total dan tampilkan
    const totalHtml = `<p style="margin-top: 10px; font-weight: bold; border-top: 1px solid #ddd; padding-top: 5px;">Total: ${collectedPokemonNames.length}/${pokemonData.length}</p>`;
    html += totalHtml;
    
    pokemonListContainer.innerHTML = html;
}

// Fungsi untuk membuat lingkungan objek dekoratif dengan emissive glow
function createEnvironmentObjects() {
    const pillarPositions = [
        { x: -20, z: -20 }, { x: 20, z: -20 },
        { x: -20, z: 20 }, { x: 20, z: 20 }
    ];

    pillarPositions.forEach(pos => {
        const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.5, 8, 32);
        const pillarMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            emissive: 0x00ff88,
            emissiveIntensity: 0.6,
            metalness: 0.5,
            roughness: 0.4
        });
        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillar.position.set(pos.x, 4, pos.z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        scene.add(pillar);

        const pillarLight = new THREE.PointLight(0x00ff88, 0.4, 30);
        pillarLight.position.set(pos.x, 8, pos.z);
        scene.add(pillarLight);
    });

    for (let i = 0; i < 6; i++) {
        const crystalGeometry = new THREE.OctahedronGeometry(0.6, 2);
        const crystalColors = [0xff0088, 0x00ffff, 0xffff00, 0x00ff00, 0xff8800, 0xff0000];
        const crystalMaterial = new THREE.MeshStandardMaterial({
            color: crystalColors[i],
            emissive: crystalColors[i],
            emissiveIntensity: 0.8,
            metalness: 0.8,
            roughness: 0.2
        });
        const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);

        const angle = (i / 6) * Math.PI * 2;
        const radius = 25;
        crystal.position.set(
            Math.cos(angle) * radius,
            5 + Math.sin(Date.now() * 0.0005 + i) * 2,
            Math.sin(angle) * radius
        );
        crystal.castShadow = true;
        scene.add(crystal);

        if (!scene.userData.crystals) {
            scene.userData.crystals = [];
        }
        scene.userData.crystals.push({ mesh: crystal, angle: angle, radius: radius, index: i });
    }
}

// Fungsi untuk membuat 5 marmer dengan tekstur Pokeball dan emissive effect
function createFloatingMarbles() {
    const marbleGeometry = new THREE.SphereGeometry(marbleRadius, 32, 32);

    for (let i = 0; i < 5; i++) {

        const pokemonName = pokemonData[i].name; // Dapatkan nama Pokémon berdasarkan indeks
        
        // Cek apakah Pokémon ini sudah dikumpulkan
        if (collectedPokemonNames.includes(pokemonName)) {
            continue; // Lewati pembuatan marmer jika Pokémon sudah dikumpulkan
        }

        const marbleMaterial = new THREE.MeshPhysicalMaterial({
            map: pokeballTexture,
            roughness: 0.2,
            metalness: 0.1,
            clearcoat: 1,
            clearcoatRoughness: 0.2,
            emissive: 0xffffff,
            emissiveIntensity: 0.3
        });

        const marble = new THREE.Mesh(marbleGeometry, marbleMaterial);

        const groundSize = 60;
        marble.position.x = (Math.random() - 0.5) * groundSize;
        marble.position.z = (Math.random() - 0.5) * groundSize;
        marble.position.y = 1;

        marble.castShadow = true;
        marble.userData.index = i;
        marble.userData.collected = false;
        scene.add(marble);
        marbles.push(marble);

        const marbleLight = new THREE.PointLight(0xffffff, 0.2, 10);
        marbleLight.position.copy(marble.position);
        scene.add(marbleLight);
        marble.userData.light = marbleLight;
    }
}

// Tambahkan loader tekstur daun dan batang
const leafTexture = textureLoader.load('textures/leaf.png');
const branchTexture = textureLoader.load('textures/leaf.png');

// Fungsi untuk membuat dan menempatkan pohon secara acak
function createRandomTrees() {
    const treeCount = 20;
    const groundSize = 60;

    function setupTree(tree) {
        tree.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.material) {
                    if (child.name.toLowerCase().includes('leaf') || child.material.name.toLowerCase().includes('leaf')) {
                        child.material.map = leafTexture;
                        child.material.transparent = true;
                        child.material.opacity = 0.95;
                    } else if (child.name.toLowerCase().includes('branch') || child.material.name.toLowerCase().includes('branch')) {
                        child.material.map = branchTexture;
                    }
                    child.material.emissiveIntensity = 0.1;
                    child.material.needsUpdate = true;
                }
            }
        });
        scene.add(tree);
        trees.push(tree);
    }

    fbxLoader.load('models/Tree.fbx', (fbx) => {
        for (let i = 0; i < treeCount; i++) {
            const treeClone = fbx.clone();
            treeClone.scale.set(0.01, 0.01, 0.01);

            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 50) {
                const x = (Math.random() - 0.5) * groundSize * 0.8;
                const z = (Math.random() - 0.5) * groundSize * 0.8;
                treeClone.position.set(x, 0, z);

                if (new THREE.Vector3(x, 0, z).distanceTo(character.position) > 5) {
                    placed = true;
                }
                attempts++;
            }
            if (placed) {
                setupTree(treeClone);
                const treeBox = new THREE.Box3().setFromObject(treeClone);
                treeBoxes.push(treeBox);
            }
        }
        console.log(`${trees.length} trees placed.`);
    });
}

// Fungsi untuk menampilkan popup card
function showPopupCard(marbleIndex) {
    const pokemon = pokemonData[marbleIndex];

    let existingCard = document.getElementById(`card-${marbleIndex}`);
    if (existingCard) return;

    const card = document.createElement('div');
    card.id = `card-${marbleIndex}`;
    card.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0);
        background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,248,255,0.90) 100%);
        border: 2px solid rgba(100,100,100,0.3);
        border-radius: 15px;
        padding: 30px;
        min-width: 300px;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 0 30px rgba(0,0,0,0.1);
        z-index: 1000;
        backdrop-filter: blur(10px);
        animation: popCardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    `;

    card.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 10px; color: #666;">✨ Pokémon Caught! ✨</div>
        <div style="font-size: 36px; font-weight: bold; color: #333; margin: 15px 0;">${pokemon.name}</div>
        <div style="font-size: 18px; color: #888; margin-bottom: 20px; background: rgba(0,0,0,0.05); padding: 8px 12px; border-radius: 6px;">[${pokemon.type}]</div>
        <button onclick="this.parentElement.style.animation='popCardOut 0.5s ease-in forwards'; setTimeout(() => this.parentElement.remove(), 500)" 
                style="background: linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 100%); color: #333; border: 1px solid #ccc; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.3s ease;">
            Close
        </button>
    `;

    document.body.appendChild(card);

    const style = document.createElement('style');
    style.textContent = `
        @keyframes popCardIn {
            0% {
                transform: translate(-50%, -50%) scale(0) rotateY(90deg);
                opacity: 0;
            }
            50% {
                transform: translate(-50%, -50%) scale(1.05) rotateY(0deg);
            }
            100% {
                transform: translate(-50%, -50%) scale(1) rotateY(0deg);
                opacity: 1;
            }
        }
        @keyframes popCardOut {
            0% {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
            100% {
                transform: translate(-50%, -50%) scale(0) rotateY(90deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        if (card.parentElement) {
            card.style.animation = 'popCardOut 0.5s ease-in forwards';
            setTimeout(() => card.remove(), 500);
        }
    }, 4000);
}

// Fungsi untuk mendeteksi collision
function checkCollisions() {
    if (!character) return;

    // Filter marmer yang belum dikumpulkan sebelum iterasi
    marbles.filter(m => !m.userData.collected).forEach((marble) => { 
        const distance = character.position.distanceTo(marble.position);

        if (distance < collisionDistance) {
            marble.userData.collected = true;

            scene.remove(marble);
            if (marble.userData.light) {
                scene.remove(marble.userData.light);
            }

            const pokemonName = pokemonData[marble.userData.index].name;
            saveCollectedPokemon(pokemonName); // <-- SIMPAN KE LOCAL STORAGE
            
            showPopupCard(marble.userData.index);

            marble.scale.set(0, 0, 0);
        }
    });
}

// Fungsi untuk mendeteksi apakah karakter berada di tanah
function isCharacterOnGround() {
    return character.position.y <= groundLevel;
}

// Fungsi untuk menangani jump
function handleJump() {
    if (keyboard.space && isCharacterOnGround()) {
        velocityY = jumpForce;
        isJumping = true;
    }
}

// Fungsi untuk update fisika jump
function updateJumpPhysics(delta) {
    if (!character) return;

    if (isJumping || character.position.y > groundLevel) {
        velocityY -= gravity * delta;
        character.position.y += velocityY * delta;

        if (character.position.y <= groundLevel) {
            character.position.y = groundLevel;
            velocityY = 0;
            isJumping = false;
        }
    }
}

// Fungsi animasi utama
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (character) {
        let currentSpeed = 0;

        if (keyboard.w && keyboard.shift) {
            currentSpeed = runSpeed;
            playAnimation('run');
        } else if (keyboard.w) {
            currentSpeed = walkSpeed;
            playAnimation('walk');
        }

        const hasMovement = keyboard.w || keyboard.a || keyboard.d;
        const previousPosition = character.position.clone();

        // Gerakan maju/mundur
        if (currentSpeed > 0) {
            const direction = new THREE.Vector3(0, 0, 1);
            direction.applyQuaternion(character.quaternion);
            const newPosition = character.position.clone().addScaledVector(direction, currentSpeed * delta);

            if (newPosition.x > groundBoundary.minX && newPosition.x < groundBoundary.maxX &&
                newPosition.z > groundBoundary.minZ && newPosition.z < groundBoundary.maxZ) {
                character.position.copy(newPosition);
            }
        }

        // Rotasi kiri/kanan
        if (keyboard.a) {
            character.rotation.y += rotationSpeed * delta;
        }

        if (keyboard.d) {
            character.rotation.y -= rotationSpeed * delta;
        }

        // Handle jump
        handleJump();
        updateJumpPhysics(delta);

        // Update bounding box karakter
        characterBox.setFromObject(character);

        // Cek tabrakan dengan pohon
        let hasCollided = false;
        for (const box of treeBoxes) {
            if (characterBox.intersectsBox(box)) {
                hasCollided = true;
                break;
            }
        }

        // Jika terjadi tabrakan, kembalikan posisi karakter ke posisi sebelumnya
        if (hasCollided) {
            character.position.copy(previousPosition);
        }

        // Animasi idle
        if (!hasMovement && !isJumping && currentAnimation !== animations.idle) {
            playAnimation('idle');
        }

        checkCollisions();

        // Update camera position
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

    // Animasi marmer mengambang
    const time = clock.getElapsedTime();
    marbles.forEach((marble, index) => {
        if (!marble.userData.collected) {
            const phase = index * Math.PI / 2.5;
            const heightOffset = Math.sin(time + phase) * 0.5;
            marble.position.y = 1 + heightOffset;

            if (marble.userData.light) {
                marble.userData.light.position.copy(marble.position);
            }

            marble.rotation.x += 0.005;
            marble.rotation.y += 0.008;
        }
    });

    // Animasi kristal
    if (scene.userData.crystals) {
        scene.userData.crystals.forEach(crystal => {
            const bobOffset = Math.sin(time + crystal.index) * 2;
            crystal.mesh.position.y = 5 + bobOffset;
            crystal.mesh.rotation.x += 0.01;
            crystal.mesh.rotation.y += 0.015;
            crystal.mesh.rotation.z += 0.008;
        });
    }

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