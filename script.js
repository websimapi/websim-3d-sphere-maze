import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

// DOM elements
const gameContainer = document.getElementById('game-container');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const timerDisplay = document.getElementById('timer');
const levelDisplay = document.getElementById('level-display');
const successMessage = document.getElementById('success-message');

// Game state
let gameStarted = false;
let gameTime = 0;
let currentLevel = 1;
let gameLoop;
let lastTime = 0;

// Three.js setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x222222);
gameContainer.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Cannon.js physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Maze properties
const sphereRadius = 5;
let mazeMesh, mazeBody;
let ball, ballBody;
let targetMesh;
const ballRadius = 0.3;
const trackWidth = 0.5;
const trackDepth = 0.2;

// Materials
const ballMaterial = new CANNON.Material('ballMaterial');
const trackMaterial = new CANNON.Material('trackMaterial');

// Contact material (ball to track)
const ballToTrack = new CANNON.ContactMaterial(
    ballMaterial,
    trackMaterial,
    {
        friction: 0.3,
        restitution: 0.1
    }
);
world.addContactMaterial(ballToTrack);

// Camera setup
camera.position.set(0, 0, 15);
camera.lookAt(0, 0, 0);

// Debug controls (will be disabled in the actual game)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false; // Disable for actual gameplay

