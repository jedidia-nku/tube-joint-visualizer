import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Plus, Trash2, Maximize2 } from 'lucide-react';

// Tube class to manage individual tubes
class Tube {
  width: number;
  height: number;
  thickness: number;
  length: number;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  mesh: THREE.Mesh | null;
  wireframe: THREE.LineSegments | null;
  id: string;

  constructor(
    width: number,
    height: number,
    thickness: number,
    length: number,
    position: THREE.Vector3,
    rotation: THREE.Euler
  ) {
    this.width = width;
    this.height = height;
    this.thickness = thickness;
    this.length = length;
    this.position = position;
    this.rotation = rotation;
    this.mesh = null;
    this.wireframe = null;
    this.id = Math.random().toString(36).substr(2, 9);
  }

  createGeometry(): THREE.ExtrudeGeometry {
    const shape = new THREE.Shape();
    const hw = this.width / 2;
    const hh = this.height / 2;
    
    // Outer rectangle
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.lineTo(-hw, -hh);
    
    // Inner rectangle (hole)
    const hole = new THREE.Path();
    const ihw = hw - this.thickness;
    const ihh = hh - this.thickness;
    hole.moveTo(-ihw, -ihh);
    hole.lineTo(ihw, -ihh);
    hole.lineTo(ihw, ihh);
    hole.lineTo(-ihw, ihh);
    hole.lineTo(-ihw, -ihh);
    shape.holes.push(hole);
    
    const extrudeSettings = {
      steps: 1,
      depth: this.length,
      bevelEnabled: false
    };
    
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }

  createMesh(): THREE.Mesh {
    const geometry = this.createGeometry();
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x4488ff,
      metalness: 0.5,
      roughness: 0.5
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);
    this.mesh.userData.tubeId = this.id;
    
    // Center the tube
    this.mesh.geometry.translate(0, 0, -this.length / 2);
    
    // Create wireframe
    const wireframeGeometry = new THREE.EdgesGeometry(geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    this.wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    this.wireframe.position.copy(this.position);
    this.wireframe.rotation.copy(this.rotation);
    this.wireframe.geometry.translate(0, 0, -this.length / 2);
    
    return this.mesh;
  }
}

interface CameraControls {
  isDragging: boolean;
  previousMousePosition: { x: number; y: number };
  rotationSpeed: number;
  zoomSpeed: number;
}

