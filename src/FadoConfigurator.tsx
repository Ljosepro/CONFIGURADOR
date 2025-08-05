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
  faders: THREE.Mesh[];
}

interface ChosenColors {
  type: string;
  chasis: string;
  faders: Record<string, string>;
}

interface PaletteColor {
  hex: string;
}

interface Palettes {
  chasis: Record<string, PaletteColor>;
  faders: Record<string, PaletteColor>;
  knobs: Record<string, PaletteColor>;
}

const FadoConfigurator: React.FC<{ onProductChange?: (product: 'beato' | 'knobo' | 'mixo' | 'beato16' | 'loopo' | 'fado') => void }> = ({ onProductChange }) => {
  // Referencias para Three.js
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const modelRef = useRef<THREE.Group | null>(null);

  // Estados de React
  const [currentView, setCurrentView] = useState<'normal' | 'chasis' | 'faders'>(() => {
    const saved = localStorage.getItem('fado_currentView');
    return saved ? (saved as 'normal' | 'chasis' | 'faders') : 'normal';
  });
  const [selectedForColoring, setSelectedForColoring] = useState<THREE.Mesh | null>(null);
  const [chosenColors, setChosenColors] = useState<ChosenColors>(() => {
    const saved = localStorage.getItem('fado_chosenColors');
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
      faders: {}
    };
  });
  const [selectable, setSelectable] = useState<Selectable>({ chasis: [], faders: [] });
  
  // Estado para selección múltiple de faders
  const [selectedFaders, setSelectedFaders] = useState<THREE.Mesh[]>([]);

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
    faders: {
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
    normal: { pos: new THREE.Vector3(2, 1, -0.1), target: new THREE.Vector3(0, -0.5, -0.1) },
    top:    { pos: new THREE.Vector3(1, 1.65, -0.6), target: new THREE.Vector3(-0.35, -0.9, -0.6) },
  };

  // Función para aplicar efectos de glow
  const setEmissive = useCallback((mesh: THREE.Mesh, color: number) => {
    if (mesh.material && 'emissive' in mesh.material) {
      (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(color);
    }
  }, []);

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
    const newSelectable: Selectable = { chasis: [], faders: [] };
    const newChosenColors: ChosenColors = {
      type: 'configUpdate',
      chasis: 'Azul',
      faders: {}
    };

    const allMeshes: string[] = [];
    
    // Debug: Mostrar estructura del modelo
    console.log('🏗️ Estructura del modelo fado.glb:');
    const printStructure = (obj: THREE.Object3D, level: number = 0) => {
      const indent = '  '.repeat(level);
      const type = obj.type;
      const name = obj.name || 'sin nombre';
      console.log(`${indent}${type}: ${name}`);
      obj.children.forEach(child => printStructure(child, level + 1));
    };
    printStructure(model);
    
    // Buscar específicamente la colección "faders"
    console.log('🔍 Buscando colección "faders"...');
    const findFadersCollection = (obj: THREE.Object3D): THREE.Object3D | null => {
      if (obj.name.toLowerCase() === 'faders') {
        console.log('✅ Encontrada colección "faders":', obj);
        return obj;
      }
      for (const child of obj.children) {
        const found = findFadersCollection(child);
        if (found) return found;
      }
      return null;
    };
    
    const fadersCollection = findFadersCollection(model);
    if (fadersCollection) {
      console.log('🎛️ Contenido de la colección faders:');
      fadersCollection.children.forEach((child, index) => {
        console.log(`   ${index + 1}. ${child.type}: ${child.name}`);
      });
    } else {
      console.log('⚠️ No se encontró la colección "faders"');
    }
    
    model.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const meshName = typeof child.name === 'string' ? child.name.toLowerCase() : '';
      allMeshes.push(child.name);
      
      console.log(`🔍 Procesando mesh: "${child.name}" (lowercase: "${meshName}")`);
      
      // Log específico para meshes que contengan 'fader'
      if (meshName.includes('fader')) {
        console.log(`🎯 MESH FADER DETECTADO: "${child.name}" (meshName: "${meshName}")`);
      }

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
      else if (meshName.includes('fader')) {
        console.log(`🔍 Encontrado mesh con 'fader': "${child.name}" (meshName: "${meshName}")`);
        
        // Verificar que sea específicamente un fader del 1 al 8 (fader1, fader2, etc.)
        const faderMatch = meshName.match(/^fader(\d+)$/);
        console.log(`🔍 Resultado del match para "${meshName}":`, faderMatch);
        
        if (faderMatch) {
          const faderNumber = parseInt(faderMatch[1]);
          console.log(`🔍 Número de fader extraído: ${faderNumber}`);
          
                     if (faderNumber >= 1 && faderNumber <= 8) {
             // Aplicar el mismo material que MixoConfigurator para faders
             const defaultColor = 'Rosa';
             const rosaColor = PALETTES.knobs[defaultColor].hex;
             console.log(`🎨 Aplicando color rosa a fader ${faderNumber}:`, rosaColor);
             
             // Aplicar el mismo material que MixoConfigurator para faders
             child.material = new THREE.MeshStandardMaterial({ 
               color: rosaColor, 
               metalness: 0, 
               roughness: 1 
             });
            
            // Verificar que el material se aplicó correctamente
            console.log(`🔍 Material aplicado a ${child.name}:`, {
              color: child.material.color.getHexString(),
              metalness: child.material.metalness,
              roughness: child.material.roughness
            });
            
            newSelectable.faders.push(child);
            newChosenColors.faders[child.name] = defaultColor;
            console.log(`✅ Fader ${faderNumber} procesado:`, child.name, 'con color rosa pero material original');
          } else {
            console.log(`⚠️ Mesh con 'fader' pero número fuera de rango (${faderNumber}):`, child.name);
          }
        } else {
          console.log(`⚠️ Mesh con 'fader' pero sin número o formato incorrecto:`, child.name);
          console.log(`⚠️ meshName: "${meshName}", regex test:`, /^fader(\d+)$/.test(meshName));
          
          // Intentar con nombres alternativos
          const alternativeMatch = meshName.match(/fader[_-]?(\d+)/);
          if (alternativeMatch) {
            const faderNumber = parseInt(alternativeMatch[1]);
            console.log(`🔍 Número de fader alternativo extraído: ${faderNumber}`);
            
                         if (faderNumber >= 1 && faderNumber <= 8) {
               const defaultColor = 'Rosa';
               const rosaColor = PALETTES.knobs[defaultColor].hex;
               console.log(`🎨 Aplicando color rosa a fader alternativo ${faderNumber}:`, rosaColor);
               
               // Aplicar el mismo material que MixoConfigurator para faders
               child.material = new THREE.MeshStandardMaterial({ 
                 color: rosaColor, 
                 metalness: 0, 
                 roughness: 1 
               });
               
               newSelectable.faders.push(child);
               newChosenColors.faders[child.name] = defaultColor;
               console.log(`✅ Fader alternativo ${faderNumber} procesado:`, child.name, 'con color rosa pero material original');
             }
          }
        }
      }
    });

    console.log('FadoConfigurator - Faders encontrados:', newSelectable.faders.length);
    console.log('FadoConfigurator - Faders:', newSelectable.faders.map(f => f.name));
    
    // Mostrar todos los meshes del modelo para debugging
    console.log('🔍 Todos los meshes del modelo fado.glb:');
    allMeshes.forEach((meshName, index) => {
      const isFader = meshName.toLowerCase().includes('fader');
      const isChasis = meshName.toLowerCase().includes('cubechasis');
      const icon = isFader ? '🎛️' : isChasis ? '📦' : '🔹';
      console.log(`   ${index + 1}. ${icon} ${meshName} ${isFader ? '(FADER)' : isChasis ? '(CHASIS)' : ''}`);
    });
    
    // Verificar los faders encontrados en el modelo
    const foundFaders = newSelectable.faders.map(f => f.name);
    
    if (foundFaders.length === 0) {
      console.warn('⚠️ No se encontraron faders en el modelo');
    } else {
      console.log(`✅ Se encontraron ${foundFaders.length} faders en el modelo:`);
      foundFaders.forEach((faderName, index) => {
        console.log(`   ${index + 1}. ${faderName}`);
      });
    }
    
    // Actualizar estados
    console.log('🔄 Actualizando estado selectable con faders:', newSelectable.faders.length);
    setSelectable(newSelectable);
    setChosenColors(newChosenColors);
    
    // Buscar faders específicamente en la colección "faders" si no se encontraron
    if (newSelectable.faders.length === 0 && fadersCollection) {
      console.log('🔍 Buscando faders en la colección específica...');
      fadersCollection.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          const meshName = child.name.toLowerCase();
          console.log(`🔍 Revisando mesh en colección faders: "${child.name}" (${meshName})`);
          
          if (meshName.includes('fader')) {
            const faderMatch = meshName.match(/fader(\d+)/);
            if (faderMatch) {
              const faderNumber = parseInt(faderMatch[1]);
                                                           if (faderNumber >= 1 && faderNumber <= 8) {
                 const defaultColor = 'Rosa';
                 const rosaColor = PALETTES.knobs[defaultColor].hex;
                 console.log(`🎨 Aplicando color rosa a fader de colección ${faderNumber}:`, rosaColor);
                 
                 // Aplicar el mismo material que MixoConfigurator para faders
                 child.material = new THREE.MeshStandardMaterial({ 
                   color: rosaColor, 
                   metalness: 0, 
                   roughness: 1 
                 });
                 
                 newSelectable.faders.push(child);
                 newChosenColors.faders[child.name] = defaultColor;
                 console.log(`✅ Fader de colección ${faderNumber} procesado:`, child.name, 'con color rosa pero material original');
               }
            }
          }
        }
      });
      
      // Actualizar estados nuevamente si se encontraron faders
      if (newSelectable.faders.length > 0) {
        setSelectable({...newSelectable});
        setChosenColors({...newChosenColors});
      }
    }
    
         // Forzar aplicación del color rosa a todos los faders después de un breve delay
     setTimeout(() => {
       console.log('🔄 Forzando aplicación de color rosa a todos los faders...');
       newSelectable.faders.forEach((fader, index) => {
         const rosaColor = PALETTES.knobs['Rosa'].hex;
         // Aplicar el mismo material que MixoConfigurator para faders
         fader.material = new THREE.MeshStandardMaterial({ 
           color: rosaColor, 
           metalness: 0, 
           roughness: 1 
         });
         console.log(`🎨 Color rosa forzado en fader ${index + 1}:`, fader.name);
       });
     }, 100);
  }, []);

  // Cargar modelo
  const loadModel = useCallback(async () => {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      
      loader.load('./models/fado.glb', (gltf: any) => {
        console.log('FadoConfigurator: Modelo cargado exitosamente');
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
    localStorage.setItem('fado_currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem('fado_chosenColors', JSON.stringify(chosenColors));
  }, [chosenColors]);

  // Aplicar colores guardados
  useEffect(() => {
    if (selectable.chasis.length > 0 || selectable.faders.length > 0) {
      // Aplicar color del chasis
      if (chosenColors.chasis && PALETTES.chasis[chosenColors.chasis]) {
        const colorHex = PALETTES.chasis[chosenColors.chasis].hex;
        selectable.chasis.forEach(mesh => {
          if (mesh.material && 'color' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).color.setHex(parseInt(colorHex.replace('#', ''), 16));
          }
        });
      }

             // Aplicar colores de faders
       Object.entries(chosenColors.faders).forEach(([faderName, colorName]) => {
         if (PALETTES.knobs[colorName]) {
           const colorHex = PALETTES.knobs[colorName].hex;
           const faderMesh = selectable.faders.find(fader => fader.name === faderName);
           if (faderMesh) {
             // Aplicar el mismo material que MixoConfigurator para faders
             faderMesh.material = new THREE.MeshStandardMaterial({ 
               color: colorHex, 
               metalness: 0, 
               roughness: 1 
             });
           }
         }
       });
    }
  }, [selectable, chosenColors]);

     // Forzar color rosa en faders cuando se cargan
   useEffect(() => {
     if (selectable.faders.length > 0) {
       console.log('🎨 Aplicando color rosa por defecto a todos los faders...');
       selectable.faders.forEach((fader, index) => {
         const rosaColor = PALETTES.knobs['Rosa'].hex;
         // Aplicar el mismo material que MixoConfigurator para faders
         fader.material = new THREE.MeshStandardMaterial({ 
           color: rosaColor, 
           metalness: 0, 
           roughness: 1 
         });
         console.log(`✅ Color rosa aplicado a fader ${index + 1}:`, fader.name);
       });
     }
   }, [selectable.faders.length]);

  // Función para cambiar vista
  const changeView = useCallback((view: 'normal' | 'chasis' | 'faders') => {
    setCurrentView(view);

    // Limpiar glow effects al cambiar vista
    if (selectedForColoring) {
      setEmissive(selectedForColoring, 0x000000);
    }
    selectedFaders.forEach(fader => setEmissive(fader, 0x000000));

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
  }, [selectable, selectedForColoring, setEmissive, selectedFaders]);

  // Función para cambiar color
  const changeColor = useCallback((colorName: string) => {
    if (!selectedForColoring) return;

    const meshName = selectedForColoring.name.toLowerCase();
    let palette: Record<string, PaletteColor> | null = null;
    let colorKey: string | null = null;

    if (meshName.includes('cubechasis')) {
      palette = PALETTES.chasis;
      colorKey = 'chasis';
    } else if (meshName.includes('fader')) {
      palette = PALETTES.knobs;
      colorKey = selectedForColoring.name;
    }

    if (palette && colorKey && palette[colorName]) {
      const colorHex = palette[colorName].hex;
      if (selectedForColoring.material && 'color' in selectedForColoring.material) {
        (selectedForColoring.material as THREE.MeshStandardMaterial).color.setHex(parseInt(colorHex.replace('#', ''), 16));
      }

      setChosenColors(prev => {
        if (colorKey === 'chasis') {
          return {
            ...prev,
            chasis: colorName
          };
        } else {
          return {
            ...prev,
            faders: {
              ...prev.faders,
              [colorKey!]: colorName
            }
          };
        }
      });
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
    if (currentView === 'faders') {
      objectsToIntersect = selectable.faders;
    } else if (currentView === 'normal') {
      objectsToIntersect = selectable.faders;
    }
    
    if (objectsToIntersect.length === 0) return;
    
    const intersects = raycaster.intersectObjects(objectsToIntersect, false);
    
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object as THREE.Mesh;
      const name = clickedMesh.name.toLowerCase();
      
      if (name.includes('fader')) {
        console.log('Click detectado en fader:', name, 'Vista actual:', currentView);
        
        if (event.shiftKey) {
          if (selectedFaders.length === 0 && selectedForColoring && selectedForColoring !== clickedMesh) {
            setSelectedFaders([selectedForColoring, clickedMesh]);
            setSelectedForColoring(null);
            // Aplicar glow a ambos faders seleccionados
            setEmissive(selectedForColoring, 0x444444);
            setEmissive(clickedMesh, 0x444444);
          } else {
            setSelectedForColoring(null);
            setSelectedFaders(prev => {
              if (prev.length === 0) {
                setEmissive(clickedMesh, 0x444444);
                return [clickedMesh];
              }
              const already = prev.includes(clickedMesh);
              let newSelected;
              if (already) {
                newSelected = prev.filter(obj => obj !== clickedMesh);
                // Quitar glow del fader deseleccionado
                setEmissive(clickedMesh, 0x000000);
              } else {
                newSelected = [...prev, clickedMesh];
                setEmissive(clickedMesh, 0x444444);
              }
              // Aplicar glow a todos los faders seleccionados
              newSelected.forEach(fader => setEmissive(fader, 0x444444));
              return newSelected;
            });
          }
        } else {
          setSelectedFaders([]);
          setSelectedForColoring(clickedMesh);
          // Aplicar glow al fader seleccionado
          setEmissive(clickedMesh, 0x444444);
        }
      } else if (name.includes('cubechasis')) {
        setSelectedFaders([]);
        setSelectedForColoring(clickedMesh);
      }
    } else {
      setSelectedForColoring(null);
      setSelectedFaders([]);
    }
  }, [currentView, selectable, selectedForColoring, setEmissive, selectedFaders]);

  // Función para obtener título
  const getTitle = () => {
    if (currentView === 'chasis') {
      return "🎛️ CHASIS";
    } else if (currentView === 'faders') {
      return "🎚️ FADERS";
    }
    return "🎵 FADO";
  };

  // Función para obtener colores actuales
  const getCurrentColors = () => {
    if (currentView === 'chasis') {
      return PALETTES.chasis;
    } else if (currentView === 'faders') {
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
    } else if (currentView === 'faders' && selectedFaders.length > 0) {
      console.log('Aplicando color a faders múltiples:', selectedFaders.map(f => f.name), 'Color:', name);
      const newChosenColors = { ...chosenColors, faders: { ...chosenColors.faders } };
             selectedFaders.forEach(fader => {
         // Aplicar el mismo material que MixoConfigurator para faders
         fader.material = new THREE.MeshStandardMaterial({ 
           color: colorData.hex, 
           metalness: 0, 
           roughness: 1 
         });
         newChosenColors.faders[fader.name] = name;
       });
      setChosenColors(newChosenColors);
      setSelectedFaders([]);
      return;
    } else if (currentView === 'faders' && selectedForColoring) {
      console.log('Aplicando color a fader individual:', selectedForColoring.name, 'Color:', name);
      setChosenColors(prev => ({
        ...prev,
        faders: { ...prev.faders, [selectedForColoring.name]: name }
      }));
             // Aplicar el mismo material que MixoConfigurator para faders
       selectedForColoring.material = new THREE.MeshStandardMaterial({ 
         color: colorData.hex, 
         metalness: 0, 
         roughness: 1 
       });
       console.log('Material de Mixo aplicado al fader');
    }
  }, [currentView, selectable, selectedForColoring, selectedFaders, chosenColors]);

  // Función para abrir modal de pago
  const handleOpenPayment = useCallback(() => {
    // Aquí puedes implementar la lógica del modal de pago
    console.log('Abrir modal de pago');
  }, []);

  const menuIcons = [
    { id: 'normal', icon: 'M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5M12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17M12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z', title: '🎵 Vista General' },
    { id: 'chasis', icon: `M4 4 Q2 4 2 8 L2 24 Q2 28 4 28 L28 28 Q30 28 30 24 L30 8 Q30 4 28 4 Z`, title: '🎛️ Chasis', viewBox: '0 0 32 32' },
    { id: 'faders', icon: 'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z', title: '🎚️ Faders' }
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
                 {/* Título principal */}
         <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10" style={{ 
           background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)', 
           borderRadius: '16px', 
           padding: '12px 28px',
           boxShadow: '0 8px 32px rgba(255, 107, 107, 0.4), 0 4px 16px rgba(238, 90, 36, 0.3)',
           border: '1px solid rgba(255, 255, 255, 0.1)'
         }}>
          <h1 className="text-3xl text-white font-bold leading-none m-0" style={{ 
            fontFamily: 'Gotham Black, Arial, sans-serif',
            textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 0 20px rgba(255, 107, 107, 0.5)'
          }}>
            PERSONALIZA TU
            <span className="block relative mt-1" style={{ fontFamily: 'Gotham Black, Arial, sans-serif' }}>
              FADO
              <div className="absolute left-0 bottom-0 h-1.5 w-4/5 bg-gradient-to-r from-red-400 to-orange-400 rounded-full shadow-lg"></div>
            </span>
          </h1>
        </div>

        {/* Botón de inicio (izquierda) */}
        <div style={{ position: 'fixed', top: 16, left: 6, zIndex: 51 }}>
          <button 
            className="px-5 py-2 bg-purple-400 text-black border border-purple-400 rounded font-bold text-sm uppercase tracking-wide transition-all duration-200 hover:bg-yellow-200 hover:border-yellow-200 hover:-translate-y-0.5 hover:shadow-lg shadow-[0_0_8px_2px_#a259ff80,0_0_16px_4px_#0ff5]"
            onClick={() => window.location.href = 'https://www.crearttech.com/'}
          >
            Inicio
          </button>
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
                      ? () => changeView(id as 'normal' | 'chasis' | 'faders')
                      : () => changeView(id as 'normal' | 'chasis' | 'faders')
                  }
                  className={`w-full aspect-square border rounded flex items-center justify-center p-3 transition-all duration-200 text-white ${
                    currentView === id 
                      ? 'bg-[#6C4FCE] border-[#6C4FCE] shadow-[0_0_8px_2px_#6C4FCE80,0_0_16px_4px_#0ff5,0_0_2px_1px_#fff3]'
                      : 'border-gray-600 bg-[#A693E5] bg-opacity-100 hover:bg-[#6C4FCE] hover:border-[#6C4FCE] hover:shadow-[0_0_4px_1px_#6C4FCE60,0_0_8px_2px_#0ff3]'
                  }`}
                  title={title}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox={id === 'chasis' ? '0 0 32 32' : id === 'faders' ? '0 0 24 24' : '0 0 24 24'}
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
          <div className="flex-1 p-2 flex flex-col">
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
                    CONFIGURADOR
                  </h2>
                </>
              )}
            </div>

            {/* Sección de colores */}
            {currentView !== 'normal' && (
              <div className="mt-6 animate-slideIn">
                <div className="flex items-center mb-4">
                                     <p className="font-black text-base tracking-wide uppercase m-0 text-white text-left animate-fadeIn" style={{
                     textShadow: '0 0 10px rgba(255, 107, 107, 0.6), 0 0 20px rgba(238, 90, 36, 0.4)',
                     fontFamily: 'Gotham Black, Arial, sans-serif'
                   }}>
                    {getTitle()}
                  </p>
                  <div className="ml-2 w-2 h-2 bg-gradient-to-r from-red-400 to-orange-400 rounded-full animate-pulse"></div>
                </div>
                <div className="grid grid-cols-4 gap-2 p-2 rounded-lg overflow-x-auto animate-scaleIn" style={{ 
                  backgroundColor: 'rgba(35, 40, 70, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 107, 107, 0.2)',
                  boxShadow: '0 8px 32px rgba(255, 107, 107, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                }}>
                  {Object.entries(getCurrentColors()).map(([name, colorData], index) => (
                    <div
                      key={name}
                      className="w-10 h-10 rounded-full cursor-pointer border-2 border-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl animate-fadeInUp group"
                      style={{ 
                        backgroundColor: colorData.hex,
                        animationDelay: `${index * 50}ms`,
                        boxShadow: `0 4px 12px rgba(0,0,0,0.3), 0 0 0 2px rgba(255, 107, 107, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)`
                      }}
                      title={name}
                      onClick={() => applyColor(name, colorData)}
                    >
                      <div className="w-full h-full rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white bg-opacity-20 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Información de selección múltiple */}
            {(currentView === 'faders' && selectedForColoring) || (currentView === 'faders' && selectedFaders.length > 0) && (
              <div className="mb-4 p-3 bg-gray-800 rounded-lg animate-scaleIn">
                <h4 className="text-lg font-semibold text-white mb-2 animate-fadeIn">
                  {selectedFaders.length > 0 
                    ? `Selección múltiple (${selectedFaders.length} elementos)`
                    : `Seleccionado: ${selectedForColoring ? selectedForColoring.name : ''}`
                  }
                </h4>
                <p className="text-gray-300 text-sm animate-fadeIn">
                  {selectedFaders.length > 0
                    ? 'Haz clic en un color para aplicarlo a todos los faders seleccionados'
                    : 'Haz clic en un color para aplicarlo al fader seleccionado'
                  }
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

export default FadoConfigurator; 