function createMazeLevel(level) {
    // Remove existing maze if there is one
    if (mazeMesh) {
        scene.remove(mazeMesh);
        world.removeBody(mazeBody);
    }
    
    // Create a group for the maze paths
    const mazeGroup = new THREE.Group();
    
    // Create the physics body for the maze
    mazeBody = new CANNON.Body({
        mass: 0, // Static body
        material: trackMaterial,
        type: CANNON.Body.STATIC
    });
    
    // Different maze patterns based on level
    let mazePaths = [];
    
    if (level === 1) {
        // Simple spiral for level 1
        const spiralSegments = 10;
        const spiralRadius = 4;
        const spiralDecrement = spiralRadius / spiralSegments;
        
        for (let i = 0; i < spiralSegments; i++) {
            const angle = (i / spiralSegments) * Math.PI * 2 * 3; // 3 turns
            const radius = spiralRadius - (i * spiralDecrement);
            
            mazePaths.push({
                type: 'arc',
                centerX: 0,
                centerY: 0,
                radius: radius,
                startAngle: angle,
                endAngle: angle + (Math.PI * 2 / 4), // 1/4 turn
                level: Math.sin(i * 0.5) * 0.5 // Varying height
            });
        }
        
        // Add a straight path to the center
        mazePaths.push({
            type: 'line',
            startX: 0.5,
            startY: 0,
            endX: 0,
            endY: 0,
            level: 0
        });
    } else if (level === 2) {
        // More complex maze for level 2 with branches
        // Main spiral
        const spiralSegments = 8;
        const spiralRadius = 4;
        const spiralDecrement = spiralRadius / spiralSegments;
        
        for (let i = 0; i < spiralSegments; i++) {
            const angle = (i / spiralSegments) * Math.PI * 2 * 2; // 2 turns
            const radius = spiralRadius - (i * spiralDecrement);
            
            mazePaths.push({
                type: 'arc',
                centerX: 0,
                centerY: 0,
                radius: radius,
                startAngle: angle,
                endAngle: angle + (Math.PI * 2 / 3), // 1/3 turn
                level: Math.sin(i * 0.7) * 1.0 // More height variation
            });
            
            // Add some branching paths (dead ends)
            if (i % 2 === 0) {
                const branchAngle = angle + (Math.PI * 2 / 8);
                const branchX = Math.cos(branchAngle) * radius;
                const branchY = Math.sin(branchAngle) * radius;
                const branchLength = 1 + (i * 0.2);
                
                mazePaths.push({
                    type: 'line',
                    startX: branchX,
                    startY: branchY,
                    endX: branchX + Math.cos(branchAngle) * branchLength,
                    endY: branchY + Math.sin(branchAngle) * branchLength,
                    level: Math.sin(i * 0.7) * 1.0
                });
            }
        }
        
        // Path to center
        mazePaths.push({
            type: 'line',
            startX: 1.0,
            startY: 0,
            endX: 0,
            endY: 0,
            level: -0.5
        });
    } else {
        // Level 3 - even more complex with intersecting paths
        // Create a star pattern with connecting bridges
        const points = 5;
        const outerRadius = 4;
        const innerRadius = 2;
        
        // Create star points
        for (let i = 0; i < points; i++) {
            const angle1 = (i / points) * Math.PI * 2;
            const angle2 = ((i + 1) / points) * Math.PI * 2;
            
            const outerX1 = Math.cos(angle1) * outerRadius;
            const outerY1 = Math.sin(angle1) * outerRadius;
            const outerX2 = Math.cos(angle2) * outerRadius;
            const outerY2 = Math.sin(angle2) * outerRadius;
            
            const innerX1 = Math.cos(angle1 + Math.PI/points) * innerRadius;
            const innerY1 = Math.sin(angle1 + Math.PI/points) * innerRadius;
            const innerX2 = Math.cos(angle2 + Math.PI/points) * innerRadius;
            const innerY2 = Math.sin(angle2 + Math.PI/points) * innerRadius;
            
            // Outer edge
            mazePaths.push({
                type: 'line',
                startX: outerX1,
                startY: outerY1,
                endX: outerX2,
                endY: outerY2,
                level: Math.sin(i * 1.2) * 1.5
            });
            
            // Inner edge
            mazePaths.push({
                type: 'line',
                startX: innerX1,
                startY: innerY1,
                endX: innerX2,
                endY: innerY2,
                level: Math.cos(i * 1.2) * 1.5
            });
            
            // Connecting spokes
            mazePaths.push({
                type: 'line',
                startX: outerX1,
                startY: outerY1,
                endX: innerX1,
                endY: innerY1,
                level: Math.sin(i * 1.2) * 1.5
            });
        }
        
        // Path to center from inner star
        mazePaths.push({
            type: 'line',
            startX: innerRadius * 0.5,
            startY: 0,
            endX: 0,
            endY: 0,
            level: 0
        });
    }
    
    // Create the 3D geometry for the paths
    mazePaths.forEach(path => {
        let points = [];
        
        if (path.type === 'line') {
            // Create a straight path
            points = [
                new THREE.Vector3(path.startX, path.level, path.startY),
                new THREE.Vector3(path.endX, path.level, path.endY)
            ];
            
            // Create physics for this track segment
            const start = new CANNON.Vec3(path.startX, path.level, path.startY);
            const end = new CANNON.Vec3(path.endX, path.level, path.endY);
            const direction = new CANNON.Vec3().copy(end).vsub(start);
            const length = direction.length();
            direction.normalize();
            
            // Create a box shape for the track
            const trackShape = new CANNON.Box(new CANNON.Vec3(length/2, trackDepth/2, trackWidth/2));
            
            // Calculate center point
            const center = new CANNON.Vec3().copy(start).vadd(end).scale(0.5);
            
            // Calculate quaternion for rotation
            const quat = new CANNON.Quaternion();
            const up = new CANNON.Vec3(0, 1, 0);
            
            // First, rotate to point in the right direction on the xz plane
            const xzDirection = new CANNON.Vec3(direction.x, 0, direction.z).normalize();
            const angle = Math.atan2(xzDirection.z, xzDirection.x);
            quat.setFromAxisAngle(up, angle);
            
            // Add shape directly to body
            mazeBody.addShape(trackShape, center, quat);
            
        } else if (path.type === 'arc') {
            // Create a curved path
            const segments = 20;
            const angleStep = (path.endAngle - path.startAngle) / segments;
            
            for (let i = 0; i <= segments; i++) {
                const angle = path.startAngle + (angleStep * i);
                const x = path.centerX + Math.cos(angle) * path.radius;
                const z = path.centerY + Math.sin(angle) * path.radius;
                points.push(new THREE.Vector3(x, path.level, z));
            }
            
            // Create physics for arc segments
            for (let i = 0; i < segments; i++) {
                const angle1 = path.startAngle + (angleStep * i);
                const angle2 = path.startAngle + (angleStep * (i + 1));
                
                const start = new CANNON.Vec3(
                    path.centerX + Math.cos(angle1) * path.radius,
                    path.level,
                    path.centerY + Math.sin(angle1) * path.radius
                );
                const end = new CANNON.Vec3(
                    path.centerX + Math.cos(angle2) * path.radius,
                    path.level,
                    path.centerY + Math.sin(angle2) * path.radius
                );
                
                const direction = new CANNON.Vec3().copy(end).vsub(start);
                const length = direction.length();
                direction.normalize();
                
                // Create a box shape for the track
                const trackShape = new CANNON.Box(new CANNON.Vec3(length/2, trackDepth/2, trackWidth/2));
                
                // Calculate center point
                const center = new CANNON.Vec3().copy(start).vadd(end).scale(0.5);
                
                // Calculate quaternion for rotation
                const quat = new CANNON.Quaternion();
                const up = new CANNON.Vec3(0, 1, 0);
                
                // First, rotate to point in the right direction on the xz plane
                const xzDirection = new CANNON.Vec3(direction.x, 0, direction.z).normalize();
                const angle = Math.atan2(xzDirection.z, xzDirection.x);
                quat.setFromAxisAngle(up, angle);
                
                // Add shape directly to body
                mazeBody.addShape(trackShape, center, quat);
            }
        }
        
        // Create the visual track geometry
        const curve = new THREE.CatmullRomCurve3(points);
        const geometry = new THREE.TubeGeometry(curve, points.length * 4, trackWidth/2, 8, false);
        const material = new THREE.MeshStandardMaterial({
            color: 0x999999,
            metalness: 0.8,
            roughness: 0.2
        });
        const tube = new THREE.Mesh(geometry, material);
        mazeGroup.add(tube);
    });
    
    // Add the maze to the scene
    mazeMesh = mazeGroup;
    scene.add(mazeMesh);
    
    // Add the physics body to the world
    world.addBody(mazeBody);
}

