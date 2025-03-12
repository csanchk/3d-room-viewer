class RoomViewer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.selectedObject = null;
        this.moveMode = false;

        this.init();
        this.createRoom();
        this.setupLights();
        this.setupControls();
        this.animate();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('scene-container').appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(0, 5, 10);

        // Setup window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    createRoom() {
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(10, 10);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Walls
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        
        // Back wall
        const backWall = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 5),
            wallMaterial
        );
        backWall.position.z = -5;
        backWall.position.y = 2.5;
        this.scene.add(backWall);

        // Side walls
        const leftWall = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 5),
            wallMaterial
        );
        leftWall.position.x = -5;
        leftWall.position.y = 2.5;
        leftWall.rotation.y = Math.PI / 2;
        this.scene.add(leftWall);

        const rightWall = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 5),
            wallMaterial
        );
        rightWall.position.x = 5;
        rightWall.position.y = 2.5;
        rightWall.rotation.y = -Math.PI / 2;
        this.scene.add(rightWall);
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    setupControls() {
        // Orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        // File upload
        document.getElementById('modelUpload').addEventListener('change', (e) => this.handleFileUpload(e));

        // Move mode
        document.getElementById('toggleMove').addEventListener('click', () => this.toggleMoveMode());

        // Click handling
        this.renderer.domElement.addEventListener('click', (e) => this.handleClick(e));
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const loader = new GLTFLoader();
        const url = URL.createObjectURL(file);

        loader.load(url, (gltf) => {
            const model = gltf.scene;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            model.position.set(0, 0, 0);
            this.scene.add(model);
            this.selectedObject = model;

            URL.revokeObjectURL(url);
        }, undefined, (error) => {
            console.error('Error loading model:', error);
        });
    }

    toggleMoveMode() {
        this.moveMode = !this.moveMode;
        this.controls.enabled = !this.moveMode;
        document.getElementById('toggleMove').style.backgroundColor = 
            this.moveMode ? '#ff4444' : '#4CAF50';
    }

    handleClick(event) {
        if (!this.moveMode || !this.selectedObject) return;

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObjects(this.scene.children);

        for (let intersect of intersects) {
            if (intersect.object.geometry instanceof THREE.PlaneGeometry) {
                const point = intersect.point;
                this.selectedObject.position.x = point.x;
                this.selectedObject.position.z = point.z;
                break;
            }
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the application
window.addEventListener('load', () => {
    new RoomViewer();
});
