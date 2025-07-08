import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

// Tipos para los objetos seleccionables
interface Selectable {
  chasis: THREE.Mesh[];
  buttons: THREE.Mesh[];
  knobs: THREE.Mesh[];
}

interface ChosenColors {
  type: string;
  chasis: string;
  buttons: Record<string, string>;
  knobs: Record<string, string>;
}

interface PaletteColor {
  hex: string;
}

interface Palettes {
  chasis: Record<string, PaletteColor>;
  buttons: Record<string, PaletteColor>;
  knobs: Record<string, PaletteColor>;
}

const MidiConfigurator = () => {
  // Referencias para Three.js
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null); // OrbitControls no tiene tipado oficial en three.js
  const modelRef = useRef<THREE.Group | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Estados de React
  const [currentView, setCurrentView] = useState<'normal' | 'chasis' | 'buttons' | 'knobs'>('normal');
  const [selectedForColoring, setSelectedForColoring] = useState<THREE.Mesh | null>(null);
  const [chosenColors, setChosenColors] = useState<ChosenColors>({
    type: 'configUpdate',
    chasis: 'Gris',
    buttons: {},
    knobs: {}
  });
  const [selectable, setSelectable] = useState<Selectable>({ chasis: [], buttons: [], knobs: [] });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  // Ref para guardar el estado anterior de currentView
  const prevViewRef = useRef<'normal' | 'chasis' | 'buttons' | 'knobs'>(currentView);

  // Estado para selección múltiple de botones
  const [selectedButtons, setSelectedButtons] = useState<THREE.Mesh[]>([]);

  // Configuración de paletas
  const PALETTES: Palettes = {
    chasis: {
      'Verde':    { hex: '#1F7A1F' },
      'Amarillo': { hex: '#FFD700' },
      'Azul':     { hex: '#0077FF' },
      'Blanco':   { hex: '#F5F5F5' },
      'Naranja':  { hex: '#FF7300' },
      'Morado':   { hex: '#6A0DAD' },
      'Rojo':     { hex: '#D00000' },
      'Negro':    { hex: '#1C1C1C' },
      'Rosa':     { hex: '#FF007F' },
      'Gris':     { hex: '#808080' },
    },
    buttons: {
      'Verde':    { hex: '#1F7A1F' },
      'Amarillo': { hex: '#FFD700' },
      'Azul':     { hex: '#0077FF' },
      'Blanco':   { hex: '#F5F5F5' },
      'Naranja':  { hex: '#FF7300' },
      'Morado':   { hex: '#6A0DAD' },
      'Rojo':     { hex: '#D00000' },
      'Negro':    { hex: '#1C1C1C' },
      'Rosa':     { hex: '#FF007F' },
      'Gris':     { hex: '#808080' },
    },
    knobs: {
      'Verde':    { hex: '#1F7A1F' },
      'Amarillo': { hex: '#FFD700' },
      'Azul':     { hex: '#0077FF' },
      'Blanco':   { hex: '#F5F5F5' },
      'Naranja':  { hex: '#FF7300' },
      'Morado':   { hex: '#6A0DAD' },
      'Rojo':     { hex: '#D00000' },
      'Negro':    { hex: '#1C1C1C' },
      'Rosa':     { hex: '#FF007F' },
      'Gris':     { hex: '#808080' },
    }
  };

  const CAMERA_VIEWS = {
    normal: { pos: new THREE.Vector3(2, 1, -0.1), target: new THREE.Vector3(0, -0.5, -0.1) },
    top:    { pos: new THREE.Vector3(1, 2, -0.6), target: new THREE.Vector3(-0.1, -0.8, -0.6) },
  };

  // Ref para guardar la posición original del modelo
  const modelOriginalPositionRef = useRef<THREE.Vector3 | null>(null);

  // Guardar posición y target iniciales de la cámara
  const initialCameraPosRef = useRef<THREE.Vector3 | null>(null);
  const initialCameraTargetRef = useRef<THREE.Vector3 | null>(null);
  const prevTargetRef = useRef<THREE.Vector3 | null>(null);

  // Definir la vista top según la imagen del usuario
  const TOP_VIEW_POS = new THREE.Vector3(1, 2, -0.6);
  const TOP_VIEW_TARGET = new THREE.Vector3(-0.1, -0.8, -0.6);

  // ==================================================================
  // INICIO DEL CAMBIO: Función para añadir al carrito de Wix
  // ==================================================================
  const handleAddToCart = useCallback(() => {
    // --- 1. DATOS IMPORTANTES QUE DEBES CONFIGURAR ---
    // Pega aquí el ID de tu producto base oculto que creaste en Wix Stores.
    const productId = "3d58a487-8b74-2a0b-7e04-43fca04e5333"; 

    // --- 2. LÓGICA DE TU CONFIGURADOR ---
    // Aquí debes determinar el paquete de precio y el precio final
    // basado en las elecciones del usuario.
    // Por ahora, usamos valores de ejemplo.
    const paqueteElegido = "Paquete Pro"; // Ejemplo, debes calcular esto
    const precioCalculado = 250.00; // Ejemplo, debes calcular esto

    // --- 3. RECOPILAR ESPECIFICACIONES ---
    // Tomamos los colores elegidos del estado de React.
    const chasis = chosenColors.chasis;
    const botones = Object.values(chosenColors.buttons).join(', ');
    const knobs = Object.values(chosenColors.knobs).join(', ');

    // --- 4. CREAR EL OBJETO PARA ENVIAR A WIX ---
    // Este objeto tiene el formato exacto que espera el código Velo del Paso 3.
    const cartData = {
      productId: productId,
      quantity: 1,
      options: {
        // Le dice a Wix qué opción de precio seleccionar.
        // El nombre "Tipo de Configuración" debe coincidir EXACTAMENTE 
        // con el nombre de la opción que creaste en tu producto de Wix.
        choices: {
          "Tipo de Configuración": paqueteElegido 
        },
        // Guarda las especificaciones detalladas para que se vean en el carrito.
        customTextFields: [{
          title: "Especificaciones",
          value: `Chasis: ${chasis}, Botones: ${botones}, Knobs: ${knobs}`
        }]
      }
    };

    // --- 5. ENVIAR EL MENSAJE A WIX ---
    // Esto le pasa la "nota" a la página de Wix para que añada el producto al carrito.
    if (window.parent) {
      window.parent.postMessage(cartData, "*");
      console.log("Datos del producto dinámico enviados al carrito de Wix:", cartData);
    }
    
    // Opcional: Cierra el modal después de añadir al carrito.
    setShowPaymentModal(false);

  }, [chosenColors]); // La función se recalcula si los colores elegidos cambian.
  // ==================================================================
  // FIN DEL CAMBIO
  // ==================================================================

  // Función para enviar configuración (adaptada para React)
  const sendConfigToWix = useCallback(() => {
    console.log("Enviando actualización de configuración:", chosenColors);
    if (window.parent) {
      window.parent.postMessage(chosenColors, "*");
    }
  }, [chosenColors]);

  // Configuración de iluminación profesional
  const setupProfessionalLighting = useCallback((scene: THREE.Scene, renderer: THREE.WebGLRenderer) => {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 8.5);
    mainLight.position.set(5, 5, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 4096;
    mainLight.shadow.mapSize.height = 4096;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 20;
    mainLight.shadow.normalBias = 0.05;
    scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.01);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
  }, []);

  // Preparar partes del modelo
  const prepareModelParts = useCallback((model: THREE.Group) => {
    const newSelectable: Selectable = { chasis: [], buttons: [], knobs: [] };
    const newChosenColors: ChosenColors = {
      type: 'configUpdate',
      chasis: 'Gris',
      buttons: {},
      knobs: {}
    };

    model.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const meshName = typeof child.name === 'string' ? child.name.toLowerCase() : '';

      // Si es logo/texto y tiene textura PNG, puedes mejorar la visualización así:
      if (
        meshName.includes('logo') ||
        meshName.includes('beato') ||
        meshName.includes('crearttech') ||
        meshName.includes('custom midi')
      ) {
        if (child.material && 'map' in child.material && child.material.map) {
          child.material.transparent = true;
          child.material.alphaTest = 0.9;
        }
      }

      if (meshName.includes('cubechasis')) {
        child.material = new THREE.MeshStandardMaterial({ 
          color: PALETTES.chasis['Gris'].hex, 
          metalness: 0.9, 
          roughness: 0.1 
        });
        newSelectable.chasis.push(child);
        newChosenColors.chasis = 'Gris';
      }
      else if (meshName.includes('boton') || meshName.includes('aro')) {
        const defaultColor = 'Negro';
        child.material = new THREE.MeshStandardMaterial({ 
          color: PALETTES.buttons[defaultColor].hex, 
          metalness: 0.4, 
          roughness: 0.2 
        });
        newSelectable.buttons.push(child);
        newChosenColors.buttons[child.name] = defaultColor;
      }
      else if (meshName.includes('knob')) {
        if ((child.material as THREE.MeshStandardMaterial)?.color) {
          const mat = child.material as THREE.MeshStandardMaterial;
          const lightness = (mat.color.r + mat.color.g + mat.color.b) / 3;
          if (lightness < 0.5) {
            const defaultColor = 'Rosa';
            child.material = new THREE.MeshStandardMaterial({ 
              color: PALETTES.knobs[defaultColor].hex, 
              metalness: 0, 
              roughness: 1 
            });
            newSelectable.knobs.push(child);
            newChosenColors.knobs[child.name] = defaultColor;
          } else {
            child.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
          }
        }
      }
    });

    setSelectable(newSelectable);
    setChosenColors(newChosenColors);
  }, []);

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

  // Cargar modelo
  const loadModel = useCallback(async () => {
    try {
      // Importar GLTFLoader dinámicamente
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      
      loader.load('./models/BEATO3.glb', (gltf: any) => {
        const model = gltf.scene as THREE.Group;
        modelRef.current = model;
        prepareModelParts(model);
        centerAndScaleModel(model);
        sceneRef.current?.add(model);
        // Guardar la posición original del modelo solo si no está guardada
        if (!modelOriginalPositionRef.current) {
          modelOriginalPositionRef.current = model.position.clone();
        }
        // Forzar color negro en todos los botones y aros
        const negroHex = 0x1C1C1C;
        model.traverse((child: any) => {
          // LOGOS Y TEXTOS AQUÍ: Si tienes meshes de logo/texto con textura, puedes modificar su material aquí
          if (
            child.isMesh &&
            (
              (typeof child.name === 'string' && child.name.toLowerCase().includes('boton')) ||
              (typeof child.name === 'string' && child.name.toLowerCase().includes('aro'))
            )
          ) {
            if (child.material && 'color' in child.material) {
              child.material.color.setHex(negroHex);
            }
          }
        });
        modelRef.current.traverse(obj => {
          if (obj.isMesh) console.log(obj.name);
        });
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
    sceneRef.current = scene;

    // Crear renderer
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

    // Crear cámara
    const camera = new THREE.PerspectiveCamera(
      45, 
      mountRef.current.clientWidth / mountRef.current.clientHeight, 
      0.1, 
      200
    );
    camera.position.copy(CAMERA_VIEWS.normal.pos);
    cameraRef.current = camera;

    // Crear controles (importar dinámicamente)
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(CAMERA_VIEWS.normal.target);
      controls.enableDamping = true;
      controls.minDistance = 2;
      controls.maxDistance = 5;
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

  // Función para establecer emisivo
  const setEmissive = useCallback((object: THREE.Mesh | null, color: number = 0x000000) => {
    if (object && (object.material as THREE.MeshStandardMaterial)?.emissive) {
      (object.material as THREE.MeshStandardMaterial).emissive.setHex(color);
    }
  }, []);

  // Manejo de clicks en el canvas
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!cameraRef.current || !rendererRef.current) return;

    // Si la vista es 'chasis', no permitir seleccionar nada
    if (currentView === 'chasis') {
      setSelectedForColoring(null);
      setSelectedButtons([]);
      return;
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const bounds = rendererRef.current.domElement.getBoundingClientRect();
    
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    
    raycaster.setFromCamera(pointer, cameraRef.current);
    
    // Determinar qué objetos intersectar según la vista
    let objectsToIntersect: THREE.Mesh[] = [];
    if (currentView === 'buttons') {
      objectsToIntersect = selectable.buttons;
    } else if (currentView === 'knobs') {
      objectsToIntersect = selectable.knobs;
    } else if (currentView === 'normal') {
      // En vista normal, permitir clicks en botones para animación
      objectsToIntersect = selectable.buttons;
    }
    
    if (objectsToIntersect.length === 0) return;
    
    const intersects = raycaster.intersectObjects(objectsToIntersect, false);
    // Limpia el resaltado de todos los botones (solo en vista de botones)
    if (currentView === 'buttons') {
      selectable.buttons.forEach(btn => setEmissive(btn, 0x000000));
    }
    if (selectedForColoring && currentView !== 'normal') {
      setEmissive(selectedForColoring, 0x000000);
    }
    
    if (intersects.length > 0) {
      const selectedObject = intersects[0].object as THREE.Mesh;
      
      // En vista normal, solo reproducir animación sin selección
      if (currentView === 'normal') {
        return;
      }
      
      if (currentView === 'buttons' && event.shiftKey) {
        if (selectedButtons.length === 0 && selectedForColoring && selectedForColoring !== selectedObject) {
          setSelectedButtons([selectedForColoring, selectedObject]);
          setSelectedForColoring(null);
          // Aplicar glow a ambos botones seleccionados
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
              // Quitar glow del botón deseleccionado
              setEmissive(selectedObject, 0x000000);
            } else {
              newSelected = [...prev, selectedObject];
              setEmissive(selectedObject, 0x444444);
            }
            // Aplicar glow a todos los botones seleccionados
            newSelected.forEach(btn => setEmissive(btn, 0x444444));
            return newSelected;
          });
        }
      } else {
        setSelectedButtons([]);
        
        // Si es un aro, seleccionar también su botón asociado
        if (currentView === 'buttons' && selectedObject.name.toLowerCase().includes('aro')) {
          // Buscar el botón asociado al aro
          const buttonNumber = parseInt(selectedObject.name.match(/\d+/)?.[0] || '1', 10);
          const associatedButton = selectable.buttons.find(btn => 
            btn.name.toLowerCase().includes('boton') && 
            btn.name.includes(buttonNumber.toString())
          );
          if (associatedButton) {
            // Seleccionar el botón asociado en lugar del aro
            setSelectedForColoring(associatedButton);
            // Aplicar glow al botón seleccionado
            setEmissive(associatedButton, 0x444444);
          } else {
            // Si no encuentra el botón, seleccionar el aro
            setSelectedForColoring(selectedObject);
            setEmissive(selectedObject, 0x444444);
          }
        } else {
          // Si es un botón, seleccionarlo normalmente
          setSelectedForColoring(selectedObject);
          // Aplicar glow al botón seleccionado
          setEmissive(selectedObject, 0x444444);
        }
      }
    } else {
      setSelectedForColoring(null);
      setSelectedButtons([]);
    }
  }, [currentView, selectable, selectedForColoring, setEmissive, selectedButtons]);

  // Función para animar la cámara y el target a una vista específica
  const animateCameraToView = useCallback((view: { pos: THREE.Vector3, target: THREE.Vector3 }) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const duration = 800;
    const startTime = Date.now();
    const startPos = cameraRef.current.position.clone();
    const startTarget = controlsRef.current.target.clone();
    const endPos = view.pos.clone();
    const endTarget = view.target.clone();
    function animateCamera() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      cameraRef.current!.position.lerpVectors(startPos, endPos, ease);
      controlsRef.current!.target.lerpVectors(startTarget, endTarget, ease);
      controlsRef.current!.update();
      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      }
    }
    animateCamera();
  }, []);

  // Función para encontrar el aro asociado a un botón
  const findAssociatedRing = useCallback((buttonName: string): THREE.Mesh | null => {
    if (!modelRef.current) return null;
    // Buscar un aro que tenga un nombre similar al botón
    let associatedRing: THREE.Mesh | null = null;
    modelRef.current.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.name.toLowerCase().includes('aro')) {
        // Buscar coincidencia por número o posición
        const buttonNumber = buttonName.match(/\d+/);
        const ringNumber = child.name.match(/\d+/);
        if (buttonNumber && ringNumber && buttonNumber[0] === ringNumber[0]) {
          associatedRing = child;
        }
      }
    });
    return associatedRing;
  }, []);

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

    // Animar la cámara y el target suavemente con gsap
    gsap.to(cameraRef.current.position, {
      duration: 1.2,
      ease: 'power3.inOut',
      x: targetView.pos.x,
      y: targetView.pos.y,
      z: targetView.pos.z,
      onUpdate: () => {
        cameraRef.current && cameraRef.current.updateProjectionMatrix();
      }
    });
    gsap.to(controlsRef.current.target, {
      duration: 1.2,
      ease: 'power3.inOut',
      x: targetView.target.x,
      y: targetView.target.y,
      z: targetView.target.z,
      onUpdate: () => controlsRef.current.update(),
    });
  }, [selectable]);

  // Aplicar color
  const applyColor = useCallback((colorName: string, colorData: PaletteColor) => {
    // Si estamos en la vista de chasis, aplica el color a todos los meshes del chasis
    if (currentView === 'chasis') {
      selectable.chasis.forEach(mesh => {
        (mesh.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
      });
      setChosenColors(prev => ({ ...prev, chasis: colorName }));
      return;
    }

    // Si hay selección múltiple de botones
    if (currentView === 'buttons' && selectedButtons.length > 0) {
      const newChosenColors = { ...chosenColors, buttons: { ...chosenColors.buttons } };
      selectedButtons.forEach(btn => {
        (btn.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
        newChosenColors.buttons[btn.name] = colorName;
        // Aplicar el mismo color al aro asociado
        const associatedRing = findAssociatedRing(btn.name);
        if (associatedRing && associatedRing.material) {
          (associatedRing.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
          newChosenColors.buttons[associatedRing.name] = colorName;
        }
      });
      setChosenColors(newChosenColors);
      // Quitar glow de los botones seleccionados
      selectedButtons.forEach(btn => setEmissive(btn, 0x000000));
      setSelectedButtons([]); // Deselecciona después de aplicar color
      return;
    }

    // Selección individual
    if (!selectedForColoring) {
      alert("Primero haz clic en una pieza del controlador o selecciona una vista de edición.");
      return;
    }
    (selectedForColoring.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
    const newChosenColors = { ...chosenColors };
    const selectedName = selectedForColoring.name;
    if (selectable.buttons.includes(selectedForColoring)) {
      newChosenColors.buttons[selectedName] = colorName;
      // Aplicar el mismo color al aro asociado si es un botón
      if (selectedName.toLowerCase().includes('boton')) {
        const associatedRing = findAssociatedRing(selectedName);
        if (associatedRing && associatedRing.material) {
          (associatedRing.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
          newChosenColors.buttons[associatedRing.name] = colorName;
        }
      }
      // Quitar glow del botón seleccionado
      setEmissive(selectedForColoring, 0x000000);
    } else if (selectable.knobs.includes(selectedForColoring)) {
      newChosenColors.knobs[selectedName] = colorName;
    }
    setChosenColors(newChosenColors);
  }, [selectedForColoring, selectedButtons, chosenColors, selectable, currentView, findAssociatedRing]);

  // Abrir modal de pago y capturar imagen con vista frontal fija
  const handleOpenPayment = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    // Guardar posición, target y FOV originales
    const originalPos = cameraRef.current.position.clone();
    const originalTarget = controlsRef.current ? controlsRef.current.target.clone() : null;
    const originalFov = cameraRef.current.fov;

    // Mover a la posición inicial (frontal) - usar la vista normal mejorada
    const initialPos = CAMERA_VIEWS.normal.pos.clone();
    const initialTarget = CAMERA_VIEWS.normal.target.clone();
    cameraRef.current.position.copy(initialPos);
    cameraRef.current.fov = 35; // FOV ligeramente más amplio para mejor vista
    cameraRef.current.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.copy(initialTarget);
      controlsRef.current.update();
    }

    setTimeout(() => {
      rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
      const img = rendererRef.current!.domElement.toDataURL('image/png');
      setScreenshot(img);

      // Restaurar posición, target y FOV originales
      cameraRef.current!.position.copy(originalPos);
      cameraRef.current!.fov = originalFov;
      cameraRef.current!.updateProjectionMatrix();
      if (controlsRef.current && originalTarget) {
        controlsRef.current.target.copy(originalTarget);
        controlsRef.current.update();
      }
      setShowPaymentModal(true);
    }, 50);
  }, []);

  // Obtener título según la vista
  const getTitle = () => {
    switch (currentView) {
      case 'chasis': return 'ELIGE EL COLOR DEL CHASIS';
      case 'buttons': return 'PERSONALIZA LOS BOTONES';
      case 'knobs': return 'ESCOGE PARA LOS KNOBS';
      default: return 'ELIGE UN COLOR';
    }
  };

  // Obtener colores según la vista
  const getCurrentColors = () => {
    switch (currentView) {
      case 'chasis': return PALETTES.chasis;
      case 'buttons': return PALETTES.buttons;
      case 'knobs': return PALETTES.knobs;
      default: return {};
    }
  };

  // Enviar configuración cuando cambie
  useEffect(() => {
    sendConfigToWix();
  }, [sendConfigToWix]);

  // Actualizar la referencia de la vista anterior
  useEffect(() => {
    prevViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    // Guardar la posición y target iniciales después de montar la cámara y controles
    setTimeout(() => {
      if (cameraRef.current && controlsRef.current) {
        initialCameraPosRef.current = cameraRef.current.position.clone();
        initialCameraTargetRef.current = controlsRef.current.target.clone();
      }
    }, 100);
  }, []);

  return (
    <div className="w-full h-screen bg-black text-gray-200 overflow-hidden relative">
      {/* Título principal */}
      <div className="absolute top-6 left-32 z-10">
        <h1 className="text-2xl text-white font-bold leading-none m-0 text-shadow">
          PERSONALIZA TU
          <span className="block relative">
            CONTROLADOR
            <div className="absolute left-0 bottom-0 h-1 w-3/5 bg-green-400 rounded-lg"></div>
          </span>
        </h1>
      </div>

      {/* Botón de inicio */}
      <button 
        className="fixed top-6 left-6 z-50 px-5 py-2 bg-purple-400 text-black border border-purple-400 rounded font-bold text-sm uppercase tracking-wide transition-all duration-200 hover:bg-yellow-200 hover:border-yellow-200 hover:-translate-y-0.5 hover:shadow-lg shadow-[0_0_8px_2px_#a259ff80,0_0_16px_4px_#0ff5]"
        onClick={() => window.location.href = 'https://www.crearttech.com/'}
      >
        Inicio
      </button>

      {/* Container principal */}
      <main className="flex w-full h-full">
        {/* Canvas container */}
        <div className="flex-grow h-full bg-gradient-to-t from-gray-800 to-gray-400">
          <div
            ref={mountRef}
            className="w-full h-full transition-all duration-300"
            onClick={handleCanvasClick}
          />
        </div>
      </main>

      {/* Botón de comprar (solo visible en vista normal) */}
      {currentView === 'normal' && (
        <button 
          onClick={handleOpenPayment}
          className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 text-lg font-bold uppercase tracking-wide text-black bg-purple-400 border-none rounded cursor-pointer transition-all duration-200 shadow-lg hover:bg-yellow-200 hover:scale-105 hover:shadow-xl shadow-[0_0_8px_2px_#a259ff80,0_0_16px_4px_#0ff5]"
        >
          AÑADIR AL CARRITO
        </button>
      )}

      {/* Modal de pago */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative bg-[#3a4060] rounded-2xl shadow-2xl border-2 border-[#a259ff] p-4 md:py-4 md:px-8 w-full max-w-4xl mx-4 animate-fade-in">
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-pink-400 text-2xl font-bold">×</button>
            <h2 className="text-3xl md:text-4xl font-bold text-purple-400 mb-4 text-center tracking-widest">PAGO SEGURO</h2>
            <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
              <div className="w-full max-w-[320px] md:max-w-[380px] aspect-[4/3] flex items-center justify-center ml-16 md:ml-24">
                {screenshot && (
                  <img src={screenshot} alt="Controlador personalizado" className="w-full h-full object-contain" style={{ background: 'none', boxShadow: 'none', border: 'none' }} />
                )}
              </div>
              <div className="flex-1 mt-8 md:mt-0">
                <h3 className="text-xl font-semibold mb-2 text-cyan-400">Tu configuración:</h3>
                <ul className="text-base space-y-1">
                  <li><b>Chasis:</b> {chosenColors.chasis}</li>
                  <li><b>Botones:</b> {Object.values(chosenColors.buttons).join(', ') || 'Por defecto'}</li>
                  <li><b>Perillas:</b> {Object.values(chosenColors.knobs).join(', ') || 'Por defecto'}</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-col gap-4 mt-4">
                  {/* ================================================================== */}
                  {/* INICIO DEL CAMBIO: Botón para añadir al carrito */}
                  {/* ================================================================== */}
              <button
                className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-400 to-cyan-400 text-white font-bold text-lg shadow-[0_0_12px_2px_#a259ff80] hover:scale-105 transition-all flex items-center justify-center gap-2"
                    onClick={handleAddToCart}
              >
                AÑADIR Y VER EN CARRITO
              </button>
                  {/* ================================================================== */}
                  {/* FIN DEL CAMBIO */}
                  {/* ================================================================== */}
            </div>
            <p className="text-xs text-gray-400 mt-6 text-center">Tu compra es 100% segura y protegida.</p>
          </div>
        </div>
      )}

      {/* Panel de UI */}
      <div className={`fixed top-0 right-0 h-screen bg-gray-900 border-l border-gray-700 shadow-2xl transition-all duration-400 flex overflow-hidden ${
        currentView === 'normal' ? 'w-28' : 'w-[480px]'
      }`}>
        
        {/* Columna de controles de vista */}
        <div className="w-28 p-6 flex-shrink-0" style={{ paddingTop: '200px' }}>
          <div className="flex flex-col gap-2">
            {[
              { id: 'normal', icon: 'M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5M12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17M12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z', title: 'Vista General' },
              { id: 'chasis', icon: 'M3 3H21V21H3V3M5 5V19H19V5H5Z', title: 'Chasis' },
              { id: 'buttons', icon: 'M4 4H8V8H4V4M10 4H14V8H10V4M16 4H20V8H16V4M4 10H8V14H4V10M10 10H14V14H10V10M16 10H20V14H16V10M4 16H8V20H4V16M10 16H14V20H10V16M16 16H20V20H16V20Z', title: 'Botones' },
              { id: 'knobs', icon: 'M10 16.5C10 18.98 12.02 21 14.5 21S19 18.98 19 16.5C19 14.02 16.98 12 14.5 12S10 14.02 10 16.5M5 7.5C5 9.98 7.02 12 9.5 12S14 9.98 14 7.5C14 5.02 11.98 3 9.5 3S5 5.02 5 7.5Z', title: 'Knobs' }
            ].map(({ id, icon, title }) => (
              <button
                key={id}
                onClick={() => changeView(id as 'normal' | 'chasis' | 'buttons' | 'knobs')}
                className={`w-full aspect-square border rounded flex items-center justify-center p-3 transition-all duration-200 ${
                  currentView === id 
                    ? 'bg-[#a259ff] border-[#a259ff] shadow-[0_0_8px_2px_#a259ff80,0_0_16px_4px_#0ff5,0_0_2px_1px_#fff3] text-white'
                    : 'border-gray-600 bg-gray-800 bg-opacity-80 hover:bg-gray-600 hover:border-[#a259ff] text-gray-200 hover:shadow-[0_0_4px_1px_#a259ff60,0_0_8px_2px_#0ff3]'
                }`}
                title={title}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  className={`w-3/5 h-3/5 fill-current transition-colors duration-200 ${
                    currentView === id ? 'text-gray-900' : 'text-gray-200 hover:text-purple-400'
                  }`}
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
                    fontFamily: 'Orbitron, Arial, sans-serif',
                    background: 'linear-gradient(90deg, #a259ff 0%, #0ff 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 12px #a259ff, 0 0 24px #0ff, 0 0 2px #fff',
                    letterSpacing: '0.04em',
                    marginLeft: '-0.25em',
                    overflowWrap: 'anywhere',
                  }}
                >
                  ONFIGURADOR
                </h2>
              </>
            )}
          </div>

          {/* Sección de colores */}
          <div className="mt-6">
            <p className="font-black text-sm tracking-wide uppercase m-0 mb-3 text-gray-200 text-left">
              {getTitle()}
            </p>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4 md:gap-6 p-1 md:p-2 bg-black bg-opacity-20 rounded overflow-x-auto">
              {Object.entries(getCurrentColors()).map(([name, colorData]) => (
                <div
                  key={name}
                  className="w-12 h-12 rounded-full cursor-pointer border-2 border-[#a259ff] shadow-[0_0_6px_1px_#a259ff55] transition-all duration-200 shadow-inner hover:scale-110"
                  style={{ backgroundColor: colorData.hex }}
                  title={name}
                  onClick={() => applyColor(name, colorData)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MidiConfigurator;
