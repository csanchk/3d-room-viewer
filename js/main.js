document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('#scene-container')) {
        return;
    }

    const checkDependencies = () => {
        if (typeof THREE === 'undefined') {
            console.error('Three.js not loaded');
            return false;
        }
        if (typeof THREE.OrbitControls === 'undefined' || typeof THREE.TransformControls === 'undefined') {
            console.error('Controls not loaded');
            return false;
        }
        if (typeof THREE.GLTFLoader === 'undefined') {
            console.error('GLTFLoader not loaded');
            return false;
        }
        return true;
    };

    class RoomViewer {
        constructor() {
            this.init();
            this.setupScene();
            this.createRoom();
            this.setupLights();
            this.setupControls();
            this.setupEventListeners();
            this.objects = new Map(); // Store all loaded objects
            this.selectedObject = null;
            this.transformMode = 'translate'; // 'translate', 'rotate', or 'scale'
            this.animate();

            // Add keyboard shortcuts
            window.addEventListener('keydown', (event) => {
                switch(event.key.toLowerCase()) {
                    case 'g':
                        this.setTransformMode('translate');
                        break;
                    case 'r':
                        this.setTransformMode('rotate');
                        break;
                    case 's':
                        this.setTransformMode('scale');
                        break;
                }
            });
        }

        init() {
            const container = document.querySelector('#scene-container');
            if (!container) {
                console.error('Could not find scene-container');
                return;
            }

            // Scene setup
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0xc0e0ff);

            // Camera setup
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            this.camera.position.set(8, 5, 8);
            this.camera.lookAt(0, 0, 0);

            // Renderer setup
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(this.renderer.domElement);
        }
        setupScene() {
            // Orbit controls
            this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.orbitControls.enableDamping = true;
            this.orbitControls.dampingFactor = 0.05;

            // Transform controls
            this.transformControls = new THREE.TransformControls(this.camera, this.renderer.domElement);
            this.scene.add(this.transformControls);

            // Transform controls events
            this.transformControls.addEventListener('dragging-changed', (event) => {
                this.orbitControls.enabled = !event.value;
            });
        }

        createRoom() {
            // Floor
            const floorGeometry = new THREE.PlaneGeometry(20, 20);
            const floorMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x808080,
                side: THREE.DoubleSide
            });
            this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
            this.floor.rotation.x = -Math.PI / 2;
            this.floor.receiveShadow = true;
            this.scene.add(this.floor);

            // Walls
            const wallMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xe0e0e0
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
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);

            const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
            mainLight.position.set(5, 10, 5);
            mainLight.castShadow = true;
            mainLight.shadow.mapSize.width = 1024;
            mainLight.shadow.mapSize.height = 1024;
            mainLight.shadow.camera.near = 0.5;
            mainLight.shadow.camera.far = 50;
            this.scene.add(mainLight);

            const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
            fillLight.position.set(-5, 5, -5);
            this.scene.add(fillLight);
        }
        setupControls() {
            // Setup mode buttons
            document.getElementById('translateMode')?.addEventListener('click', () => this.setTransformMode('translate'));
            document.getElementById('rotateMode')?.addEventListener('click', () => this.setTransformMode('rotate'));
            document.getElementById('scaleMode')?.addEventListener('click', () => this.setTransformMode('scale'));
            document.getElementById('lockObject')?.addEventListener('click', () => this.lockSelectedObject());
            document.getElementById('deleteObject')?.addEventListener('click', () => this.deleteSelectedObject());
            
            // File upload - Fixed binding
            const uploadElement = document.getElementById('modelUpload');
            if (uploadElement) {
                uploadElement.addEventListener('change', (e) => this.handleFileUpload(e));
            }
        }

        handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
        
            console.log('Loading file:', file.name);
        
            const loader = new THREE.GLTFLoader();
            const url = URL.createObjectURL(file);
        
            loader.load(url, 
                // Success callback
                (gltf) => {
                    console.log('Model loaded successfully');
                    const model = gltf.scene;
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    const objectId = 'object_' + Date.now();
                    model.name = objectId;
                    model.position.set(0, 0, 0);
                    this.scene.add(model);
                    this.objects.set(objectId, model);
                    this.selectObject(model);
                    this.updateObjectList();
                    
                    URL.revokeObjectURL(url);
                },
                // Progress callback
                (progress) => {
                    console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
                },
                // Error callback
                (error) => {
                    console.error('Error loading model:', error);
                }
            );
        }
        
        setupEventListeners() {
            window.addEventListener('resize', () => this.onWindowResize(), false);
            
            // Click handler for object selection
            this.renderer.domElement.addEventListener('click', (event) => {
                if (this.transformControls.dragging) return;
                
                const raycaster = new THREE.Raycaster();
                const mouse = new THREE.Vector2();
                
                mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                
                raycaster.setFromCamera(mouse, this.camera);
        
                // Create an array to store objects and their bounding boxes
                const selectableMeshes = [];
                this.objects.forEach(object => {
                    // Create a bounding box helper (invisible)
                    const bbox = new THREE.Box3().setFromObject(object);
                    const boxGeometry = new THREE.BoxGeometry(
                        bbox.max.x - bbox.min.x,
                        bbox.max.y - bbox.min.y,
                        bbox.max.z - bbox.min.z
                    );
                    
                    // Create an invisible mesh for the bounding box
                    const boxMesh = new THREE.Mesh(
                        boxGeometry,
                        new THREE.MeshBasicMaterial({ visible: false })
                    );
                    
                    // Position the box at the center of the object
                    boxMesh.position.copy(object.position);
                    boxMesh.userData.parentObject = object; // Store reference to the actual object
                    
                    selectableMeshes.push(boxMesh);
                });
        
                // Check for intersections with the bounding boxes
                const intersects = raycaster.intersectObjects(selectableMeshes);
        
                if (intersects.length > 0) {
                    // Get the actual object from the intersected box's userData
                    const selectedObject = intersects[0].object.userData.parentObject;
                    console.log('Selected object:', selectedObject.name);
                    this.selectObject(selectedObject);
                } else {
                    console.log('No object selected, deselecting');
                    this.deselectObject();
                }
        
                // Clean up temporary meshes
                selectableMeshes.forEach(mesh => {
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                });
            });
        }
        
        // Optional: Add this method to visualize the selection bounds (for debugging)
        visualizeSelectionBounds(object) {
            // Remove any existing selection box
            const existingBox = this.scene.getObjectByName('selectionBox');
            if (existingBox) {
                this.scene.remove(existingBox);
            }
        
            if (object) {
                const bbox = new THREE.Box3().setFromObject(object);
                const helper = new THREE.Box3Helper(bbox, 0x00ff00);
                helper.name = 'selectionBox';
                this.scene.add(helper);
            }
        }
        
        // Update the selectObject method to include visualization if needed
        selectObject(object) {
            console.log('Selecting object:', object.name);
            
            this.selectedObject = object;
            this.transformControls.attach(object);
            this.transformControls.setMode(this.transformMode);
            this.updateObjectList();
        
            // Uncomment to visualize selection bounds
            // this.visualizeSelectionBounds(object);
        
            const listItems = document.querySelectorAll('.object-item');
            listItems.forEach(item => item.classList.remove('selected'));
            const listItem = document.querySelector(`[data-object-id="${object.name}"]`);
            if (listItem) listItem.classList.add('selected');
        }
        
        deselectObject() {
            console.log('Deselecting object');
            if (this.selectedObject) {
                this.transformControls.detach();
                this.selectedObject = null;
                
                // Remove selection visualization if it exists
                const existingBox = this.scene.getObjectByName('selectionBox');
                if (existingBox) {
                    this.scene.remove(existingBox);
                }
                
                this.updateObjectList();
                const listItems = document.querySelectorAll('.object-item');
                listItems.forEach(item => item.classList.remove('selected'));
            }
        }
        
        
        setTransformMode(mode) {
            this.transformMode = mode;
            if (this.selectedObject) {
                this.transformControls.setMode(mode);
            }
            
            // Update UI
            ['translateMode', 'rotateMode', 'scaleMode'].forEach(buttonId => {
                const button = document.getElementById(buttonId);
                if (button) {
                    button.classList.toggle('active', buttonId.includes(mode));
                }
            });
        }

        lockSelectedObject() {
            if (this.selectedObject) {
                this.transformControls.detach();
                // You could store the locked state in the object if needed
                this.deselectObject();
            }
        }

        deleteSelectedObject() {
            if (this.selectedObject) {
                this.transformControls.detach();
                this.scene.remove(this.selectedObject);
                this.objects.delete(this.selectedObject.name);
                this.deselectObject();
                this.updateObjectList();
            }
        }

        updateObjectList() {
            const objectList = document.querySelector('.object-list');
            if (!objectList) return;

            objectList.innerHTML = '';
            this.objects.forEach((object, id) => {
                const item = document.createElement('div');
                item.className = 'object-item';
                if (this.selectedObject === object) {
                    item.classList.add('selected');
                }
                item.dataset.objectId = id;
                item.textContent = `Object ${id.split('_')[1]}`;
                item.onclick = () => this.selectObject(object);
                objectList.appendChild(item);
            });
        }

        onWindowResize() {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }

        animate() {
            requestAnimationFrame(() => this.animate());
            this.orbitControls.update();
            this.renderer.render(this.scene, this.camera);
        }
    }

    // Initialize the viewer
    if (checkDependencies()) {
        console.log("Starting Room Viewer");
        new RoomViewer();
    }
});
