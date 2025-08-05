import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import gsap from 'gsap';

// Tipos compartidos
export interface Selectable {
  chasis: THREE.Mesh[];
  buttons: THREE.Mesh[];
  knobs: THREE.Mesh[];
}

export interface ChosenColors {
  type: string;
  chasis: string;
  buttons: Record<string, string>;
  knobs: Record<string, string>;
}

export interface PaletteColor {
  hex: string;
}

export interface Palettes {
  chasis: Record<string, PaletteColor>;
  buttons: Record<string, PaletteColor>;
  knobs: Record<string, PaletteColor>;
}

interface UseThreeDConfiguratorProps {
  modelPath: string;
  initialChasisColor: string;
  palettes: Palettes;
  onModelLoaded?: (model: THREE.Group, selectable: Selectable, chosenColors: ChosenColors) => void;
  onColorsApplied?: (chosenColors: ChosenColors) => void;
  isKnobo?: boolean; // Para diferenciar la lógica de botones/knobs
}

const CAMERA_VIEWS = {
  normal: { pos: new THREE.Vector3(2, 1, -0.1), target: new THREE.Vector3(0, -0.5, -0.1) },
  top:    { pos: new THREE.Vector3(1, 1.65, -0.6), target: new THREE.Vector3(-0.35, -0.9, -0.6) },
};

