class RoomViewer {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0); // Light gray background
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
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('scene-ne-container').appendChild(this.renderer.domElement);

        // Position camera for better view
        this.camera.position.set(8, 8, 8);
        this.camera.lookAt(0, 0, 0);
    }

    createRoom() {
        // Floor - make it lighter gray
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xaaaaaa, // Lighter gray
            side: THREE.DoubleSide
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Walls - make them white
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff  // White
        });
        
        // Back wall
        const backWall = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 10),
            wallMaterial
        );
        backWall.position.z = -10;
        backWall.position.y = 5;
        backWall.receiveShadow = true;
        this.scene.add(backWall);

        // Side walls
        const leftWall = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 10),
            wallMaterial
        );
        leftWall.position.x = -10;
        leftWall.position.y = 5;
        leftWall.rotation.y = Math.PI / 2;
        leftWall.receiveShadow = true;
        this.scene.add(leftWall);

        const rightWall = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 10),
            wallMaterial
        );
        rightWall.position.x = 10;
        rightWall.position.y = 5;
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.receiveShadow = true;
        this.scene.add(rightWall);
    }

    setupLights() {
        // Brighter ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(10, 10, 10);
        mainLight.castShadow = true;
        this.scene.add(mainLight);

        // Additional light for better visibility
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(-10, 5, -10);
        this.scene.add(fillLight);
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.maxPolarAngle = Math.PI / 2;

        document.getElementById('modelUpload').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('toggleMove').addEventListener('click', () => this.toggleMoveMode());
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
    console.log("Starting Room Viewer");
    new RoomViewer();
});
