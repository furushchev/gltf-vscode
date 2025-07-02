import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
  Engine,
  Scene,
  SceneLoader,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
} from 'babylonjs';
import 'babylonjs-loaders';
import * as Cesium from 'cesium/Cesium.js';

interface ViewerProps {
  file: File | null;
}

function ThreeViewer({ file }: ViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!file) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    if (!mountRef.current) return;
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(2, 2, 2);
    const controls = new OrbitControls(camera, renderer.domElement);

    const light = new THREE.AmbientLight(0xffffff);
    scene.add(light);

    const loader = new GLTFLoader();
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      loader.parse(arrayBuffer, '', (gltf: GLTF) => {
        scene.add(gltf.scene);
        animate();
      });
    };
    reader.readAsArrayBuffer(file);

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    return () => {
      if (!mountRef.current) return;
      while (mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
    };
  }, [file]);
  return <div style={{ width: '100%', height: '100%' }} ref={mountRef}></div>;
}

function BabylonViewer({ file }: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!file) return;
    if (!canvasRef.current) return;
    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);
    camera.attachControl(canvasRef.current, true);
    new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as ArrayBuffer;
      SceneLoader.Append('data:', data as any, scene, () => {
        engine.runRenderLoop(() => scene.render());
      });
    };
    reader.readAsArrayBuffer(file);

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      engine.dispose();
    };
  }, [file]);
  return <canvas style={{ width: '100%', height: '100%' }} ref={canvasRef}></canvas>;
}

function CesiumViewer({ file }: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer>();
  const modelRef = useRef<Cesium.Model>();
  const [articulations, setArticulations] = useState<any[]>([]);
  const [selected, setSelected] = useState<number>(0);
  const [stageValues, setStageValues] = useState<number[]>([]);

  useEffect(() => {
    if (!file || !containerRef.current) return;
    (window as any).CESIUM_BASE_URL = './';
    const viewer = new Cesium.Viewer(containerRef.current, {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      geocoder: false,
      infoBox: false,
      selectionIndicator: false,
    });
    viewerRef.current = viewer;

    Cesium.Model.fromGltfAsync({ url: URL.createObjectURL(file), scale: 100 })
      .then((m) => {
        modelRef.current = m;
        viewer.scene.primitives.add(m as any);
        viewer.zoomTo(m);
        const anyModel: any = m;
        const arts = anyModel.loader?.components?.articulations ?? [];
        setArticulations(arts);
        if (arts.length) {
          setSelected(0);
          setStageValues(arts[0].stages.map((s: any) => s.initialValue));
        }
      })
      .catch((e) => console.error(e));

    const handleResize = () => viewer.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      viewer.destroy();
    };
  }, [file]);

  const active = articulations[selected];

  const changeStage = (idx: number, value: number) => {
    if (!active || !modelRef.current) return;
    const newValues = [...stageValues];
    newValues[idx] = value;
    setStageValues(newValues);
    const stage = active.stages[idx];
    modelRef.current.setArticulationStage(
      `${active.name} ${stage.name}`,
      value
    );
    modelRef.current.applyArticulations();
  };

  useEffect(() => {
    if (active) {
      setStageValues(active.stages.map((s: any) => s.initialValue));
    }
  }, [selected]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {active && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(255,255,255,0.8)',
            padding: 8,
          }}
        >
          <select
            value={selected}
            onChange={(e) => setSelected(parseInt(e.target.value, 10))}
          >
            {articulations.map((a, i) => (
              <option key={i} value={i}>
                {a.name}
              </option>
            ))}
          </select>
          {active.stages.map((stage: any, i: number) => (
            <div key={i}>
              <label>
                {stage.name}: {stageValues[i].toFixed(2)}
              </label>
              <input
                type="range"
                min={stage.minimumValue}
                max={stage.maximumValue}
                step="0.01"
                value={stageValues[i]}
                onChange={(e) =>
                  changeStage(i, parseFloat(e.target.value))
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [engine, setEngine] = useState<'three' | 'babylon' | 'cesium'>('three');
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files ? e.target.files[0] : null);
  };
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px' }}>
        <input type="file" accept=".gltf,.glb" onChange={handleFileChange} />
        <select
          value={engine}
          onChange={(e) =>
            setEngine(e.target.value as 'three' | 'babylon' | 'cesium')
          }
        >
          <option value="three">Three.js</option>
          <option value="babylon">Babylon.js</option>
          <option value="cesium">CesiumJS</option>
        </select>
      </div>
      <div style={{ flex: 1 }}>
        {engine === 'three' ? (
          <ThreeViewer file={file} />
        ) : engine === 'babylon' ? (
          <BabylonViewer file={file} />
        ) : (
          <CesiumViewer file={file} />
        )}
      </div>
    </div>
  );
}

const rootEl = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootEl);
root.render(<App />);