function createBall() {
    // Remove existing ball if there is one
    if (ball) {
        scene.remove(ball);
        world.removeBody(ballBody);
    }
    
    // Create the visual ball
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
        color: 0x3080FF,
        metalness: 1.0,
        roughness: 0.2
    });
    ball = new THREE.Mesh(ballGeometry, ballMat);
    scene.add(ball);
    
    // Create the physics body for the ball
    ballBody = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Sphere(ballRadius),
        material: ballMaterial,
        linearDamping: 0.3, // Add some damping to make the ball not roll forever
        angularDamping: 0.3
    });
    
    // Position the ball at the start position (outside edge of the maze)
    const startRadius = sphereRadius - 1;
    ballBody.position.set(startRadius, 0, 0);
    world.addBody(ballBody);
}

function createTarget() {
    // Create the target (goal) in the center
    const targetGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    const targetMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF4040,
        emissive: 0x802020,
        metalness: 0.3,
        roughness: 0.6
    });
    targetMesh = new THREE.Mesh(targetGeometry, targetMaterial);
    targetMesh.position.set(0, 0, 0);
    scene.add(targetMesh);
    
    // Make the target pulsate
    const targetAnimation = () => {
        targetMesh.scale.x = 1 + 0.2 * Math.sin(Date.now() * 0.003);
        targetMesh.scale.y = 1 + 0.2 * Math.sin(Date.now() * 0.003);
        targetMesh.scale.z = 1 + 0.2 * Math.sin(Date.now() * 0.003);
        requestAnimationFrame(targetAnimation);
    };
    targetAnimation();
}

