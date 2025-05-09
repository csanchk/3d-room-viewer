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
            this.lockPopup = null;
            this.lockedObjects = new Set();
            this.currentMode = null;
            this.modeListenersAdded = false;

            // Load font
            const fontLoader = new THREE.FontLoader();
            this.font = null;
    
            fontLoader.load(
                'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_regular.typeface.json',
                (font) => {
                    this.font = font;
                    console.log('Font loaded successfully');
                },
                (progress) => {
                    console.log('Font loading progress:', (progress.loaded / progress.total * 100) + '%');
                },
                (error) => {
                    console.error('Error loading font:', error);
                }
            );
            
             // Ensure TextGeometry is available
            if (!THREE.TextGeometry) {
                console.error('TextGeometry not loaded');
                return;
             }
        }

    
        resetObjectOrientation() {
            if (this.selectedObject) {
                // Store the original position
                const originalPosition = this.selectedObject.position.clone();
        
                // Reset rotation
                this.selectedObject.rotation.set(0, 0, 0);
        
                // Reset scale
                this.selectedObject.scale.set(1, 1, 1);
        
                // Restore the original position
                this.selectedObject.position.copy(originalPosition);
        
                // Update transform controls
                this.transformControls.update();
        
                console.log('Object orientation reset');
            }
        }

        bringObjectToFloor() {
            if (this.selectedObject) {
                // Compute the bounding box
                const bbox = new THREE.Box3().setFromObject(this.selectedObject);
        
                // Calculate the vertical offset
                const offset = bbox.min.y;
        
                // Move the object up by the offset
                this.selectedObject.position.y -= offset;
        
                // Update transform controls
                this.transformControls.update();
        
                console.log('Object brought to floor');
            }
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
        
            // Transform controls for translation and rotation
            this.translateControls = new THREE.TransformControls(this.camera, this.renderer.domElement);
            this.rotateControls = new THREE.TransformControls(this.camera, this.renderer.domElement);
            
            // Set modes
            this.translateControls.setMode('translate');
            this.rotateControls.setMode('rotate');
            
            // Add to scene
            this.scene.add(this.translateControls);
            this.scene.add(this.rotateControls);
        
            // Configure controls
            this.translateControls.setSize(0.7);
            this.rotateControls.setSize(0.7);
            
            // Remove snapping for smoother movement
            this.translateControls.setTranslationSnap(null);
            this.rotateControls.setRotationSnap(null);
        
            // Transform controls events for translation
            this.translateControls.addEventListener('dragging-changed', (event) => {
                this.orbitControls.enabled = !event.value;
            });
        
            // Transform controls events for rotation
            this.rotateControls.addEventListener('dragging-changed', (event) => {
                this.orbitControls.enabled = !event.value;
            });
        
            // Add real-time constraint checking during transform
            this.translateControls.addEventListener('change', () => {
                if (this.selectedObject) {
                    const currentPos = this.selectedObject.position.clone();
                    this.constrainObjectToBounds(this.selectedObject);
                    if (!this.selectedObject.position.equals(currentPos)) {
                        this.translateControls.update();
                    }
                }
            });
        
            this.rotateControls.addEventListener('change', () => {
                if (this.selectedObject) {
                    const currentPos = this.selectedObject.position.clone();
                    this.constrainObjectToBounds(this.selectedObject);
                    if (!this.selectedObject.position.equals(currentPos)) {
                        this.rotateControls.update();
                    }
                }
            });
        
            // Add mouse/touch event listeners for continuous constraint checking
            this.translateControls.addEventListener('mouseMove', () => {
                if (this.selectedObject) {
                    this.constrainObjectToBounds(this.selectedObject);
                }
            });
        
            this.rotateControls.addEventListener('mouseMove', () => {
                if (this.selectedObject) {
                    this.constrainObjectToBounds(this.selectedObject);
                }
            });
        
            // Object change event listeners
            this.translateControls.addEventListener('objectChange', () => {
                if (this.selectedObject) {
                    this.constrainObjectToBounds(this.selectedObject);
                }
            });
        
            this.rotateControls.addEventListener('objectChange', () => {
                if (this.selectedObject) {
                    this.constrainObjectToBounds(this.selectedObject);
                }
            });
        
            // Add precision mode with shift key
            window.addEventListener('keydown', (event) => {
                if (event.key === 'Shift') {
                    this.translateControls.setTranslationSnap(0.1);
                    this.rotateControls.setRotationSnap(THREE.MathUtils.degToRad(5));
                }
            });
        
            window.addEventListener('keyup', (event) => {
                if (event.key === 'Shift') {
                    this.translateControls.setTranslationSnap(null);
                    this.rotateControls.setRotationSnap(null);
                }
            });
        
            // Set initial visibility
            this.translateControls.visible = false;
            this.rotateControls.visible = false;
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
             
        setTransformSpace(space) {
            if (this.transformControls) {
                this.transformControls.setSpace(space);
                
                // Update UI buttons
                document.getElementById('localSpace').classList.toggle('active', space === 'local');
                document.getElementById('globalSpace').classList.toggle('active', space === 'world');
                
                console.log('Transform space changed to:', space);
            }
        }

        createRoom() {
            // Setup mode buttons
            document.getElementById('translateMode')?.addEventListener('click', () => {
                this.setTranslateMode();
                // Update button states
                document.getElementById('translateMode').classList.add('active');
                document.getElementById('rotateMode').classList.remove('active');
            });
    
            document.getElementById('rotateMode')?.addEventListener('click', () => {
                this.setRotateMode();
                // Update button states
                document.getElementById('translateMode').classList.remove('active');
                document.getElementById('rotateMode').classList.add('active');
            });
            
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
            document.getElementById('translateMode')?.addEventListener('click', () => {
                if (this.currentMode === 'translate') {
                    // If translate is already active, disable it
                    this.disableTransformControls();
                } else {
                    // Enable translate mode
                    this.setTranslateMode();
                    // Update button states
                    document.getElementById('translateMode').classList.add('active');
                    document.getElementById('rotateMode').classList.remove('active');
                }
            });
            
            document.getElementById('rotateMode')?.addEventListener('click', () => {
                if (this.currentMode === 'rotate') {
                    // If rotate is already active, disable it
                    this.disableTransformControls();
                } else {
                    // Enable rotate mode
                    this.setRotateMode();
                    // Update button states
                    document.getElementById('translateMode').classList.remove('active');
                    document.getElementById('rotateMode').classList.add('active');
                }
            });
        
            // Other control buttons
            document.getElementById('lockObject')?.addEventListener('click', () => this.lockSelectedObject());
            document.getElementById('deleteObject')?.addEventListener('click', () => this.deleteSelectedObject());
            
            // File upload
            const uploadElement = document.getElementById('modelUpload');
            if (uploadElement) {
                uploadElement.addEventListener('change', (e) => this.handleFileUpload(e));
            }
        
            // Keyboard shortcuts
            window.addEventListener('keydown', (event) => {
                if (this.selectedObject && !this.lockedObjects.has(this.selectedObject.name)) {
                    switch(event.key.toLowerCase()) {
                        case 'g':
                            if (this.currentMode === 'translate') {
                                this.disableTransformControls();
                            } else {
                                this.setTranslateMode();
                                document.getElementById('translateMode').classList.add('active');
                                document.getElementById('rotateMode').classList.remove('active');
                            }
                            break;
                        case 'r':
                            if (this.currentMode === 'rotate') {
                                this.disableTransformControls();
                            } else {
                                this.setRotateMode();
                                document.getElementById('translateMode').classList.remove('active');
                                document.getElementById('rotateMode').classList.add('active');
                            }
                            break;
                    }
                }
            });
        
            // Precision controls
            const snapToggle = document.getElementById('snapToggle');
            const snapValue = document.getElementById('snapValue');
            const snapValueDisplay = document.getElementById('snapValueDisplay');
            const snapSettings = document.querySelector('.snap-settings');
        
            if (snapToggle) {
                snapToggle.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        snapSettings.style.display = 'block';
                        this.translateControls.setTranslationSnap(parseFloat(snapValue.value));
                        this.rotateControls.setRotationSnap(THREE.MathUtils.degToRad(15));
                    } else {
                        snapSettings.style.display = 'none';
                        this.translateControls.setTranslationSnap(null);
                        this.rotateControls.setRotationSnap(null);
                    }
                });
            }
        
            if (snapValue) {
                snapValue.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    snapValueDisplay.textContent = value.toFixed(2);
                    if (snapToggle.checked) {
                        if (this.currentMode === 'translate') {
                            this.translateControls.setTranslationSnap(value);
                        } else if (this.currentMode === 'rotate') {
                            this.rotateControls.setRotationSnap(THREE.MathUtils.degToRad(value));
                        }
                    }
                });
            }
        
            // Additional controls
            document.getElementById('resetOrientation')?.addEventListener('click', () => this.resetObjectOrientation());
            document.getElementById('bringToFloor')?.addEventListener('click', () => this.bringObjectToFloor());
        }   
        
        disableTransformControls() {
            // Hide all controls
            if (this.translateControls) {
                this.translateControls.detach();
                this.translateControls.visible = false;
            }
            if (this.rotateControls) {
                this.rotateControls.detach();
                this.rotateControls.visible = false;
            }
        
            // Remove active state from buttons
            document.getElementById('translateMode')?.classList.remove('active');
            document.getElementById('rotateMode')?.classList.remove('active');
        
            // Clear current mode
            this.currentMode = null;
        
            console.log('Transform controls disabled');
        }
        
        setTranslateMode() {
            // If we're already in translate mode, do nothing
            if (this.currentMode === 'translate') return;
        
            this.currentMode = 'translate';
            if (this.selectedObject) {
                // Hide rotate controls
                this.rotateControls.visible = false;
                this.rotateControls.detach();
                
                // Show translate controls
                this.translateControls.visible = true;
                this.translateControls.attach(this.selectedObject);
            }
            console.log('Switched to translate mode');
        }
        
        setRotateMode() {
            // If we're already in rotate mode, do nothing
            if (this.currentMode === 'rotate') return;
        
            this.currentMode = 'rotate';
            if (this.selectedObject) {
                // Hide translate controls
                this.translateControls.visible = false;
                this.translateControls.detach();
                
                // Show rotate controls
                this.rotateControls.visible = true;
                this.rotateControls.attach(this.selectedObject);
            }
            console.log('Switched to rotate mode');
        }

        setupEventListeners() {
            window.addEventListener('resize', () => this.onWindowResize(), false);
            
            this.renderer.domElement.addEventListener('click', (event) => {
                console.log('Click event triggered');
                if (this.translateControls?.dragging || this.rotateControls?.dragging) return;
                
                const raycaster = new THREE.Raycaster();
                const mouse = new THREE.Vector2();
                
                mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                
                raycaster.setFromCamera(mouse, this.camera);
        
                // First, check if we clicked on the lock popup
                if (this.lockPopup) {
                    const popupIntersects = raycaster.intersectObject(this.lockPopup, true);
                    if (popupIntersects.length > 0) {
                        console.log('Lock popup clicked');
                        this.toggleLock();
                        return;
                    }
                }
        
                // Get all meshes from loaded objects
                const objectMeshes = [];
                this.objects.forEach(object => {
                    console.log('Processing object:', object.name);
                    object.traverse((child) => {
                        if (child.isMesh) {
                            child.userData.rootObject = object;
                            objectMeshes.push(child);
                            console.log('Added mesh to raycast targets');
                        }
                    });
                });
        
                console.log('Total meshes to check:', objectMeshes.length);
        
                // Check intersections with meshes
                const intersects = raycaster.intersectObjects(objectMeshes, false);
                console.log('Intersections found:', intersects.length);
        
                if (intersects.length > 0) {
                    const hitObject = intersects[0].object;
                    const rootObject = hitObject.userData.rootObject;
                    
                    if (rootObject) {
                        console.log('Selected root object:', rootObject.name);
                        // Remove existing popup before selecting new object
                        if (this.lockPopup) {
                            this.scene.remove(this.lockPopup);
                            this.lockPopup = null;
                        }
                        
                        // Select the object
                        this.selectObject(rootObject);
                        
                        // Show popup at click position with offset
                        const clickPosition = intersects[0].point;
                        this.showLockPopup(rootObject, this.lockedObjects.has(rootObject.name));
                        this.lockPopup.position.copy(clickPosition);
                        this.lockPopup.position.y += 0.5;
                        
                        // Update popup rotation immediately
                        this.updatePopupRotation();
                    } else {
                        console.log('No root object found');
                    }
                } else {
                    // Check if we hit the room
                    const roomParts = [this.floor, ...this.scene.children.filter(child => 
                        child.isMesh && !this.objects.has(child.name))];
                    
                    const roomIntersects = raycaster.intersectObjects(roomParts, false);
                    
                    if (roomIntersects.length > 0) {
                        console.log('Hit room, deselecting');
                        // Remove popup when deselecting
                        if (this.lockPopup) {
                            this.scene.remove(this.lockPopup);
                            this.lockPopup = null;
                        }
                        this.disableTransformControls();
                        this.deselectObject();
                    }
                }
            });
        
            // Prevent context menu from showing up on right-click
            this.renderer.domElement.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });
        
            // Add keyboard shortcuts
            window.addEventListener('keydown', (event) => {
                if (this.selectedObject && !this.lockedObjects.has(this.selectedObject.name)) {
                    switch(event.key.toLowerCase()) {
                        case 'g':
                            if (this.currentMode === 'translate') {
                                this.disableTransformControls();
                            } else {
                                this.setTranslateMode();
                                document.getElementById('translateMode').classList.add('active');
                                document.getElementById('rotateMode').classList.remove('active');
                            }
                            break;
                        case 'r':
                            if (this.currentMode === 'rotate') {
                                this.disableTransformControls();
                            } else {
                                this.setRotateMode();
                                document.getElementById('translateMode').classList.remove('active');
                                document.getElementById('rotateMode').classList.add('active');
                            }
                            break;
                        case 'escape':
                            if (this.lockPopup) {
                                this.scene.remove(this.lockPopup);
                                this.lockPopup = null;
                            }
                            this.disableTransformControls();
                            this.deselectObject();
                            break;
                    }
                }
            });
        
            // Handle popup visibility when camera moves
            this.orbitControls.addEventListener('change', () => {
                if (this.lockPopup) {
                    this.updatePopupRotation();
                }
            });
        }

        selectObject(object) {
            console.log('Selecting object:', object.name);
            
            this.selectedObject = object;
            
            // Ensure the object has a modelUrl
            if (!object.userData.modelUrl) {
                object.userData.modelUrl = URL.createObjectURL(new Blob());
            }
        
            // Calculate object's world position
            const worldPos = new THREE.Vector3();
            object.getWorldPosition(worldPos);
            
            if (!this.lockedObjects.has(object.name)) {
                // Detach any existing controls
                this.translateControls.detach();
                this.rotateControls.detach();
        
                // Only attach controls if we're in a mode
                if (this.currentMode === 'translate') {
                    this.translateControls.visible = true;
                    this.rotateControls.visible = false;
                    this.translateControls.attach(object);
                    document.getElementById('translateMode')?.classList.add('active');
                    document.getElementById('rotateMode')?.classList.remove('active');
                } else if (this.currentMode === 'rotate') {
                    this.translateControls.visible = false;
                    this.rotateControls.visible = true;
                    this.rotateControls.attach(object);
                    document.getElementById('translateMode')?.classList.remove('active');
                    document.getElementById('rotateMode')?.classList.add('active');
                } else {
                    // No mode selected, keep both controls hidden
                    this.translateControls.visible = false;
                    this.rotateControls.visible = false;
                    document.getElementById('translateMode')?.classList.remove('active');
                    document.getElementById('rotateMode')?.classList.remove('active');
                }
        
                // Configure controls visibility and properties
                this.translateControls.showX = true;
                this.translateControls.showY = true;
                this.translateControls.showZ = true;
                
                this.rotateControls.showX = true;
                this.rotateControls.showY = true;
                this.rotateControls.showZ = true;
        
                // Set control sizes
                this.translateControls.setSize(0.7);
                this.rotateControls.setSize(0.7);
        
                // Position controls
                this.translateControls.position.copy(object.position);
                this.rotateControls.position.copy(object.position);
        
                // Make sure orbit controls are enabled initially
                this.orbitControls.enabled = true;
        
                // Ensure proper control states
                if (this.currentMode) {
                    console.log(`Controls attached in ${this.currentMode} mode`);
                    if (this.currentMode === 'translate') {
                        this.translateControls.enabled = true;
                        this.rotateControls.enabled = false;
                    } else {
                        this.translateControls.enabled = false;
                        this.rotateControls.enabled = true;
                    }
                } else {
                    console.log('No control mode active');
                    this.translateControls.enabled = false;
                    this.rotateControls.enabled = false;
                }
        
                // Add key listeners for switching modes if not already added
                if (!this.modeListenersAdded) {
                    window.addEventListener('keydown', (event) => {
                        if (this.selectedObject && !this.lockedObjects.has(this.selectedObject.name)) {
                            if (event.key.toLowerCase() === 'g') {
                                if (this.currentMode === 'translate') {
                                    this.disableTransformControls();
                                } else {
                                    this.setTranslateMode();
                                }
                            } else if (event.key.toLowerCase() === 'r') {
                                if (this.currentMode === 'rotate') {
                                    this.disableTransformControls();
                                } else {
                                    this.setRotateMode();
                                }
                            }
                        }
                    });
                    this.modeListenersAdded = true;
                }
        
            } else {
                // If object is locked, detach and hide all controls
                this.translateControls.detach();
                this.rotateControls.detach();
                this.translateControls.visible = false;
                this.rotateControls.visible = false;
                this.translateControls.enabled = false;
                this.rotateControls.enabled = false;
            }
            
            // Ensure object is within bounds
            this.constrainObjectToBounds(object);
            
            // Update UI
            this.updateObjectList();
            const listItems = document.querySelectorAll('.object-item');
            listItems.forEach(item => item.classList.remove('selected'));
            const listItem = document.querySelector(`[data-object-id="${object.name}"]`);
            if (listItem) listItem.classList.add('selected');
        
            // Show the lock/unlock popup
            this.showLockPopup(object, this.lockedObjects.has(object.name));
        
            // Save scene state
            this.saveSceneState();
        
            console.log('Object selection complete:', object.name);
        }        
        
        
        // Add these helper methods to your class
        setTranslateMode() {
            this.currentMode = 'translate';
            if (this.selectedObject) {
                this.translateControls.visible = true;
                this.rotateControls.visible = false;
                this.rotateControls.detach();
                this.translateControls.attach(this.selectedObject);
            }
            console.log('Switched to translate mode');
        }
        
        setRotateMode() {
            this.currentMode = 'rotate';
            if (this.selectedObject) {
                this.translateControls.visible = false;
                this.rotateControls.visible = true;
                this.translateControls.detach();
                this.rotateControls.attach(this.selectedObject);
            }
            console.log('Switched to rotate mode');
        }                                         
        
        showLockPopup(object, isLocked) {
            console.log('Showing lock popup:', isLocked ? 'locked' : 'unlocked');
        
            if (this.lockPopup) {
                this.scene.remove(this.lockPopup);
            }
        
            // Create a larger popup plane
            const popupGeometry = new THREE.PlaneGeometry(1.5, 0.6); // Increased size
            const popupMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,  // White background
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide,
                depthTest: false
            });
            this.lockPopup = new THREE.Mesh(popupGeometry, popupMaterial);
        
            // Create a border for the popup
            const borderGeometry = new THREE.PlaneGeometry(1.6, 0.7); // Slightly larger than popup
            const borderMaterial = new THREE.MeshBasicMaterial({
                color: 0x000000, // Black border
                side: THREE.DoubleSide,
                depthTest: false
            });
            const border = new THREE.Mesh(borderGeometry, borderMaterial);
            border.position.set(0, 0, -0.001); // Slightly behind popup
            this.lockPopup.add(border);
        
            // Position the popup
            const objectPosition = new THREE.Vector3();
            object.getWorldPosition(objectPosition);
            this.lockPopup.position.copy(objectPosition);
            this.lockPopup.position.y += 0.5;
        
            // Ensure popup is always on top
            this.lockPopup.renderOrder = 999999;
        
            // Add text to the popup if font is loaded
            if (this.font) {
                const text = isLocked ? 'UNLOCK' : 'LOCK';
                const textGeometry = new THREE.TextGeometry(text, {
                    font: this.font,
                    size: 0.25, // Much larger text
                    height: 0.05, // More depth for better visibility
                    curveSegments: 12,
                    bevelEnabled: false
                });
        
                // Center the text geometry
                textGeometry.computeBoundingBox();
                const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
                const textHeight = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y;
        
                const textMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0x000000, // Black text
                    side: THREE.DoubleSide,
                    depthTest: false
                });
                
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.position.set(-textWidth/2, -textHeight/2, 0.01);
                
                // Create a Group to hold the text and make it always face the camera
                const textContainer = new THREE.Group();
                textContainer.add(textMesh);
                this.lockPopup.add(textContainer);
        
                // Tag the text container for animation
                textContainer.isTextContainer = true;
            } else {
                console.warn('Font not loaded, popup will not have text');
            }
        
            this.scene.add(this.lockPopup);
        
            // Update the popup's rotation to face the camera
            this.updatePopupRotation();
        }
        
        // Add this new method to handle popup rotation
        updatePopupRotation() {
            if (this.lockPopup) {
                // Make the popup face the camera
                const lookAtVector = new THREE.Vector3();
                this.camera.getWorldPosition(lookAtVector);
                this.lockPopup.lookAt(lookAtVector);
        
                // Keep text upright
                this.lockPopup.children.forEach(child => {
                    if (child.isTextContainer) {
                        // Reset rotation of text container
                        child.rotation.set(0, -this.lockPopup.rotation.y, 0);
                    }
                });
            }
        }
        
        // Update your animate method to include the popup rotation update
        animate() {
            requestAnimationFrame(() => this.animate());
            
            // Update orbit controls
            this.orbitControls.update();
        
            // Update popup rotation
            this.updatePopupRotation();
        
            // Update transform controls if they exist
            if (this.transformControls) {
                this.transformControls.update();
            }
        
            // Render the scene
            this.renderer.render(this.scene, this.camera);
        }        
        
        onPopupClick(event) {
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
            raycaster.setFromCamera(mouse, this.camera);
        
            const intersects = raycaster.intersectObject(this.lockPopup);
            if (intersects.length > 0) {
                this.toggleLock();
            }
        }
        
        toggleLock() {
            if (!this.selectedObject) return;
        
            const isLocked = this.lockedObjects.has(this.selectedObject.name);
            if (isLocked) {
                this.lockedObjects.delete(this.selectedObject.name);
                this.transformControls.attach(this.selectedObject);
            } else {
                this.lockedObjects.add(this.selectedObject.name);
                this.transformControls.detach();
            }
        
            this.showLockPopup(this.selectedObject, !isLocked);
            console.log(`Object ${this.selectedObject.name} is now ${!isLocked ? 'locked' : 'unlocked'}`);
        }
        
        handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
        
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileData = e.target.result;
                const url = URL.createObjectURL(file);
                const objectId = 'object_' + Date.now();
        
                const loader = new THREE.GLTFLoader();
                loader.load(url, 
                    (gltf) => {
                        console.log('Model loaded successfully');
                        const model = gltf.scene;
        
                        // Setup model properties
                        model.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                child.userData.selectable = true;
                            }
                        });
                        
                        model.name = objectId;
                        model.userData.modelUrl = url;
                        model.userData.fileData = fileData;
                        model.userData.selectable = true;
        
                        // Calculate bounding box
                        const bbox = new THREE.Box3().setFromObject(model);
                        const size = new THREE.Vector3();
                        bbox.getSize(size);
        
                        // Position model with its bottom exactly on the floor
                        const bottomY = bbox.min.y;
                        model.position.y -= bottomY; // This will place the bottom exactly on the floor
        
                        // Add to scene and store reference
                        this.scene.add(model);
                        this.objects.set(objectId, model);
                        
                        console.log('Model added to scene:', objectId);
                        this.selectObject(model);
                        this.updateObjectList();
                        this.saveSceneState();
        
                        URL.revokeObjectURL(url);
                    },
                    (progress) => {
                        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
                    },
                    (error) => {
                        console.error('Error loading model:', error);
                        URL.revokeObjectURL(url);
                    }
                );
            };
            reader.readAsDataURL(file);
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
            // Get object's bounding box in world space
            const bbox = new THREE.Box3().setFromObject(object);
            
            // Room dimensions
            const roomWidth = 19;
            const roomDepth = 19;
            const roomHeight = 9.5;
        
            // Get object boundaries
            const bottomY = bbox.min.y;
            const topY = bbox.max.y;
            const leftX = bbox.min.x;
            const rightX = bbox.max.x;
            const frontZ = bbox.min.z;
            const backZ = bbox.max.z;
        
            // Store original position
            const originalPosition = object.position.clone();
        
            // Constrain to floor
            if (bottomY < 0) {
                object.position.y += Math.abs(bottomY);
            }
        
            // Constrain to walls
            if (leftX < -10) object.position.x += Math.abs(leftX + 10);
            if (rightX > 10) object.position.x -= (rightX - 10);
            if (frontZ < -10) object.position.z += Math.abs(frontZ + 10);
            if (backZ > 10) object.position.z -= (backZ - 10);
        
            // Update transform controls if position changed
            if (!object.position.equals(originalPosition)) {
                this.transformControls.update();
            }
        }
        
        deselectObject() {
            console.log('Deselecting object');
            if (this.selectedObject) {
                // Detach and hide translation controls
                if (this.translateControls) {
                    this.translateControls.detach();
                    this.translateControls.visible = false;
                }
        
                // Detach and hide rotation controls
                if (this.rotateControls) {
                    this.rotateControls.detach();
                    this.rotateControls.visible = false;
                }
        
                // Remove any lock popup
                if (this.lockPopup) {
                    this.scene.remove(this.lockPopup);
                    this.lockPopup = null;
                }
        
                // Clear selected object
                this.selectedObject = null;
                
                // Update UI
                this.updateObjectList();
                const listItems = document.querySelectorAll('.object-item');
                listItems.forEach(item => item.classList.remove('selected'));
                
                // Re-enable orbit controls
                this.orbitControls.enabled = true;
        
                console.log('Object deselection complete');
            }
            this.saveSceneState();
        }        
        
        setTransformMode(mode) {
            this.transformMode = mode;
            if (this.selectedObject) {
                this.transformControls.setMode(mode);
                this.transformControls.setSpace('local');
        
                // Show all axes
                this.transformControls.showX = true;
                this.transformControls.showY = true;
                this.transformControls.showZ = true;
        
                // Set size for combined controls
                this.transformControls.setSize(0.75);
        
                // Update transform controls appearance
                this.transformControls.traverse((child) => {
                    if (child.material) {
                        // Set colors for different axes
                        if (child.name.includes('X')) {
                            child.material.color.setHex(0xff0000); // Red for X
                        } else if (child.name.includes('Y')) {
                            child.material.color.setHex(0x00ff00); // Green for Y
                        } else if (child.name.includes('Z')) {
                            child.material.color.setHex(0x0000ff); // Blue for Z
                        }
                        
                        child.material.opacity = 0.85;
                        child.material.transparent = true;
                    }
                });
            }
            
            // Update UI buttons
            const translateButton = document.getElementById('translateMode');
            if (translateButton) {
                translateButton.classList.toggle('active', mode === 'translate');
            }
        
            // Update control state
            if (this.selectedObject) {
                this.transformControls.update();
                
                // Ensure object stays within bounds after transform
                this.constrainObjectToBounds(this.selectedObject);
            }
        
            console.log('Transform mode changed to:', mode);
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
            
            // Update orbit controls
            this.orbitControls.update();
        
            // Update popup rotation
            this.updatePopupRotation();
        
            // Update transform controls if they exist
            if (this.translateControls) {
                this.translateControls.update();
            }
            if (this.rotateControls) {
                this.rotateControls.update();
            }
        
            // Render the scene
            this.renderer.render(this.scene, this.camera);
        }              

        saveSceneState() {
            const sceneState = {
                objects: []
            };
            
            this.objects.forEach((object, id) => {
                // Save object's state including its file data
                sceneState.objects.push({
                    id: id,
                    position: {
                        x: object.position.x,
                        y: object.position.y,
                        z: object.position.z
                    },
                    rotation: {
                        x: object.rotation.x,
                        y: object.rotation.y,
                        z: object.rotation.z
                    },
                    scale: {
                        x: object.scale.x,
                        y: object.scale.y,
                        z: object.scale.z
                    },
                    // Store the file data as base64
                    fileData: object.userData.fileData
                });
            });
            
            localStorage.setItem('sceneState', JSON.stringify(sceneState));
            console.log('Scene saved:', sceneState);
        }
        
        loadSceneState() {
            const savedState = localStorage.getItem('sceneState');
            if (savedState) {
                const sceneState = JSON.parse(savedState);
                console.log('Loading saved scene:', sceneState);
                
                sceneState.objects.forEach(objData => {
                    // Convert base64 back to file
                    const fileData = objData.fileData;
                    if (fileData) {
                        const blob = this.base64ToBlob(fileData);
                        this.loadSavedObject(blob, objData);
                    }
                });
            }
        }
        
        // Helper method to convert base64 to blob
        base64ToBlob(base64) {
            const parts = base64.split(';base64,');
            const contentType = parts[0].split(':')[1] || 'application/octet-stream';
            const raw = window.atob(parts[1]);
            const rawLength = raw.length;
            const uInt8Array = new Uint8Array(rawLength);
        
            for (let i = 0; i < rawLength; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
            }
        
            return new Blob([uInt8Array], { type: contentType });
        }
        
        
        loadSavedObject(file, savedData = null, fileData = null) {
            const url = URL.createObjectURL(file);
            const objectId = savedData ? savedData.id : 'object_' + Date.now();
        
            const loader = new THREE.GLTFLoader();
            loader.load(url, 
                (gltf) => {
                    console.log('Model loaded successfully');
                    const model = gltf.scene;
        
                    // Setup model properties
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    model.name = objectId;
                    model.userData.fileData = fileData || savedData.fileData;
        
                    // Calculate bounding box before any transformations
                    const bbox = new THREE.Box3().setFromObject(model);
                    const size = new THREE.Vector3();
                    const center = new THREE.Vector3();
                    bbox.getSize(size);
                    bbox.getCenter(center);
        
                    // Create a container group
                    const container = new THREE.Group();
                    this.scene.add(container);
        
                    // Add model to container
                    container.add(model);
                    
                    // Center model within container
                    model.position.sub(center);
        
                    if (savedData) {
                        // Restore saved position
                        container.position.set(
                            savedData.position.x,
                            savedData.position.y,
                            savedData.position.z
                        );
                        container.rotation.set(
                            savedData.rotation.x,
                            savedData.rotation.y,
                            savedData.rotation.z
                        );
                        container.scale.set(
                            savedData.scale.x,
                            savedData.scale.y,
                            savedData.scale.z
                        );
                    } else {
                        // Place new object on ground
                        container.position.set(
                            0,                  // Center X
                            bbox.min.y * -1,    // Place bottom on ground
                            0                   // Center Z
                        );
                    }
        
                    // Store reference to container
                    container.name = objectId;
                    container.userData.fileData = model.userData.fileData;
                    this.objects.set(objectId, container);
                    
                    // Select the container if it's new
                    if (!savedData) {
                        this.selectObject(container);
                    }
                    
                    this.updateObjectList();
                    this.saveSceneState();
        
                    URL.revokeObjectURL(url);
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
