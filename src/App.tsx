import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Plus, Trash2, Maximize2, Undo, Redo, Save } from 'lucide-react';

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
  highlightMesh: THREE.Mesh | null;
  id: string;
  isSelected: boolean;

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
    this.highlightMesh = null;
    this.id = Math.random().toString(36).substr(2, 9);
    this.isSelected = false;
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
      roughness: 0.5,
      side: THREE.DoubleSide
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
    
    // Create highlight mesh
    const highlightMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffff00, 
      transparent: true, 
      opacity: 0.3,
      depthTest: false,
      depthWrite: false
    });
    this.highlightMesh = new THREE.Mesh(geometry.clone(), highlightMaterial);
    this.highlightMesh.position.copy(this.position);
    this.highlightMesh.rotation.copy(this.rotation);
    this.highlightMesh.geometry.translate(0, 0, -this.length / 2);
    this.highlightMesh.visible = false;
    this.highlightMesh.renderOrder = 1;

    return this.mesh;
  }

  setSelected(selected: boolean): void {
    this.isSelected = selected;
    if (this.highlightMesh) {
      this.highlightMesh.visible = selected;
    }
  }

  clone(): Tube {
  const clonedTube = new Tube(
    this.width,
    this.height,
    this.thickness,
    this.length,
    this.position.clone(),
    this.rotation.clone()
  );
  clonedTube.id = this.id;
  clonedTube.isSelected = this.isSelected;
  return clonedTube;
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
  
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const tubesRef = useRef<Tube[]>([]);
  const draggedTubeRef = useRef<string | null>(null);

  const [tubes, setTubes] = useState<Tube[]>([]);
  const [selectedTube, setSelectedTube] = useState<string | null>(null);
  const [showWireframe, setShowWireframe] = useState(true);
  const [showSolid, setShowSolid] = useState(true);
  const [draggedTube, setDraggedTube] = useState<string | null>(null); 
  
  // Tube parameters
  const [tubeType, setTubeType] = useState('rectangular');
  const [width, setWidth] = useState(50);
  const [height, setHeight] = useState(30);
  const [thickness, setThickness] = useState(3);
  const [length, setLength] = useState(100);
  const [angle, setAngle] = useState(90);
  const [snapToAngle, setSnapToAngle] = useState(true);

  const [history, setHistory] = useState<Tube[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Main Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Cleanup
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // Scene, Camera, Renderer setup...
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 2000);
    camera.position.set(200, 200, 200);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Lights & Helpers...
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);
    scene.add(new THREE.GridHelper(500, 50, 0x888888, 0xcccccc));
    scene.add(new THREE.AxesHelper(100));
    
    // Controls setup
    const controls: CameraControls = {
      isDragging: false,
      previousMousePosition: { x: 0, y: 0 },
      rotationSpeed: 0.005,
      zoomSpeed: 0.1
    };
    controlsRef.current = controls;

    // --- MOUSE EVENTS START ---

    const onMouseDown = (e: MouseEvent) => {
      if (!cameraRef.current || !rendererRef.current) return;
      
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Left Click: Select or Start Drag
      if (e.button === 0 && !e.shiftKey) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        
        // Use Ref for latest tubes
        const meshes = tubesRef.current
          .map(t => t.mesh)
          .filter((m): m is THREE.Mesh => m !== null);

        const intersects = raycasterRef.current.intersectObjects(meshes);
        
        if (intersects.length > 0) {
          const tubeId = intersects[0].object.userData.tubeId as string;
          setSelectedTube(tubeId);
          
          // START DRAG
          draggedTubeRef.current = tubeId;
          setDraggedTube(tubeId); // Update UI state
          controls.isDragging = false; // Ensure we don't rotate camera while dragging object
        } else {
          setSelectedTube(null);
        }
      }
      
      // Middle Click or Shift+Click: Rotate Camera
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        controls.isDragging = true;
        controls.previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!cameraRef.current || !rendererRef.current) return;

      // 1. HANDLE OBJECT DRAGGING
      if (draggedTubeRef.current) {
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        
        // Create an imaginary floor plane at height 0 to drag along
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        raycasterRef.current.ray.intersectPlane(plane, intersection);

        if (intersection) {
          // Update State (React) AND Ref (Three.js)
          setTubes(prevTubes => {
             const newTubes = prevTubes.map(tube => {
              if (tube.id === draggedTubeRef.current) {
                // Update logic position
                tube.position.copy(intersection);
                
                // Update visual meshes immediately
                if (tube.mesh) tube.mesh.position.copy(intersection);
                if (tube.wireframe) tube.wireframe.position.copy(intersection);
                if (tube.highlightMesh) tube.highlightMesh.position.copy(intersection);
              }
              return tube;
            });
            // Update the ref immediately so the next mousemove sees it
            tubesRef.current = newTubes;
            return newTubes;
          });
        }
        return; // Don't rotate camera if dragging object
      }

      // 2. HANDLE CAMERA ROTATION
      if (controls.isDragging) {
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
      if (draggedTubeRef.current) {
        addToHistory(tubesRef.current); 
      }
      draggedTubeRef.current = null;
      setDraggedTube(null);
    };
    
    const onWheel = (e: WheelEvent) => {
      if (!cameraRef.current) return;
      e.preventDefault();
      const zoomDelta = e.deltaY * controls.zoomSpeed;
      cameraRef.current.position.multiplyScalar(1 + zoomDelta * 0.01);
    };
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove); // Window ensures drag continues if mouse leaves canvas
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);
    
    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      
      if (rendererRef.current) {
        rendererRef.current.domElement.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        rendererRef.current.domElement.removeEventListener('wheel', onWheel);
        rendererRef.current.dispose();
        if (mountRef.current && mountRef.current.contains(rendererRef.current.domElement)) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, []);
  
  useEffect(() => {
      tubesRef.current = tubes;
    }, [tubes]);

  // Update tube visibility based on wireframe/solid toggles
  useEffect(() => {
    if (!sceneRef.current) return;
    
    tubes.forEach(tube => {
      if (tube.mesh) {
        (tube.mesh.material as THREE.Material).visible = showSolid;
        tube.mesh.visible = true;
      }
      if (tube.wireframe) {
        tube.wireframe.visible = showWireframe;
      }
    });
  }, [showWireframe, showSolid, tubes]);