export const useThreeDConfigurator = ({
  modelPath,
  initialChasisColor,
  palettes,
  onModelLoaded,
  onColorsApplied,
  isKnobo = false,
}: UseThreeDConfiguratorProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const modelOriginalPositionRef = useRef<THREE.Vector3 | null>(null);

  const [currentView, setCurrentView] = useState<'normal' | 'chasis' | 'buttons' | 'knobs'>('normal');
  const [selectedForColoring, setSelectedForColoring] = useState<THREE.Mesh | null>(null);
  const [chosenColors, setChosenColors] = useState<ChosenColors>({
    type: 'configUpdate',
    chasis: initialChasisColor,
    buttons: {},
    knobs: {}
  });
  const [selectable, setSelectable] = useState<Selectable>({ chasis: [], buttons: [], knobs: [] });
  const [selectedButtons, setSelectedButtons] = useState<THREE.Mesh[]>([]); // Solo para Beato
  const [selectedKnobs, setSelectedKnobs] = useState<THREE.Mesh[]>([]);

  // Helper para establecer emisivo
  const setEmissive = useCallback((object: THREE.Mesh | null, color: number = 0x000000) => {
    if (object && (object.material as THREE.MeshStandardMaterial)?.emissive) {
      (object.material as THREE.MeshStandardMaterial).emissive.setHex(color);
    }
  }, []);

  // Helper para encontrar el aro asociado a un botón (solo para Beato)
  const findAssociatedRing = useCallback((buttonName: string): THREE.Mesh | null => {
    if (!modelRef.current) return null;
    let associatedRing: THREE.Mesh | null = null;
    const buttonNumber = buttonName.match(/\d+/)?.[0];
    if (!buttonNumber) return null;
    modelRef.current.traverse((child: THREE.Object3D) => {
      if (
        child instanceof THREE.Mesh &&
        child.name.toLowerCase().includes('aro') &&
        child.name.includes(buttonNumber)
      ) {
        associatedRing = child;
      }
    });
    return associatedRing;
  }, []);

  // Configuración de iluminación
  const setupProfessionalLighting = useCallback((scene: THREE.Scene, renderer: THREE.WebGLRenderer) => {
    // Luz ambiental suave
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4); // antes 2.7
    scene.add(ambientLight);

    // Luz direccional principal (tipo sol)
    const mainLight = new THREE.DirectionalLight(0xffffff, 3.5); // antes 1.2
    mainLight.position.set(5, 4, 1);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 4096;
    mainLight.shadow.mapSize.height = 4096;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.normalBias = 0.02;
    scene.add(mainLight);

    // Luz de relleno fría
    const fillLight = new THREE.DirectionalLight(0x99ccff, 0.5);
    fillLight.position.set(-8, 5, -5);
    scene.add(fillLight);

    // Luz puntual para brillos
    const pointLight = new THREE.PointLight(0xffffff, 0.7, 20);
    pointLight.position.set(0, 5, 5);
    scene.add(pointLight);
  }, []);

  // Preparar partes del modelo
  const prepareModelParts = useCallback((model: THREE.Group) => {
    const newSelectable: Selectable = { chasis: [], buttons: [], knobs: [] };
    const newChosenColors: ChosenColors = {
      type: 'configUpdate',
      chasis: initialChasisColor,
      buttons: {},
      knobs: {}
    };

    model.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const meshName = typeof child.name === 'string' ? child.name.toLowerCase() : '';

      if (
        meshName.includes('logo') ||
        meshName.includes('beato') ||
        meshName.includes('crearttech') ||
        meshName.includes('custom midi')
      ) {
        if (child.material && 'map' in child.material && child.material.map) {
          (child.material as THREE.Material).transparent = true;
          (child.material as THREE.Material).alphaTest = 0.9;
        }
      }

      if (meshName.includes('cubechasis')) {
        child.material = new THREE.MeshStandardMaterial({ 
          color: palettes.chasis[initialChasisColor]?.hex || '#808080', 
          metalness: 1, 
          roughness: 0.6 
        });
        newSelectable.chasis.push(child);
        newChosenColors.chasis = initialChasisColor;
      } else if (meshName.includes('boton') && !isKnobo) { // Solo para Beato
        const defaultColor = 'Negro';
        child.material = new THREE.MeshPhysicalMaterial({ 
          color: palettes.buttons[defaultColor]?.hex || '#1C1C1C', 
          metalness: 0.4,
          roughness: 0.68,
          clearcoat: 0.85,
          clearcoatRoughness: 0.08,
          reflectivity: 0.3,
          sheen: 0.5,
          sheenColor: 0x1C1C1C
        });
        newSelectable.buttons.push(child);
        newChosenColors.buttons[child.name] = defaultColor;
      } else if (meshName.startsWith('knob') || (isKnobo && meshName.includes('knob'))) { // Para ambos, pero más específico para Knobo
        if ((child.material as THREE.MeshStandardMaterial)?.color) {
          const mat = child.material as THREE.MeshStandardMaterial;
          const lightness = (mat.color.r + mat.color.g + mat.color.b) / 3;
          const defaultColor = 'Rosa'; // Color por defecto para knobs
          child.material = new THREE.MeshStandardMaterial({ 
            color: palettes.knobs[defaultColor]?.hex || '#FF007F', 
            metalness: 0, 
            roughness: 1 
          });
          newSelectable.knobs.push(child);
          newChosenColors.knobs[child.name] = defaultColor;
        }
      }
    });

    setSelectable(newSelectable);
    setChosenColors(newChosenColors);
    onModelLoaded?.(model, newSelectable, newChosenColors);
  }, [initialChasisColor, palettes, isKnobo, onModelLoaded]);

  // Centrar y escalar modelo
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

  // Aplicar colores al modelo 3D
  const applyColorsToModel = useCallback((config: ChosenColors) => {
    if (!modelRef.current) return;
    // Chasis
    if (config.chasis && selectable.chasis.length > 0) {
      const chasisColor = palettes.chasis[String(config.chasis)]?.hex || '#808080';
      selectable.chasis.forEach(mesh => {
        (mesh.material as THREE.MeshStandardMaterial).color.set(chasisColor);
      });
    }
    // Botones (solo si no es Knobo)
    if (!isKnobo && config.buttons) {
      Object.entries(config.buttons).forEach(([name, colorName]) => {
        const btn = selectable.buttons.find(b => b.name === name);
        const btnColor = palettes.buttons[String(colorName)]?.hex || '#1C1C1C';
        if (btn) {
          (btn.material as THREE.MeshStandardMaterial).color.set(btnColor);
        }
        // Aros asociados
        if (name.toLowerCase().includes('boton')) {
          const buttonNumber = name.match(/\d+/)?.[0] || '';
          const ring = selectable.buttons.find(b => b.name.toLowerCase().includes('aro') && b.name.includes(buttonNumber));
          if (ring) {
            (ring.material as THREE.MeshStandardMaterial).color.set(btnColor);
          }
        }
      });
    }
    // Knobs
    if (config.knobs) {
      Object.entries(config.knobs).forEach(([name, colorName]) => {
        const knob = selectable.knobs.find(k => k.name === name);
        const knobColor = palettes.knobs[String(colorName)]?.hex || '#FF007F';
        if (knob) {
          (knob.material as THREE.MeshStandardMaterial).color.set(knobColor);
        }
      });
    }
    onColorsApplied?.(config);
  }, [modelRef, selectable, palettes, isKnobo, onColorsApplied]);

  // Cargar modelo
  const loadModel = useCallback(async () => {
    try {
      const loader = new GLTFLoader();
      loader.load(modelPath,
        (gltf) => {
          const model = gltf.scene as THREE.Group;
          if (modelRef.current && sceneRef.current) {
            sceneRef.current.remove(modelRef.current);
          }
          modelRef.current = model;
          prepareModelParts(model);
          centerAndScaleModel(model);
          sceneRef.current?.add(model);
          if (!modelOriginalPositionRef.current) {
            modelOriginalPositionRef.current = model.position.clone();
          }
          // Aplica colores si hay una config guardada
          const savedConfig = localStorage.getItem(isKnobo ? 'knoboConfig' : 'beatoConfig');
          if (savedConfig) {
            const config = JSON.parse(savedConfig);
            setChosenColors(config);
            applyColorsToModel(config);
          }
        },
        undefined,
        (error) => {
          console.error('ERROR AL CARGAR EL MODELO:', error);
          alert('No se pudo cargar el modelo 3D. Revisa la ruta o el archivo.');
        }
      );
    } catch (error) {
      console.error('Error importing GLTFLoader:', error);
    }
  }, [modelPath, prepareModelParts, centerAndScaleModel, applyColorsToModel, isKnobo]);

  // Inicialización de Three.js
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      200
    );
    camera.position.copy(CAMERA_VIEWS.normal.pos);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAMERA_VIEWS.normal.target);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 5;
    controlsRef.current = controls;

    setupProfessionalLighting(scene, renderer);
    loadModel();

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();
      // Limpieza de la escena
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      modelRef.current = null;
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

  // Manejo de clicks en el canvas
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!cameraRef.current || !rendererRef.current) return;

    if (currentView === 'chasis') {
      setSelectedForColoring(null);
      if (!isKnobo) setSelectedButtons([]); // Solo para Beato
      return;
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const bounds = rendererRef.current.domElement.getBoundingClientRect();
    
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    
    raycaster.setFromCamera(pointer, cameraRef.current);
    
    let objectsToIntersect: THREE.Mesh[] = [];
    if (currentView === 'buttons' && !isKnobo) {
      objectsToIntersect = selectable.buttons;
    } else if (currentView === 'knobs') {
      objectsToIntersect = selectable.knobs;
    } else if (currentView === 'normal') {
      objectsToIntersect = isKnobo ? selectable.knobs : selectable.buttons;
    }
    
    if (objectsToIntersect.length === 0) return;
    
    const intersects = raycaster.intersectObjects(objectsToIntersect, false);
    
    // Limpia el resaltado
    if (currentView === 'buttons' && !isKnobo) {
      selectable.buttons.forEach(btn => setEmissive(btn, 0x000000));
    }
    if (currentView === 'knobs') {
      selectable.knobs.forEach(knob => setEmissive(knob, 0x000000));
    }
    if (selectedForColoring && currentView !== 'normal') {
      setEmissive(selectedForColoring, 0x000000);
    }
    
    if (intersects.length > 0) {
      const selectedObject = intersects[0].object as THREE.Mesh;
      
      if (currentView === 'normal') {
        return;
      }
      
      if (currentView === 'buttons' && event.shiftKey && !isKnobo) {
        if (selectedButtons.length === 0 && selectedForColoring && selectedForColoring !== selectedObject) {
          setSelectedButtons([selectedForColoring, selectedObject]);
          setSelectedForColoring(null);
          setEmissive(selectedForColoring, 0x444444);
          setEmissive(selectedObject, 0x444444);
        } else {
          setSelectedForColoring(null);
          setSelectedButtons(prev => {
            if (prev.length === 0) {
              setEmissive(selectedObject, 0x444444);
              return [selectedObject];
            }
            const already = prev.includes(selectedObject);
            let newSelected;
            if (already) {
              newSelected = prev.filter(obj => obj !== selectedObject);
              setEmissive(selectedObject, 0x000000);
            } else {
              newSelected = [...prev, selectedObject];
              setEmissive(selectedObject, 0x444444);
            }
            newSelected.forEach(btn => setEmissive(btn, 0x444444));
            return newSelected;
          });
        }
      } else {
        if (!isKnobo) setSelectedButtons([]);
        
        if (currentView === 'buttons' && selectedObject.name.toLowerCase().includes('aro') && !isKnobo) {
          const buttonNumber = parseInt(selectedObject.name.match(/\d+/)?.[0] || '1', 10);
          const associatedButton = selectable.buttons.find(btn => 
            btn.name.toLowerCase().includes('boton') && 
            btn.name.includes(buttonNumber.toString())
          );
          if (associatedButton) {
            setSelectedForColoring(associatedButton);
            setEmissive(associatedButton, 0x444444);
          } else {
            setSelectedForColoring(null);
            return;
          }
        } else {
          setSelectedForColoring(selectedObject);
          setEmissive(selectedObject, 0x444444);
        }
      }
    } else {
      setSelectedForColoring(null);
      if (!isKnobo) setSelectedButtons([]);
      setSelectedKnobs([]);
    }
  }, [currentView, selectable, selectedForColoring, setEmissive, selectedButtons, isKnobo]);

  // Cambiar vista de la cámara
  const changeView = useCallback((viewName: 'normal' | 'chasis' | 'buttons' | 'knobs') => {
    setCurrentView(viewName);

    if (viewName === 'chasis' && selectable.chasis.length > 0) {
      setSelectedForColoring(selectable.chasis[0]);
    } else {
      setSelectedForColoring(null);
    }

    if (!cameraRef.current || !controlsRef.current) return;

    let targetView;
    let enableOrbit;
    if (viewName === 'normal') {
      targetView = CAMERA_VIEWS.normal;
      enableOrbit = true;
    } else {
      targetView = CAMERA_VIEWS.top;
      enableOrbit = false;
    }
    controlsRef.current.enabled = enableOrbit;

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

  // Aplicar color
  const applyColor = useCallback((colorName: string, colorData: PaletteColor) => {
    if (currentView === 'chasis') {
      selectable.chasis.forEach(mesh => {
        (mesh.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
      });
      setChosenColors(prev => ({ ...prev, chasis: colorName }));
      return;
    }

    if (currentView === 'buttons' && selectedButtons.length > 0 && !isKnobo) {
      const newChosenColors = { ...chosenColors, buttons: { ...chosenColors.buttons } };
      selectedButtons.forEach(btn => {
        (btn.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
        newChosenColors.buttons[btn.name] = colorName;
        const associatedRing = findAssociatedRing(btn.name);
        if (associatedRing && associatedRing.material) {
          (associatedRing.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
        }
      });
      setChosenColors(newChosenColors);
      selectedButtons.forEach(btn => setEmissive(btn, 0x000000));
      setSelectedButtons([]);
      return;
    }

    if (currentView === 'knobs' && selectedKnobs.length > 0) {
      const newChosenColors = { ...chosenColors, knobs: { ...chosenColors.knobs } };
      selectedKnobs.forEach(knob => {
        (knob.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
        newChosenColors.knobs[knob.name] = colorName;
      });
      setChosenColors(newChosenColors);
      selectedKnobs.forEach(knob => setEmissive(knob, 0x000000));
      setSelectedKnobs([]);
      return;
    }

    if (!selectedForColoring) {
      // Esto debería ser manejado por el componente que usa el hook
      return;
    }
    (selectedForColoring.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
    const newChosenColors = { ...chosenColors };
    const selectedName = selectedForColoring.name;
    if (selectable.buttons.includes(selectedForColoring) && !isKnobo) {
      newChosenColors.buttons[selectedName] = colorName;
      const associatedRing = findAssociatedRing(selectedName);
      if (associatedRing && associatedRing.material) {
        (associatedRing.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
      }
      setEmissive(selectedForColoring, 0x000000);
    } else if (selectable.knobs.includes(selectedForColoring)) {
      newChosenColors.knobs[selectedName] = colorName;
    }
    setChosenColors(newChosenColors);
  }, [selectedForColoring, selectedButtons, chosenColors, selectable, currentView, findAssociatedRing, selectedKnobs, isKnobo]);

  // Guardar y restaurar configuración
  useEffect(() => {
    localStorage.setItem(isKnobo ? 'knoboConfig' : 'beatoConfig', JSON.stringify(chosenColors));
  }, [chosenColors, isKnobo]);

  useEffect(() => {
    const savedConfig = localStorage.getItem(isKnobo ? 'knoboConfig' : 'beatoConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setChosenColors(config);
      // applyColorsToModel(config); // Se aplica en loadModel
    }
  }, [isKnobo]); // No depende de applyColorsToModel aquí para evitar bucles

  return {
    mountRef,
    cameraRef,
    rendererRef,
    controlsRef,
    modelRef,
    currentView,
    setCurrentView,
    selectedForColoring,
    setSelectedForColoring,
    chosenColors,
    setChosenColors,
    selectable,
    selectedButtons,
    setSelectedButtons,
    selectedKnobs,
    setSelectedKnobs,
    setEmissive,
    handleCanvasClick,
    changeView,
    applyColor,
    modelOriginalPositionRef,
    applyColorsToModel // Exponer para uso externo si es necesario
  };
};
