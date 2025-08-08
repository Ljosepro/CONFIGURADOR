import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import Particles from "react-tsparticles";
import { loadFull } from "tsparticles";
import { getPayuSignature } from './api';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import type { ReactPayPalScriptOptions } from '@paypal/react-paypal-js';
import Swal from 'sweetalert2';

// Tipos para los objetos seleccionables
interface Selectable {
  chasis: THREE.Mesh[];
  knobs: THREE.Mesh[];
}

interface ChosenColors {
  type: string;
  chasis: string;
  knobs: Record<string, string>;
}

interface PaletteColor {
  hex: string;
}

interface Palettes {
  chasis: Record<string, PaletteColor>;
  knobs: Record<string, PaletteColor>;
}

const LoopoConfigurator: React.FC<{ onProductChange?: (product: 'beato' | 'knobo' | 'mixo' | 'beato16' | 'loopo') => void }> = ({ onProductChange }) => {
  // Referencias para Three.js
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const modelRef = useRef<THREE.Group | null>(null);

  // Estados de React
  const [currentView, setCurrentView] = useState<'normal' | 'chasis' | 'knobs'>('normal');
  const [selectedForColoring, setSelectedForColoring] = useState<THREE.Mesh | null>(null);
  const [chosenColors, setChosenColors] = useState<ChosenColors>(() => {
    const saved = localStorage.getItem('loopo_chosenColors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved colors:', e);
      }
    }
    return {
      type: 'configUpdate',
      chasis: 'Azul',
      knobs: {}
    };
  });
  const [selectable, setSelectable] = useState<Selectable>({ chasis: [], knobs: [] });

  // Configuración de paletas
  const PALETTES: Palettes = {
    chasis: {
      'Verde':     { hex: '#7CBA40' },
      'Amarillo':  { hex: '#F3E600' },
      'Azul':      { hex: '#325EB7' },
      'Blanco':    { hex: '#F5F5F5' },
      'Naranja':   { hex: '#F47119' },
      'Morado':    { hex: '#7B217E' },
      'Rojo':      { hex: '#E52421' },
      'Negro':     { hex: '#1C1C1C' },
      'Rosa':      { hex: '#FF007F' },
      'Gris':      { hex: '#808080' },
    },
    knobs: {
      'Verde':     { hex: '#7CBA40' },
      'Amarillo':  { hex: '#F3E600' },
      'Azul':      { hex: '#325EB7' },
      'Blanco':    { hex: '#F5F5F5' },
      'Naranja':   { hex: '#F47119' },
      'Morado':    { hex: '#7B217E' },
      'Rojo':      { hex: '#E52421' },
      'Negro':     { hex: '#1C1C1C' },
      'Rosa':      { hex: '#FF007F' },
      'Gris':      { hex: '#808080' },
    }
  };

  const CAMERA_VIEWS = {
    normal: { pos: new THREE.Vector3(2, 1, 0), target: new THREE.Vector3(0, -0.3, 0) },
    top:    { pos: new THREE.Vector3(1, 1.95, -0.3), target: new THREE.Vector3(-0.35, -1, -0.3) },
  };

  // Configuración de iluminación profesional
  const setupProfessionalLighting = useCallback((scene: THREE.Scene, renderer: THREE.WebGLRenderer) => {
    // Luz ambiental suave
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Luz direccional principal
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 4, -1);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 4096;
    mainLight.shadow.mapSize.height = 4096;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.normalBias = 0.02;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);

    // Luz de relleno fría
    const fillLight = new THREE.DirectionalLight(0x99ccff, 0.8);
    fillLight.position.set(-8, 3, -9);
    scene.add(fillLight);

    // Luz de relleno adicional
    const fillLight2 = new THREE.DirectionalLight(0x99ccff, 0.8);
    fillLight2.position.set(-8, 3, 15);
    scene.add(fillLight2);

    // Luz puntual para brillos
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 0.5);
    pointLight.position.set(0, 5, 5);
    scene.add(pointLight);

    // Luz de contorno trasera
    const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
    backLight.position.set(-5, 30, 0);
    backLight.castShadow = true;
    backLight.shadow.mapSize.width = 2048;
    backLight.shadow.mapSize.height = 2048;
    backLight.shadow.camera.near = 0.5;
    backLight.shadow.camera.far = 50;
    backLight.shadow.normalBias = 0.02;
    backLight.shadow.bias = -0.001;
    scene.add(backLight);

    // Luz de acento para detalles
    const accentLight = new THREE.SpotLight(0xffffff, 0.3, 10, Math.PI / 6, 0.5);
    accentLight.position.set(0, 8, 2);
    accentLight.target.position.set(0, 0, 0);
    scene.add(accentLight);
    scene.add(accentLight.target);
  }, []);

  // Función para centrar y escalar el modelo
  const centerAndScaleModel = useCallback((obj: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const desiredSize = 1.8;
    const scale = desiredSize / maxSize;
    
    obj.scale.set(scale, scale, scale);
    obj.position.copy(center).multiplyScalar(-scale);
    obj.position.y -= (size.y / 2) * scale;
  }, []);

  // Preparar partes del modelo
  const prepareModelParts = useCallback((model: THREE.Group) => {
    const newSelectable: Selectable = { chasis: [], knobs: [] };
    const newChosenColors: ChosenColors = {
      type: 'configUpdate',
      chasis: 'Azul',
      knobs: {}
    };

    model.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const meshName = typeof child.name === 'string' ? child.name.toLowerCase() : '';

      if (meshName.includes('cubechasis')) {
        child.material = new THREE.MeshPhysicalMaterial({ 
          color: PALETTES.chasis['Azul'].hex, 
          metalness: 1,
          roughness: 0.6,
          clearcoat: 0.3,
          clearcoatRoughness: 0.1,
          reflectivity: 1.0
        });
        newSelectable.chasis.push(child);
        newChosenColors.chasis = 'Azul';
      }
      else if (meshName.includes('knob1') || meshName.includes('knob2') || meshName.includes('knob3') || meshName.includes('knob4')) {
        if ((child.material as THREE.MeshStandardMaterial)?.color) {
          const mat = child.material as THREE.MeshStandardMaterial;
          const lightness = (mat.color.r + mat.color.g + mat.color.b) / 3;
                     if (lightness < 0.5) {
             const defaultColor = 'Rosa';
             child.material = new THREE.MeshPhysicalMaterial({ 
               color: PALETTES.knobs[defaultColor].hex, 
               metalness: 0, 
               roughness: 1,
               clearcoat: 0.5,
               clearcoatRoughness: 0.2
             });
             newSelectable.knobs.push(child);
             newChosenColors.knobs[child.name] = defaultColor;
           } else {
             child.material = new THREE.MeshPhysicalMaterial({ 
               color: 0xffffff,
               clearcoat: 0.8,
               clearcoatRoughness: 0.1,
               roughness: 0.2
             });
           }
        }
      }
    });

    setSelectable(newSelectable);
    setChosenColors(newChosenColors);
  }, []);

  // Cargar modelo
  const loadModel = useCallback(async () => {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      
      loader.load('./models/loopo.glb', (gltf: any) => {
        console.log('LoopoConfigurator: Modelo cargado exitosamente');
        const model = gltf.scene as THREE.Group;
        modelRef.current = model;
        prepareModelParts(model);
        centerAndScaleModel(model);
        sceneRef.current?.add(model);
      }, undefined, (error: any) => {
        console.error('ERROR AL CARGAR EL MODELO:', error);
      });
    } catch (error) {
      console.error('Error importing GLTFLoader:', error);
    }
  }, [prepareModelParts, centerAndScaleModel]);

  // Inicialización de Three.js
  useEffect(() => {
    if (!mountRef.current) return;

    // Crear escena
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x000000, 10, 50);
    sceneRef.current = scene;

    // Crear renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Crear cámara
    const camera = new THREE.PerspectiveCamera(
      35, 
      mountRef.current.clientWidth / mountRef.current.clientHeight, 
      0.1, 
      200
    );
    camera.position.copy(CAMERA_VIEWS.normal.pos);
    cameraRef.current = camera;

    // Crear controles
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(CAMERA_VIEWS.normal.target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 2;
      controls.maxDistance = 5;
      controls.enablePan = false;
      controlsRef.current = controls;
    });

    setupProfessionalLighting(scene, renderer);
    loadModel();

    // Bucle de animación
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [setupProfessionalLighting, loadModel]);

  // Manejo de redimensionamiento
  useEffect(() => {
    const handleResize = () => {
      if (mountRef.current && cameraRef.current && rendererRef.current) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Guardar configuraciones en localStorage
  useEffect(() => {
    localStorage.setItem('loopo_currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem('loopo_chosenColors', JSON.stringify(chosenColors));
  }, [chosenColors]);

  // Aplicar colores guardados
  useEffect(() => {
    if (selectable.chasis.length > 0 || selectable.knobs.length > 0) {
      // Aplicar color del chasis
      if (chosenColors.chasis && PALETTES.chasis[chosenColors.chasis]) {
        const colorHex = PALETTES.chasis[chosenColors.chasis].hex;
        selectable.chasis.forEach(mesh => {
          if (mesh.material && 'color' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).color.setHex(parseInt(colorHex.replace('#', ''), 16));
          }
        });
      }

      // Aplicar colores de knobs
      Object.entries(chosenColors.knobs).forEach(([knobName, colorName]) => {
        if (PALETTES.knobs[colorName]) {
          const colorHex = PALETTES.knobs[colorName].hex;
          const knobMesh = selectable.knobs.find(knob => knob.name === knobName);
          if (knobMesh && knobMesh.material && 'color' in knobMesh.material) {
            (knobMesh.material as THREE.MeshStandardMaterial).color.setHex(parseInt(colorHex.replace('#', ''), 16));
          }
        }
      });
    }
  }, [selectable, chosenColors]);

  // Función para cambiar vista
  const changeView = useCallback((view: 'normal' | 'chasis' | 'knobs') => {
    setCurrentView(view);

    if (view === 'chasis' && selectable.chasis.length > 0) {
      setSelectedForColoring(selectable.chasis[0]);
    } else {
      setSelectedForColoring(null);
    }

    if (!cameraRef.current || !controlsRef.current) return;

    let targetView;
    let enableOrbit;
    if (view === 'normal') {
      targetView = CAMERA_VIEWS.normal;
      enableOrbit = true;
    } else {
      targetView = CAMERA_VIEWS.top;
      enableOrbit = false;
    }
    controlsRef.current.enabled = enableOrbit;

    // Animar la cámara y el target igual que en el código vanilla
    gsap.to(cameraRef.current.position, { 
      duration: 1.2, 
      ease: 'power3.inOut', 
      ...targetView.pos 
    });
    gsap.to(controlsRef.current.target, { 
      duration: 1.2, 
      ease: 'power3.inOut', 
      ...targetView.target, 
      onUpdate: () => controlsRef.current.update() 
    });
  }, [selectable]);

  // Función para cambiar color
  const changeColor = useCallback((colorName: string) => {
    if (!selectedForColoring) return;

    const meshName = selectedForColoring.name.toLowerCase();
    let palette: Record<string, PaletteColor> | null = null;
    let colorKey: string | null = null;

    if (meshName.includes('cubechasis')) {
      palette = PALETTES.chasis;
      colorKey = 'chasis';
    } else if (meshName.includes('knob')) {
      palette = PALETTES.knobs;
      colorKey = selectedForColoring.name;
    }

    if (palette && colorKey && palette[colorName]) {
      const colorHex = palette[colorName].hex;
      if (selectedForColoring.material && 'color' in selectedForColoring.material) {
        (selectedForColoring.material as THREE.MeshStandardMaterial).color.setHex(parseInt(colorHex.replace('#', ''), 16));
      }

      setChosenColors(prev => ({
        ...prev,
        [colorKey === 'chasis' ? 'chasis' : 'knobs']: colorKey === 'chasis' ? colorName : {
          ...prev.knobs,
          [colorKey]: colorName
        }
      }));
    }
  }, [selectedForColoring]);

  // Manejo de clicks en el canvas
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!cameraRef.current || !rendererRef.current) return;

    if (currentView === 'chasis') {
      setSelectedForColoring(null);
      return;
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const bounds = rendererRef.current.domElement.getBoundingClientRect();
    
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    
    raycaster.setFromCamera(pointer, cameraRef.current);
    
    let objectsToIntersect: THREE.Mesh[] = [];
    if (currentView === 'knobs') {
      objectsToIntersect = selectable.knobs;
    } else if (currentView === 'normal') {
      objectsToIntersect = selectable.knobs;
    }
    
    if (objectsToIntersect.length === 0) return;
    
    const intersects = raycaster.intersectObjects(objectsToIntersect, false);
    
    if (intersects.length > 0) {
      const selectedObject = intersects[0].object as THREE.Mesh;
      setSelectedForColoring(selectedObject);
    } else {
      setSelectedForColoring(null);
    }
  }, [currentView, selectable]);

  // Función para obtener título
  const getTitle = () => {
    if (currentView === 'chasis') {
      return "CHASIS";
    } else if (currentView === 'knobs') {
      return "KNOBS";
    }
    return "LOOPO";
  };

  // Función para obtener colores actuales
  const getCurrentColors = () => {
    if (currentView === 'chasis') {
      return PALETTES.chasis;
    } else if (currentView === 'knobs') {
      return PALETTES.knobs;
    }
    return PALETTES.chasis; // Por defecto
  };

  // Función para aplicar color
  const applyColor = useCallback((name: string, colorData: PaletteColor) => {
    if (currentView === 'chasis') {
      setChosenColors(prev => ({ ...prev, chasis: name }));
      selectable.chasis.forEach(mesh => {
        if (mesh.material && 'color' in mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).color.setHex(parseInt(colorData.hex.replace('#', ''), 16));
        }
      });
    } else if (currentView === 'knobs' && selectedForColoring) {
      setChosenColors(prev => ({
        ...prev,
        knobs: { ...prev.knobs, [selectedForColoring.name]: name }
      }));
      // Aplicar color al knob seleccionado
      if (selectedForColoring.material && 'color' in selectedForColoring.material) {
        (selectedForColoring.material as THREE.MeshStandardMaterial).color.setHex(parseInt(colorData.hex.replace('#', ''), 16));
      }
    }
  }, [currentView, selectable, selectedForColoring]);

  // Función para abrir modal de pago
  const handleOpenPayment = useCallback(() => {
    // Aquí puedes implementar la lógica del modal de pago
    console.log('Abrir modal de pago');
  }, []);

  const menuIcons = [
    { id: 'normal', icon: 'M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5M12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17M12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z', title: 'Vista General' },
    { id: 'chasis', icon: `M4 4 Q2 4 2 8 L2 24 Q2 28 4 28 L28 28 Q30 28 30 24 L30 8 Q30 4 28 4 Z`, title: 'Chasis', viewBox: '0 0 32 32' },
    { id: 'knobs', icon: 'M9.42 4.074a.56.56 0 0 0-.56.56v.93c0 .308.252.56.56.56s.56-.252.56-.56v-.93a.56.56 0 0 0-.56-.56M11.554 8.8a.5.5 0 0 1 0 .707l-1.78 1.78a.5.5 0 1 1-.708-.707l1.78-1.78a.5.5 0 0 1 .708 0 M9.42 15.444c-1.16 0-2.32-.44-3.2-1.32a4.527 4.527 0 0 1 0-6.39a4.527 4.527 0 0 1 6.39 0a4.527 4.527 0 0 1 0 6.39c-.88.88-2.03 1.32-3.19 1.32m0-1.1a3.41 3.41 0 1 0 0-6.82a3.41 3.41 0 0 0 0 6.82M6.757 5.2a.56.56 0 1 0-.965.567l.465.809l.005.006a.58.58 0 0 0 .478.262a.53.53 0 0 0 .276-.075a.566.566 0 0 0 .205-.753zm5.315.012a.55.55 0 0 1 .761-.206c.277.152.36.5.203.764l-.458.797a.56.56 0 0 1-.478.277a.564.564 0 0 1-.487-.834zm7.598 5.722a.5.5 0 0 1 .5-.5h2.52a.5.5 0 1 1 0 1h-2.52a.5.5 0 0 1-.5-.5 M22.69 15.454c2.49 0 4.52-2.03 4.52-4.52s-2.03-4.52-4.52-4.52s-4.52 2.03-4.52 4.52s2.03 4.52 4.52 4.52m0-1.11a3.41 3.41 0 1 1 0-6.82a3.41 3.41 0 0 1 0 6.82m-.56-9.7c0-.308.252-.56.56-.56s.56.252.56.56v.945a.566.566 0 0 1-.56.535a.56.56 0 0 1-.56-.56zm-2.103.566a.557.557 0 0 0-.763-.202a.566.566 0 0 0-.204.753l.468.815l.004.006a.58.58 0 0 0 .478.262a.53.53 0 0 0 .276-.075a.566.566 0 0 0 .205-.753zm6.086-.204a.55.55 0 0 0-.761.206l-.458.795a.55.55 0 0 0 .194.759a.5.5 0 0 0 .282.077a.6.6 0 0 0 .478-.261l.005-.007l.463-.805a.55.55 0 0 0-.203-.764 M11.93 22.636H9.42a.5.5 0 0 0 0 1h2.51a.5.5 0 1 0 0-1 M4.9 23.136c0 2.49 2.03 4.52 4.52 4.52s4.52-2.03 4.52-4.52s-2.03-4.52-4.52-4.52s-4.52 2.03-4.52 4.52m7.93 0a3.41 3.41 0 1 1-6.82 0a3.41 3.41 0 0 1 6.82 0m-3.41-6.86a.56.56 0 0 0-.56.56v.93c0 .308.252.56.56.56s.56-.252.56-.56v-.93a.56.56 0 0 0-.56-.56m-3.418.93a.566.566 0 0 1 .755.206l.464.807c.137.258.06.6-.205.753a.53.53 0 0 1-.276.074a.58.58 0 0 1-.478-.261l-.005-.007l-.468-.814a.566.566 0 0 1 .207-.755zm6.08.209a.55.55 0 0 1 .761-.206c.277.151.36.499.203.764l-.462.802a.567.567 0 0 1-.766.194a.55.55 0 0 1-.194-.76zm8.475 3.588a.5.5 0 0 1 .707 0l1.78 1.78a.5.5 0 0 1-.707.707l-1.78-1.78a.5.5 0 0 1 0-.707 M22.69 27.656c-1.16 0-2.32-.44-3.2-1.32a4.527 4.527 0 0 1 0-6.39a4.527 4.527 0 0 1 6.39 0a4.527 4.527 0 0 1 0 6.39c-.88.88-2.04 1.32-3.19 1.32m0-1.11a3.41 3.41 0 1 0 0-6.82a3.41 3.41 0 0 0 0 6.82 M22.13 16.836c0-.308.252-.56.56-.56s.56.252.56.56v.945a.57.57 0 0 1-.56.545a.56.56 0 0 1-.56-.56zm-2.103.576a.566.566 0 0 0-.755-.206l-.006.003a.565.565 0 0 0-.206.755l.468.814l.004.007a.58.58 0 0 0 .478.262a.53.53 0 0 0 .276-.074a.566.566 0 0 0 .205-.753zm6.086-.203a.55.55 0 0 0-.761.206l-.458.795a.55.55 0 0 0 .194.759a.5.5 0 0 0 .282.077a.6.6 0 0 0 .478-.261l.005-.007l.463-.805a.55.55 0 0 0-.203-.764 M1 5.75A4.75 4.75 0 0 1 5.75 1h20.52a4.75 4.75 0 0 1 4.75 4.75v20.48a4.75 4.75 0 0 1-4.75 4.75H5.75A4.75 4.75 0 0 1 1 26.23zM5.75 3A2.75 2.75 0 0 0 3 5.75v20.48a2.75 2.75 0 0 0 2.75 2.75h20.52a2.75 2.75 0 0 0 2.75-2.75V5.75A2.75 2.75 0 0 0 26.27 3z', title: 'Knobs' }
  ];

  // Configuración de partículas
  const particlesInit = async (main: any) => {
    await loadFull(main);
  };

  return (
    <PayPalScriptProvider options={{ clientId: "test", currency: "USD" }}>
      <div className="w-full h-screen bg-black text-gray-200 overflow-hidden relative">
        {/* Fondo degradado estático */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 0,
            pointerEvents: "none",
            background: "linear-gradient(120deg,rgb(42, 40, 51) 0%, #00FFF0 60%, #D8D6F2 100%)"
          }}
        />
        {/* Fondo de partículas global */}
        <Particles
          id="tsparticles"
          init={particlesInit}
          options={{
            fullScreen: { enable: false },
            background: { color: { value: "transparent" } },
            fpsLimit: 60,
            particles: {
              color: { value: "#a259ff" },
              links: { enable: true, color: "#a259ff", distance: 120 },
              move: { enable: true, speed: 1 },
              number: { value: 50 },
              opacity: { value: 0.5 },
              shape: { type: "circle" },
              size: { value: 3 }
            },
            interactivity: {
              events: {
                onhover: { enable: true, mode: "repulse" }
              },
              modes: {
                repulse: { distance: 100, duration: 0.4 }
              }
            }
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 0,
            pointerEvents: "none"
          }}
        />
        {/* Botón de inicio y LOOPO (izquierda) */}
        <div style={{ position: 'fixed', top: 16, left: 6, zIndex: 51, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            className="px-5 py-2 bg-purple-400 text-black border border-purple-400 rounded font-bold text-sm uppercase tracking-wide transition-all duration-200 hover:bg-yellow-200 hover:border-yellow-200 hover:-translate-y-0.5 hover:shadow-lg shadow-[0_0_8px_2px_#a259ff80,0_0_16px_4px_#0ff5]"
            onClick={() => window.location.href = 'https://www.crearttech.com/'}
          >
            Inicio
          </button>
          
          {/* Botón LOOPO */}
          <div style={{ background: 'linear-gradient(180deg, #6C4FCE 0%, #291A57 100%)', borderRadius: '12px', padding: '8px 24px' }}>
            <h1 className="text-2xl text-white font-bold leading-none m-0 text-shadow" style={{ fontFamily: 'Gotham Black, Arial, sans-serif' }}>
              LOOPO
            </h1>
          </div>
        </div>

        {/* Título y logo centrados */}
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-3">
          <img
            src="models/logo.png"
            alt="Logo"
            className="h-8 w-auto"
            style={{
              filter: 'drop-shadow(0 0 8px #a259ff) drop-shadow(0 0 16px #0ff)',
            }}
          />
          <h1 
            className="text-2xl font-bold leading-none m-0" 
            style={{ 
              fontFamily: 'Gotham Black, Arial, sans-serif',
              color: '#fff',
              textShadow: '0 0 12px #a259ff, 0 0 24px #0ff, 0 0 2px #fff',
              letterSpacing: '0.04em'
            }}
          >
            CONFIGURADOR
          </h1>
        </div>

        {/* Container principal */}
        <main className="flex w-full h-full" style={{ minHeight: "100vh", height: "100vh", position: "relative", zIndex: 1, overflow: "hidden" }}>
          {/* Canvas container */}
          <div className="flex-grow h-full" style={{ position: "relative", zIndex: 1, background: "linear-gradient(180deg,rgb(14, 14, 14) 0%,rgb(31, 31, 31) 100%)" }}> 
            <div
              ref={mountRef}
              className="w-full h-full transition-all duration-300"
              onClick={handleCanvasClick}
              style={{ position: "relative", zIndex: 1 }}
            />
          </div>
        </main>

        {/* Panel de UI */}
        <div
          className={`fixed top-0 right-0 h-screen border-l border-gray-700 shadow-2xl transition-all duration-400 flex overflow-hidden z-10 ${
            currentView === 'normal' ? 'w-28' : 'w-[320px]'
          }`}
          style={{
            backgroundColor: '#2D3559',
            boxShadow: '0 0 32px 4px #a259ff, -12px 0 32px 0 #a259ff',
            zIndex: 10
          }}
        >

          {/* Columna de controles de vista */}
          <div className="w-28 p-6 flex-shrink-0" style={{ paddingTop: '200px' }}>
            <div className="flex flex-col gap-2">
              {menuIcons.map(({ id, icon, title, viewBox }) => (
                <button
                  key={id}
                  onClick={
                    id === 'faders'
                      ? undefined
                      : () => changeView(id as 'normal' | 'chasis' | 'knobs')
                  }
                  className={`w-full aspect-square border rounded flex items-center justify-center p-3 transition-all duration-200 text-white ${
                    currentView === id 
                      ? 'bg-[#6C4FCE] border-[#6C4FCE] shadow-[0_0_8px_2px_#6C4FCE80,0_0_16px_4px_#0ff5,0_0_2px_1px_#fff3]'
                      : 'border-gray-600 bg-[#A693E5] bg-opacity-100 hover:bg-[#6C4FCE] hover:border-[#6C4FCE] hover:shadow-[0_0_4px_1px_#6C4FCE60,0_0_8px_2px_#0ff3]'
                  }`}
                  title={title}
                  disabled={id === 'faders'}
                  style={id === 'faders' ? { cursor: 'not-allowed' } : {}}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox={id === 'chasis' ? '0 0 32 32' : id === 'knobs' ? '0 0 32 32' : id === 'faders' ? '0 0 256 256' : '0 0 24 24'}
                    className="w-4/5 h-4/5 mx-auto my-auto fill-white text-white"
                    fill="#fff"
                  >
                    <path d={icon} />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Contenido de la UI */}
          <div className="flex-1 p-4 flex flex-col">
            {/* Header */}
            <div
              className={`flex items-center pb-5 border-b border-gray-600 pl-0 ${currentView === 'normal' ? 'justify-center items-center gap-0' : 'justify-center gap-2'}`}
              style={currentView === 'normal' ? { minHeight: '48px' } : {}}
            >
              {currentView === 'normal' ? (
                <img
                  src="models/logo.png"
                  alt="Logo"
                  className="h-6 w-auto"
                  style={{
                    filter: 'drop-shadow(0 0 8px #a259ff) drop-shadow(0 0 16px #0ff)',
                  }}
                />
              ) : (
                <>
                  <img
                    src="models/logo.png"
                    alt="Logo"
                    className="h-8 w-auto"
                    style={{
                      filter: 'drop-shadow(0 0 8px #a259ff) drop-shadow(0 0 16px #0ff)',
                    }}
                  />
                  <h2
                    className="m-0 font-bold tracking-widest text-xl md:text-3xl whitespace-normal break-words text-left"
                    style={{
                      fontFamily: 'Gotham Black, Arial, sans-serif',
                      color: '#fff',
                      textShadow: '0 0 12px #a259ff, 0 0 24px #0ff, 0 0 2px #fff',
                      letterSpacing: '0.04em',
                      marginLeft: '-0.25em',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    LOOPO
                  </h2>
                </>
              )}
            </div>

            {/* Sección de colores */}
            <div className="mt-6 animate-fadeIn">
              <p className="font-black text-sm tracking-wide uppercase m-0 mb-3 text-gray-200 text-left animate-fadeIn">
                {getTitle()}
              </p>
              <div className="grid grid-cols-4 gap-2 p-2 rounded overflow-x-auto animate-scaleIn" style={{ backgroundColor: '#232846' }}>
                {Object.entries(getCurrentColors()).map(([name, colorData], index) => (
                  <div
                    key={name}
                    className="w-10 h-10 rounded-full cursor-pointer border-2 border-[#a259ff] shadow-[0_0_6px_1px_#a259ff55] transition-all duration-200 shadow-inner hover:scale-110 animate-fadeInUp"
                    style={{ 
                      backgroundColor: colorData.hex,
                      animationDelay: `${index * 50}ms`
                    }}
                    title={name}
                    onClick={() => applyColor(name, colorData)}
                  />
                ))}
              </div>
            </div>

            {/* Información de selección múltiple */}
            {currentView === 'knobs' && selectedForColoring && (
              <div className="mb-6 p-4 bg-gray-800 rounded-lg animate-scaleIn">
                <h4 className="text-lg font-semibold text-white mb-2 animate-fadeIn">
                  Seleccionado: {selectedForColoring.name}
                </h4>
                <p className="text-gray-300 text-sm animate-fadeIn">
                  Haz clic en un color para aplicarlo al knob seleccionado
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botón de comprar (solo visible en vista normal) */}
        {currentView === 'normal' && (
          <button 
            onClick={handleOpenPayment}
            className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 text-lg font-bold uppercase tracking-wide text-black bg-purple-400 border-none rounded cursor-pointer transition-all duration-200 shadow-lg hover:bg-yellow-200 hover:scale-105 hover:shadow-xl shadow-[0_0_8px_2px_#a259ff80,0_0_16px_4px_#0ff5]"
          >
            AÑADIR AL CARRITO
          </button>
        )}
      </div>
    </PayPalScriptProvider>
  );
};

export default LoopoConfigurator; 