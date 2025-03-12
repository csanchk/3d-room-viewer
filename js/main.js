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
            this.loadSceneState();
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
            this.transformControls.setSize(0.75);
            this.scene.add(this.transformControls);
        
            // Transform controls events
            this.transformControls.addEventListener('dragging-changed', (event) => {
                this.orbitControls.enabled = !event.value;
            });
        
            // Add real-time constraint checking during transform
            this.transformControls.addEventListener('change', () => {
                if (this.selectedObject) {
                    // Store current position
                    const currentPos = this.selectedObject.position.clone();
                    
                    // Apply constraints
                    this.constrainObjectToBounds(this.selectedObject);
                    
                    // If position was constrained, update transform controls
                    if (!this.selectedObject.position.equals(currentPos)) {
                        this.transformControls.update();
                    }
                }
            });
        
            // Add mouse/touch event listeners for continuous constraint checking
            this.transformControls.addEventListener('mouseMove', () => {
                if (this.selectedObject) {
                    this.constrainObjectToBounds(this.selectedObject);
                }
            });
        
            this.transformControls.addEventListener('objectChange', () => {
                if (this.selectedObject) {
                    this.constrainObjectToBounds(this.selectedObject);
                }
            });
        }
        
        constrainObjectToBounds(object) {
            // Get object's bounding box
            const bbox = new THREE.Box3().setFromObject(object);
            
            // Room dimensions (slightly smaller than actual to prevent clipping)
            const roomWidth = 19.5;
            const roomDepth = 19.5;
            const roomHeight = 9.5;
        
            // Get the object boundaries
            const bottomY = bbox.min.y;
            const topY = bbox.max.y;
            const leftX = bbox.min.x;
            const rightX = bbox.max.x;
            const frontZ = bbox.min.z;
            const backZ = bbox.max.z;
        
            // Store original position
            const originalPosition = object.position.clone();
        
            // Calculate allowed ranges based on object size
            const objectWidth = rightX - leftX;
            const objectHeight = topY - bottomY;
            const objectDepth = backZ - frontZ;
        
            // Calculate bounds
            const minX = -10 + objectWidth/2;
            const maxX = 10 - objectWidth/2;
            const minZ = -10 + objectDepth/2;
            const maxZ = 10 - objectDepth/2;
            const minY = objectHeight/2;
            const maxY = roomHeight - objectHeight/2;
        
            // Clamp position within bounds
            object.position.x = Math.max(minX, Math.min(maxX, object.position.x));
            object.position.y = Math.max(minY, Math.min(maxY, object.position.y));
            object.position.z = Math.max(minZ, Math.min(maxZ, object.position.z));
        
            // Log position changes if any occurred
            if (!object.position.equals(originalPosition)) {
                console.log('Position constrained:', 
                    'from:', originalPosition, 
                    'to:', object.position.clone());
            }
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
            
            // File upload
            const uploadElement = document.getElementById('modelUpload');
            if (uploadElement) {
                uploadElement.addEventListener('change', (e) => this.handleFileUpload(e));
            }
        }

        setupEventListeners() {
            window.addEventListener('resize', () => this.onWindowResize(), false);
            
            this.renderer.domElement.addEventListener('click', (event) => {
                if (this.transformControls.dragging) return;
                
                const raycaster = new THREE.Raycaster();
                const mouse = new THREE.Vector2();
                
                mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                
                raycaster.setFromCamera(mouse, this.camera);
        
                // Get all meshes from loaded objects
                const objectMeshes = [];
                this.objects.forEach(object => {
                    object.traverse((child) => {
                        if (child.isMesh) {
                            // Store reference to parent object
                            child.userData.parentObject = object;
                            objectMeshes.push(child);
                        }
                    });
                });
        
                // First, check intersections with objects only
                const objectIntersects = raycaster.intersectObjects(objectMeshes, false);
        
                if (objectIntersects.length > 0) {
                    // Get the parent object of the intersected mesh
                    const selectedObject = objectIntersects[0].object.userData.parentObject;
                    
                    if (selectedObject && this.objects.has(selectedObject.name)) {
                        console.log('Selected object:', selectedObject.name);
                        this.selectObject(selectedObject);
                        return; // Exit early if we hit an object
                    }
                }
        
                // If we didn't hit any objects, check for room intersections
                const roomParts = [this.floor, ...this.scene.children.filter(child => 
                    child.isMesh && !this.objects.has(child.name))];
                
                const roomIntersects = raycaster.intersectObjects(roomParts, false);
        
                if (roomIntersects.length > 0) {
                    console.log('Hit room, deselecting');
                    this.deselectObject();
                }
            });
        }
        
        
        handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
        
            console.log('Loading file:', file.name);
        
            const url = URL.createObjectURL(file);
            const objectId = 'object_' + Date.now();
        
            const loader = new THREE.GLTFLoader();
            loader.load(url, 
                (gltf) => {
                    console.log('Model loaded successfully');
                    const model = gltf.scene;
        
                    // Set up model properties before centering
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    model.name = objectId;
                    model.userData.modelUrl = url; // Store the URL with the object
        
                    // Center and process the model
                    const centeredModel = this.centerObject(model);
                    
                    // Calculate initial position
                    const bbox = new THREE.Box3().setFromObject(centeredModel);
                    const size = new THREE.Vector3();
                    bbox.getSize(size);
                    
                    // Calculate height from bottom of bounding box
                    const height = (bbox.max.y - bbox.min.y) / 2;
        
                    // Position model in center of room, with bottom exactly on floor
                    centeredModel.position.set(
                        0,          // Center X
                        height,     // Height above floor based on object size
                        0          // Center Z
                    );
        
                    // Add to scene and store reference
                    this.objects.set(objectId, centeredModel);
                    
                    // Select the centered model
                    this.selectObject(centeredModel);
                    this.updateObjectList();
                    
                    // Save scene state after adding new object
                    this.saveSceneState();
                },
                (progress) => {
                    console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Error loading model:', error);
                    URL.revokeObjectURL(url);
                }
            );
        }
        

        centerObject(object) {
            // Get the bounding box of the entire object
            const bbox = new THREE.Box3().setFromObject(object);
            const center = bbox.getCenter(new THREE.Vector3());
            
            // Create a new group to serve as the container
            const container = new THREE.Group();
            
            // Add the container to the scene at the original position
            this.scene.add(container);
            
            // Move all of the object's children to the container
            while (object.children.length) {
                const child = object.children[0];
                
                // Adjust child position relative to center
                child.position.sub(center);
                
                // Move child to container
                container.add(child);
            }
            
            // Position container at the center point
            container.position.copy(center);
            
            // Copy the name and other properties we need
            container.name = object.name;
            
            // Remove the original object
            object.parent?.remove(object);
            
            return container;
        }
        constrainObjectToBounds(object) {
            // Get object's bounding box
            const bbox = new THREE.Box3().setFromObject(object);
            
            // Room dimensions
            const roomWidth = 20;
            const roomDepth = 20;
            const roomHeight = 10;
        
            // Get the object boundaries
            const bottomY = bbox.min.y;
            const topY = bbox.max.y;
            const leftX = bbox.min.x;
            const rightX = bbox.max.x;
            const frontZ = bbox.min.z;
            const backZ = bbox.max.z;
        
            // Store original position
            const originalPosition = object.position.clone();
        
            // Constrain to floor (y = 0)
            if (bottomY < 0) {
                object.position.y = object.position.y - bottomY;
            }
        
            // Constrain to ceiling
            if (topY > roomHeight) {
                object.position.y = object.position.y - (topY - roomHeight);
            }
        
            // Constrain to walls
            // Left wall (x = -10)
            if (leftX < -10) {
                object.position.x = object.position.x - (leftX + 10);
            }
        
            // Right wall (x = 10)
            if (rightX > 10) {
                object.position.x = object.position.x - (rightX - 10);
            }
        
            // Back wall (z = -10)
            if (backZ > 10) {
                object.position.z = object.position.z - (backZ - 10);
            }
        
            // Front wall (z = -10)
            if (frontZ < -10) {
                object.position.z = object.position.z + 10 + Math.abs(frontZ);
            }
        
            // Log position changes if any occurred
            if (!object.position.equals(originalPosition)) {
                console.log('Position constrained:', 
                    'from:', originalPosition, 
                    'to:', object.position.clone());
            }
        
            // Update transform controls if they exist
            if (this.transformControls) {
                this.transformControls.update();
            }
            this.saveSceneState();
        }
        

        deselectObject() {
            console.log('Deselecting object');
            if (this.selectedObject) {
                this.transformControls.detach();
                this.selectedObject = null;
                this.updateObjectList();
                
                const listItems = document.querySelectorAll('.object-item');
                listItems.forEach(item => item.classList.remove('selected'));
            }
            this.saveSceneState();
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
        
        selectObject(object) {
            // ... existing code ...
            
            // Ensure the object has a modelUrl
            if (!object.userData.modelUrl) {
                object.userData.modelUrl = URL.createObjectURL(new Blob()); // Dummy URL
            }
            
            // ... rest of the existing code ...
        }
          

        lockSelectedObject() {
            if (this.selectedObject) {
                this.transformControls.detach();
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

        saveSceneState() {
            const sceneState = {
                objects: []
            };
            
            this.objects.forEach((object, id) => {
                sceneState.objects.push({
                    id: id,
                    position: object.position.toArray(),
                    rotation: object.rotation.toArray(),
                    scale: object.scale.toArray(),
                    modelUrl: object.userData.modelUrl // We'll store the model URL
                });
            });
            
            localStorage.setItem('sceneState', JSON.stringify(sceneState));
        }
        
        loadSceneState() {
            const savedState = localStorage.getItem('sceneState');
            if (savedState) {
                const sceneState = JSON.parse(savedState);
                sceneState.objects.forEach(objData => {
                    this.loadModelFromUrl(objData.modmodelUrl, objData);
                });
            }
        }
        
        loadModelFromUrl(url, objData) {
            const loader = new THREE.GLTFLoader();
            
            loader.load(url, (gltf) => {
                const model = gltf.scene;
                
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                model.position.fromArray(objData.position);
                model.rotation.fromArray(objData.rotation);
                model.scale.fromArray(objData.scale);
                
                model.name = objData.id;
                model.userData.modelUrl = url;
                
                this.objects.set(objData.id, model);
                this.scene.add(model);
            });
        }


    }

    // Initialize the viewer
    if (checkDependencies()) {
        console.log("Starting Room Viewer");
        new RoomViewer();
    }
});