export default function TubeJointVisualizer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<CameraControls | null>(null);
  
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [selectedTube, setSelectedTube] = useState<string | null>(null);
  const [showWireframe, setShowWireframe] = useState(true);
  const [showSolid, setShowSolid] = useState(true);
  
  // Tube parameters
  const [tubeType, setTubeType] = useState('rectangular');
  const [width, setWidth] = useState(50);
  const [height, setHeight] = useState(30);
  const [thickness, setThickness] = useState(3);
  const [length, setLength] = useState(100);
  const [angle, setAngle] = useState(90);
  
  useEffect(() => {
    if (!mountRef.current) return;
    
    // CLEANUP START: Remove any existing canvas before creating a new one
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      2000
    );
    camera.position.set(200, 200, 200);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(500, 50, 0x888888, 0xcccccc);
    scene.add(gridHelper);
    
    // Axes helper
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);
    
    // Basic orbit controls
    const controls: CameraControls = {
      isDragging: false,
      previousMousePosition: { x: 0, y: 0 },
      rotationSpeed: 0.005,
      zoomSpeed: 0.1
    };
    controlsRef.current = controls;
    
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        controls.isDragging = true;
        controls.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (controls.isDragging && cameraRef.current) {
        const deltaX = e.clientX - controls.previousMousePosition.x;
        const deltaY = e.clientY - controls.previousMousePosition.y;
        
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(cameraRef.current.position);
        
        spherical.theta -= deltaX * controls.rotationSpeed;
        spherical.phi -= deltaY * controls.rotationSpeed;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        cameraRef.current.position.setFromSpherical(spherical);
        cameraRef.current.lookAt(0, 0, 0);
        
        controls.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };
    
    const onMouseUp = () => {
      controls.isDragging = false;
    };
    
    const onWheel = (e: WheelEvent) => {
      if (!cameraRef.current) return;
      e.preventDefault();
      const zoomDelta = e.deltaY * controls.zoomSpeed;
      cameraRef.current.position.multiplyScalar(1 + zoomDelta * 0.01);
    };
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);
    
    // Animation loop (With ID tracking)
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    
    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      // Stop the loop
      cancelAnimationFrame(animationFrameId);
      
      if (rendererRef.current) {
        rendererRef.current.domElement.removeEventListener('mousedown', onMouseDown);
        rendererRef.current.domElement.removeEventListener('mousemove', onMouseMove);
        rendererRef.current.domElement.removeEventListener('mouseup', onMouseUp);
        rendererRef.current.domElement.removeEventListener('wheel', onWheel);
        
        // Remove the canvas
        rendererRef.current.dispose();
        if (mountRef.current && mountRef.current.contains(rendererRef.current.domElement)) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, []);
  
  // Update tube visibility based on wireframe/solid toggles
  useEffect(() => {
    if (!sceneRef.current) return;
    
    tubes.forEach(tube => {
      if (tube.mesh) {
        tube.mesh.visible = showSolid;
      }
      if (tube.wireframe) {
        tube.wireframe.visible = showWireframe;
      }
    });
  }, [showWireframe, showSolid, tubes]);
  
  const addTube = () => {
    if (!sceneRef.current) return;
    
    const newTube = new Tube(
      tubeType === 'square' ? width : width,
      tubeType === 'square' ? width : height,
      thickness,
      length,
      new THREE.Vector3(0, 0, 0),
      new THREE.Euler(0, 0, 0)
    );
    
    const mesh = newTube.createMesh();
    
    if (tubes.length > 0) {
      // Position new tube at an angle relative to the last tube
      const lastTube = tubes[tubes.length - 1];
      const angleRad = (angle * Math.PI) / 180;
      
      // Position at the end of the last tube
      const offset = new THREE.Vector3(0, 0, lastTube.length / 2);
      offset.applyEuler(lastTube.rotation);
      
      newTube.position.copy(lastTube.position).add(offset);
      
      // Rotate based on selected angle
      newTube.rotation.set(
        lastTube.rotation.x,
        lastTube.rotation.y + angleRad,
        lastTube.rotation.z
      );
      
      mesh.position.copy(newTube.position);
      mesh.rotation.copy(newTube.rotation);
      if (newTube.wireframe) {
        newTube.wireframe.position.copy(newTube.position);
        newTube.wireframe.rotation.copy(newTube.rotation);
      }
    }
    
    sceneRef.current.add(mesh);
    if (newTube.wireframe) {
      sceneRef.current.add(newTube.wireframe);
    }
    
    setTubes([...tubes, newTube]);
  };
  
  const removeTube = (tubeId: string) => {
    if (!sceneRef.current) return;
    
    const tube = tubes.find(t => t.id === tubeId);
    if (tube) {
      if (tube.mesh) sceneRef.current.remove(tube.mesh);
      if (tube.wireframe) sceneRef.current.remove(tube.wireframe);
      setTubes(tubes.filter(t => t.id !== tubeId));
      if (selectedTube === tubeId) setSelectedTube(null);
    }
  };
  
  const clearAll = () => {
    if (!sceneRef.current) return;
    
    tubes.forEach(tube => {
      if (tube.mesh) sceneRef.current!.remove(tube.mesh);
      if (tube.wireframe) sceneRef.current!.remove(tube.wireframe);
    });
    setTubes([]);
    setSelectedTube(null);
  };
  
  const resetCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.position.set(200, 200, 200);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Panel - Controls */}
      <div className="w-80 bg-white shadow-lg overflow-y-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">Tube Joint Visualizer</h1>
        
        {/* Tube Type */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2 text-gray-700">Tube Type</label>
          <select 
            value={tubeType} 
            onChange={(e) => setTubeType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rectangular">Rectangular</option>
            <option value="square">Square</option>
          </select>
        </div>
        
        {/* Dimensions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">Dimensions (mm)</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1 text-gray-600">Width</label>
              <input 
                type="number" 
                value={width} 
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {tubeType === 'rectangular' && (
              <div>
                <label className="block text-xs mb-1 text-gray-600">Height</label>
                <input 
                  type="number" 
                  value={height} 
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            
            <div>
              <label className="block text-xs mb-1 text-gray-600">Thickness</label>
              <input 
                type="number" 
                value={thickness} 
                onChange={(e) => setThickness(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-xs mb-1 text-gray-600">Length</label>
              <input 
                type="number" 
                value={length} 
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* Joint Angle */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2 text-gray-700">Joint Angle (degrees)</label>
          <div className="flex gap-2 mb-2">
            {[45, 90, 135, 180].map(a => (
              <button
                key={a}
                onClick={() => setAngle(a)}
                className={`flex-1 py-2 rounded ${angle === a ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                {a}°
              </button>
            ))}
          </div>
          <input 
            type="range" 
            min="0" 
            max="180" 
            value={angle} 
            onChange={(e) => setAngle(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-center text-sm text-gray-600 mt-1">{angle}°</div>
        </div>
        
        {/* View Controls */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">View Options</h3>
          <div className="space-y-2">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={showSolid} 
                onChange={(e) => setShowSolid(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Show Solid</span>
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={showWireframe} 
                onChange={(e) => setShowWireframe(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Show Wireframe</span>
            </label>
          </div>
        </div>
        
        {/* Actions */}
        <div className="space-y-2 mb-6">
          <button 
            onClick={addTube}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={20} />
            Add Tube
          </button>
          
          <button 
            onClick={resetCamera}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Maximize2 size={20} />
            Reset View
          </button>
          
          <button 
            onClick={clearAll}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 size={20} />
            Clear All
          </button>
        </div>
        
        {/* Tube List */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-700">Tubes ({tubes.length})</h3>
          <div className="space-y-2">
            {tubes.map((tube, index) => (
              <div 
                key={tube.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <span className="text-sm text-gray-700">Tube {index + 1}</span>
                <button 
                  onClick={() => removeTube(tube.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
        
        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-semibold mb-2 text-blue-900">Controls:</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Middle mouse + drag to rotate</li>
            <li>• Scroll to zoom</li>
            <li>• Shift + left mouse to rotate</li>
          </ul>
        </div>
      </div>
      
      {/* Right Panel - 3D Viewport */}
      <div className="flex-1 relative">
        <div ref={mountRef} className="w-full h-full" />
        
        {/* Info overlay */}
        <div className="absolute top-4 right-4 bg-white bg-opacity-90 p-4 rounded-lg shadow-lg">
          <div className="text-sm text-gray-700">
            <div>Tubes: {tubes.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}