function startGame() {
    // Hide the start screen
    startScreen.style.display = 'none';
    
    // Reset game state
    gameStarted = true;
    gameTime = 0;
    
    // Start with level 1
    currentLevel = 1;
    createMazeLevel(currentLevel);
    createBall();
    
    // Request device orientation permission and start listening for orientation changes
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requires permission
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    alert('Permission to access device orientation was denied');
                }
            })
            .catch(console.error);
    } else {
        // Non iOS 13+ devices
        window.addEventListener('deviceorientation', handleOrientation);
    }
    
    // Start the game loop if it's not already running
    if (!gameLoop) {
        lastTime = performance.now();
        gameLoop = requestAnimationFrame(updateGame);
    }
}

function handleOrientation(event) {
    if (!gameStarted) return;
    
    // Get the orientation angles
    let x = event.beta;  // -180 to 180 (front to back)
    let y = event.gamma; // -90 to 90 (left to right)
    let z = event.alpha; // 0 to 360 (compass direction)
    
    // Limit the angles to prevent extreme tilting
    x = Math.max(-45, Math.min(45, x));
    y = Math.max(-45, Math.min(45, y));
    
    // Update world gravity based on device orientation
    const gravityStrength = 12; // Adjust for desired sensitivity
    world.gravity.set(
        y / 45 * gravityStrength,
        -9.8, // Always maintain some downward pull
        x / 45 * gravityStrength
    );
    
    // Rotate the maze for visual effect (subtle tilt)
    if (mazeMesh) {
        mazeMesh.rotation.x = x * 0.02;
        mazeMesh.rotation.z = y * 0.02;
    }
}

function updateGame(time) {
    const delta = (time - lastTime) / 1000; // Convert to seconds
    lastTime = time;
    
    if (gameStarted) {
        // Update game time
        gameTime += delta;
        timerDisplay.textContent = `Time: ${gameTime.toFixed(1)}s`;
        
        // Update physics
        world.step(1/60, delta, 3);
        
        // Sync ball mesh with physics body
        ball.position.copy(ballBody.position);
        ball.quaternion.copy(ballBody.quaternion);
        
        // Check if ball has fallen off the maze
        if (ballBody.position.y < -10) {
            // Reset ball position
            createBall();
        }
        
        // Check if ball reached the target
        const distanceToTarget = new THREE.Vector3(
            ballBody.position.x,
            ballBody.position.y,
            ballBody.position.z
        ).distanceTo(new THREE.Vector3(0, 0, 0));
        
        if (distanceToTarget < 1.0) {
            // Level completed!
            showSuccessMessage();
        }
    }
    
    // Update controls if enabled
    if (controls.enabled) {
        controls.update();
    }
    
    // Render scene
    renderer.render(scene, camera);
    
    // Continue game loop
    gameLoop = requestAnimationFrame(updateGame);
}

function showSuccessMessage() {
    // Show success message
    successMessage.style.display = 'block';
    
    // Go to next level after delay
    setTimeout(() => {
        successMessage.style.display = 'none';
        
        // Increment level
        currentLevel++;
        if (currentLevel > 3) {
            currentLevel = 1; // Loop back to first level after completing all
        }
        
        levelDisplay.textContent = `Level: ${currentLevel}`;
        
        // Create new level
        createMazeLevel(currentLevel);
        createBall();
    }, 2000);
}

function onWindowResize() {
    // Update camera and renderer on window resize
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Initialize game
function initGame() {
    // Create the outer transparent sphere
    const outerGeometry = new THREE.SphereGeometry(sphereRadius + 0.2, 32, 32);
    const outerMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        roughness: 0.1,
        metalness: 0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        side: THREE.BackSide
    });
    const outerSphere = new THREE.Mesh(outerGeometry, outerMaterial);
    scene.add(outerSphere);
    
    // Create the maze within the sphere
    createMazeLevel(currentLevel);
    
    // Create the ball
    createBall();
    
    // Create the target
    createTarget();
    
    // Window resize handler
    onWindowResize();
    
    // Start animation
    requestAnimationFrame(updateGame);
}

initGame();

// Event listeners
window.addEventListener('resize', onWindowResize);
startButton.addEventListener('click', startGame);