useEffect(() => {
  tubes.forEach(tube => {
    tube.setSelected(tube.id === selectedTube);
  });
}, [selectedTube, tubes]);
  
const snapAngleFunc = (angleValue: number): number => {
    if (!snapToAngle) return angleValue;
    const snapAngles = [0, 30, 45, 60, 90, 120, 135, 150, 180];
    return snapAngles.reduce((prev, curr) => 
      Math.abs(curr - angleValue) < Math.abs(prev - angleValue) ? curr : prev
    );
  };


const addToHistory = (tubesToSave: Tube[] = tubes) => {
  const snapshot = tubesToSave.map(t => t.clone());
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(snapshot);
  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
};

const undo = () => {
  if (historyIndex > 0) {
    const previousState = history[historyIndex - 1];
    restoreState(previousState);
    setHistoryIndex(historyIndex - 1);
  }
};

const redo = () => {
  if (historyIndex < history.length - 1) {
    const nextState = history[historyIndex + 1];
    restoreState(nextState);
    setHistoryIndex(historyIndex + 1);
  }
};

const exportData = () => {
  const data = tubes.map(tube => ({
    type: tubeType, // Optional: might be useful to save the type (square/rect)
    width: tube.width,
    height: tube.height,
    thickness: tube.thickness,
    length: tube.length,
    position: { x: tube.position.x, y: tube.position.y, z: tube.position.z },
    rotation: { x: tube.rotation.x, y: tube.rotation.y, z: tube.rotation.z }
  }));
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tube-assembly-${Date.now()}.json`;
  document.body.appendChild(a); // Safer for some browsers
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const restoreState = (state: Tube[]) => {
  if (!sceneRef.current) return;
  
  // Remove current tubes from scene
  tubes.forEach(tube => {
    if (tube.mesh) sceneRef.current!.remove(tube.mesh);
    if (tube.wireframe) sceneRef.current!.remove(tube.wireframe);
    if (tube.highlightMesh) sceneRef.current!.remove(tube.highlightMesh);
  });
  
  // Restore tubes from history
  const restoredTubes = state.map(tubeData => {
    const tube = new Tube(
      tubeData.width,
      tubeData.height,
      tubeData.thickness,
      tubeData.length,
      tubeData.position,
      tubeData.rotation
    );
    tube.id = tubeData.id;
    tube.createMesh();
    
    if (sceneRef.current) {
      sceneRef.current.add(tube.mesh!);
      sceneRef.current.add(tube.wireframe!);
      sceneRef.current.add(tube.highlightMesh!);
    }
    return tube;
  });
  
  setTubes(restoredTubes);
};

  const addTube = () => {
    if (!sceneRef.current) return;

    const finalAngle = snapToAngle ? snapAngleFunc(angle) : angle;

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
      const lastTube = tubes[tubes.length - 1];
      const angleRad = (finalAngle * Math.PI) / 180;
      
      const jointPosition = new THREE.Vector3(0, 0, lastTube.length / 2);
      jointPosition.applyEuler(lastTube.rotation);
      jointPosition.add(lastTube.position);

      newTube.rotation.set(
        lastTube.rotation.x,
        lastTube.rotation.y + angleRad,
        lastTube.rotation.z
      );

      const offsetFromJoint = new THREE.Vector3(0, 0, newTube.length / 2);
      offsetFromJoint.applyEuler(newTube.rotation);
      
      newTube.position.copy(jointPosition).add(offsetFromJoint);
      
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
    if (newTube.highlightMesh) {
      sceneRef.current.add(newTube.highlightMesh);
    }

    const newTubesList = [...tubes, newTube];
    setTubes(newTubesList);
    addToHistory(newTubesList);
  };
  
  const removeTube = (tubeId: string) => {
    if (!sceneRef.current) return;

    const filteredTubes = tubes.filter(t => t.id !== tubeId);

    const tube = tubes.find(t => t.id === tubeId);
    if (tube) {
      if (tube.mesh) sceneRef.current.remove(tube.mesh);
      if (tube.wireframe) sceneRef.current.remove(tube.wireframe);
      if (tube.highlightMesh) sceneRef.current.remove(tube.highlightMesh);

      setTubes(filteredTubes);
      if (selectedTube === tubeId) setSelectedTube(null);
      addToHistory(filteredTubes);
    }
  };
  
  const clearAll = () => {
    if (!sceneRef.current) return;
    
    tubes.forEach(tube => {
      if (tube.mesh) sceneRef.current!.remove(tube.mesh);
      if (tube.wireframe) sceneRef.current!.remove(tube.wireframe);
      if (tube.highlightMesh) sceneRef.current!.remove(tube.highlightMesh);
    });
    setTubes([]);
    setSelectedTube(null);
    setHistory([]);
    setHistoryIndex(-1);
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
         <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-semibold text-gray-700">Joint Angle (degrees)</label>
            <label className="flex items-center text-xs">
              <input 
                type="checkbox" 
                checked={snapToAngle} 
                onChange={(e) => setSnapToAngle(e.target.checked)}
                className="mr-1"
              />
              Snap
            </label>
          </div>
          <div className="flex gap-2 mb-2">
            {[30, 45, 90, 135, 180].map(a => (
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
            <div className="flex gap-2">  {/* ADD this div */}
              <button 
                onClick={undo}
                disabled={historyIndex <= 0}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Undo size={18} />
                Undo
              </button>
              <button 
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Redo size={18} />
                Redo
              </button>
            </div>
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
        <div className="my-2"> 
          <button 
            onClick={exportData}
            disabled={tubes.length === 0}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Save size={18} />
            Export Assembly
          </button>
        </div>

        {/* Tube List */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-gray-700">Tubes ({tubes.length})</h3>
          <div className="space-y-2">
            {tubes.map((tube, index) => (
              <div 
                key={tube.id}
                onClick={() => setSelectedTube(tube.id)}
                // USE draggingTube HERE:
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  // If this tube is being dragged:
                  draggedTube === tube.id 
                    ? 'bg-blue-100 border-blue-400 cursor-grabbing shadow-inner' 
                    : selectedTube === tube.id 
                      ? 'bg-blue-50 border-blue-300 cursor-pointer' 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Tube {index + 1}</span>
                  {/* Optional: Add a text label if dragging */}
                  {draggedTube === tube.id && (
                    <span className="text-xs text-blue-600 font-bold animate-pulse">(Dragging)</span>
                  )}
                </div>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTube(tube.id);
                  }}
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