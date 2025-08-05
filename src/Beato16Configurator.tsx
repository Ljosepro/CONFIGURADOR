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
  buttons: THREE.Mesh[];
  knobs: THREE.Mesh[];
  teclas: THREE.Mesh[];
  faders: THREE.Mesh[];
}

interface ChosenColors {
  type: string;
  chasis: string;
  buttons: Record<string, string>;
  knobs: Record<string, string>;
  teclas: Record<string, string>;
  faders: Record<string, string>;
}

interface PaletteColor {
  hex: string;
}

interface Palettes {
  chasis: Record<string, PaletteColor>;
  buttons: Record<string, PaletteColor>;
  knobs: Record<string, PaletteColor>;
  teclas: Record<string, PaletteColor>;
  faders: Record<string, PaletteColor>;
}

const Beato16Configurator: React.FC<{ onProductChange?: (product: 'beato' | 'knobo' | 'mixo' | 'beato16') => void }> = ({ onProductChange }) => {
  // === PayU CREDENTIALS (solo para pruebas, no producción) ===
  // Eliminadas variables no usadas: PAYU_API_KEY, PAYU_MERCHANT_ID, PAYU_ACCOUNT_ID, PAYU_PUBLIC_KEY, PAYU_DESCRIPTION, PAYU_CURRENCY, PAYU_TEST
  // Eliminadas variables de estado no usadas: payuSignature, setPayuSignature, payuReference, setPayuReference
  // Eliminada referencia no usada: clockRef
  // Eliminada variable no usada: precioCalculado


  // Estado para la firma PayU y referencia
  const [payuSignature, setPayuSignature] = useState("");
  const [payuReference, setPayuReference] = useState("");

  // Referencias para Three.js
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null); // OrbitControls no tiene tipado oficial en three.js
  const modelRef = useRef<THREE.Group | null>(null);
  const modelOriginalPositionRef = useRef<THREE.Vector3 | null>(null);

    // Estados de React
  const [currentView, setCurrentView] = useState<'normal' | 'chasis' | 'buttons' | 'knobs' | 'teclas' | 'faders'>(() => {
    const saved = localStorage.getItem('beato16_currentView');
    return saved ? (saved as 'normal' | 'chasis' | 'buttons' | 'knobs' | 'teclas' | 'faders') : 'normal';
  });
  const [selectedForColoring, setSelectedForColoring] = useState<THREE.Mesh | null>(null);
  const [chosenColors, setChosenColors] = useState<ChosenColors>(() => {
    const saved = localStorage.getItem('beato16_chosenColors');
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
      buttons: {},
      knobs: {},
      teclas: {},
      faders: {}
    };
  });
    const [selectable, setSelectable] = useState<Selectable>({ chasis: [], buttons: [], knobs: [], teclas: [], faders: [] });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  // Estado para mostrar el modal de carrito
  const [showCartModal, setShowCartModal] = useState(false);

    // Ref para guardar el estado anterior de currentView
  const prevViewRef = useRef<'normal' | 'chasis' | 'buttons' | 'knobs' | 'teclas' | 'faders'>(currentView);

  // Estado para selección múltiple de botones
  const [selectedButtons, setSelectedButtons] = useState<THREE.Mesh[]>([]);

  // Estado para selección múltiple de knobs
  const [selectedKnobs, setSelectedKnobs] = useState<THREE.Mesh[]>([]);

  // Estado para selección múltiple de teclas
  const [selectedTeclas, setSelectedTeclas] = useState<THREE.Mesh[]>([]);

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
    buttons: {
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
    },
    teclas: {
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
    }
  };

  const CAMERA_VIEWS = {
    normal: { pos: new THREE.Vector3(2, 1, -0.1), target: new THREE.Vector3(0, -0.5, -0.1) },
    top:    { pos: new THREE.Vector3(1, 1.65, -0.6), target: new THREE.Vector3(-0.35, -0.9, -0.6) },
  };

  // Guardar posición y target iniciales de la cámara
  const initialCameraPosRef = useRef<THREE.Vector3 | null>(null);
  const initialCameraTargetRef = useRef<THREE.Vector3 | null>(null);

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
    setShowCartModal(true);

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

  // 1. Cargar el environment map y aplicarlo a la escena y materiales
  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load('public/textures/blackhole.jpg.avif', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      setEnvMap(texture);
    });
  }, []);

    // 2. Mejorar la iluminación
  const setupProfessionalLighting = useCallback((scene: THREE.Scene, renderer: THREE.WebGLRenderer) => {
    // Luz ambiental suave
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); // antes 1.2
    scene.add(ambientLight);

    // Luz direccional principal (tipo sol)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2); // antes 3.9
    mainLight.position.set(5, 4, -1);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 4096;
    mainLight.shadow.mapSize.height = 4096;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.normalBias = 0.02;
    scene.add(mainLight);

        // Luz de relleno fría
    const fillLight = new THREE.DirectionalLight(0x99ccff, 1.0); //3.3
    fillLight.position.set(-8, 3, -9);
    scene.add(fillLight);

    // Luz de relleno adicional
    const fillLight2 = new THREE.DirectionalLight(0x99ccff, 1.0); //3.0
    fillLight2.position.set(-8, 3, 15);
    scene.add(fillLight2);

    // Luz puntual para brillos
    const pointLight = new THREE.PointLight(0xffffff, 0.7, 0.5);
    pointLight.position.set(0, 5, 5);
    scene.add(pointLight);

    // LUZ EXTRA DETRÁS DEL CONTROLADOR - BEATO16 CONFIGURATOR
    // Esta luz apunta desde detrás del controlador para crear un efecto de contorno
    const backLight = new THREE.DirectionalLight(0xffffff, 1.2); //2.2
    backLight.position.set(-5, 30, 0); // Posicionada detrás del controlador
    backLight.castShadow = true;
    backLight.shadow.mapSize.width = 2048;
    backLight.shadow.mapSize.height = 2048;
    backLight.shadow.camera.near = 0.5;
    backLight.shadow.camera.far = 50;
    backLight.shadow.normalBias = 0.02;
    scene.add(backLight);
  }, []);

    // 3. Al cargar el modelo, aplicar el envMap y MeshPhysicalMaterial
  const prepareModelParts = useCallback((model: THREE.Group) => {
    const newSelectable: Selectable = { chasis: [], buttons: [], knobs: [], teclas: [], faders: [] };
    const newChosenColors: ChosenColors = {
      type: 'configUpdate',
      chasis: 'Azul',
      buttons: {},
      knobs: {},
      teclas: {},
      faders: {}
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
                    color: PALETTES.chasis['Azul'].hex, 
          metalness: 1, // sube un poco
          roughness: 0.6 // baja un poco
        });
        newSelectable.chasis.push(child);
                newChosenColors.chasis = 'Azul';
      }
      else if (meshName.includes('boton')) {
        const defaultColor = 'Negro';
        child.material = new THREE.MeshPhysicalMaterial({ 
          color: PALETTES.buttons[defaultColor].hex, 
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
      else if (meshName.includes('tecla')) {
        const defaultColor = 'Negro';
        child.material = new THREE.MeshPhysicalMaterial({ 
          color: PALETTES.teclas[defaultColor].hex, 
          metalness: 0.4,
          roughness: 0.68,
          clearcoat: 0.85,
          clearcoatRoughness: 0.08,
          reflectivity: 0.3,
          sheen: 0.5,
          sheenColor: 0x1C1C1C
        });
        newSelectable.teclas.push(child);
        newChosenColors.teclas[child.name] = defaultColor;
      }
      else if (meshName.includes('fader')) {
        const defaultColor = 'Rosa';
        child.material = new THREE.MeshStandardMaterial({ 
          color: PALETTES.faders[defaultColor].hex, 
          metalness: 0, 
          roughness: 1 
        });
        newSelectable.faders.push(child);
        newChosenColors.faders[child.name] = defaultColor;
      }
    });

    setSelectable(newSelectable);
    setChosenColors(newChosenColors);
  }, [envMap]);

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
      
            loader.load('./models/beato16.glb', (gltf: any) => {
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
          // --- CLONAR MATERIAL DE AROS ---
          if (
            child.isMesh &&
            typeof child.name === 'string' &&
            child.name.toLowerCase().includes('aro')
          ) {
            child.material = child.material.clone();
          }
        });
                modelRef.current.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.Mesh) console.log(obj.name);
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

  // Guardar currentView en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('beato16_currentView', currentView);
  }, [currentView]);

    // Guardar chosenColors en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('beato16_chosenColors', JSON.stringify(chosenColors));
  }, [chosenColors]);

  // Aplicar colores guardados cuando se prepare el modelo
  useEffect(() => {
    if (selectable.chasis.length > 0 || selectable.buttons.length > 0 || selectable.knobs.length > 0) {
      // Aplicar color del chasis
      if (chosenColors.chasis && PALETTES.chasis[chosenColors.chasis]) {
        const colorHex = PALETTES.chasis[chosenColors.chasis].hex;
        selectable.chasis.forEach(mesh => {
          if (mesh.material && 'color' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).color.setHex(parseInt(colorHex.replace('#', ''), 16));
          }
        });
      }

      // Aplicar colores de botones
      Object.entries(chosenColors.buttons).forEach(([buttonName, colorName]) => {
        if (PALETTES.buttons[colorName]) {
          const colorHex = PALETTES.buttons[colorName].hex;
          const buttonMesh = selectable.buttons.find(btn => btn.name === buttonName);
          if (buttonMesh && buttonMesh.material && 'color' in buttonMesh.material) {
            (buttonMesh.material as THREE.MeshStandardMaterial).color.setHex(parseInt(colorHex.replace('#', ''), 16));
          }
        }
      });

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
    } else if (currentView === 'teclas') {
      objectsToIntersect = selectable.teclas;
    } else if (currentView === 'faders') {
      objectsToIntersect = selectable.faders;
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
      } else if (currentView === 'knobs' && event.shiftKey) {
        if (selectedKnobs.length === 0 && selectedForColoring && selectedForColoring !== selectedObject) {
          setSelectedKnobs([selectedForColoring, selectedObject]);
          setSelectedForColoring(null);
          setEmissive(selectedForColoring, 0x444444);
          setEmissive(selectedObject, 0x444444);
        } else {
          setSelectedForColoring(null);
          setSelectedKnobs(prev => {
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
            newSelected.forEach(knob => setEmissive(knob, 0x444444));
            return newSelected;
          });
        }
      } else if (currentView === 'teclas' && event.shiftKey) {
        if (selectedTeclas.length === 0 && selectedForColoring && selectedForColoring !== selectedObject) {
          setSelectedTeclas([selectedForColoring, selectedObject]);
          setSelectedForColoring(null);
          setEmissive(selectedForColoring, 0x444444);
          setEmissive(selectedObject, 0x444444);
        } else {
          setSelectedForColoring(null);
          setSelectedTeclas(prev => {
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
            newSelected.forEach(tecla => setEmissive(tecla, 0x444444));
            return newSelected;
          });
        }
      } else if (currentView === 'faders' && event.shiftKey) {
        if (selectedFaders.length === 0 && selectedForColoring && selectedForColoring !== selectedObject) {
          setSelectedFaders([selectedForColoring, selectedObject]);
          setSelectedForColoring(null);
          setEmissive(selectedForColoring, 0x444444);
          setEmissive(selectedObject, 0x444444);
        } else {
          setSelectedForColoring(null);
          setSelectedFaders(prev => {
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
            newSelected.forEach(fader => setEmissive(fader, 0x444444));
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
            setSelectedForColoring(associatedButton);
            setEmissive(associatedButton, 0x444444);
          } else {
            // Si no encuentra el botón, NO selecciona ni resalta nada
            setSelectedForColoring(null);
            return;
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
      setSelectedKnobs([]);
      setSelectedTeclas([]);
      setSelectedFaders([]);
    }
    }, [currentView, selectable, selectedForColoring, setEmissive, selectedButtons, selectedKnobs, selectedTeclas, selectedFaders]);

  // Función para encontrar el aro asociado a un botón
  const findAssociatedRing = useCallback((buttonName: string): THREE.Mesh | null => {
    if (!modelRef.current) return null;
    let associatedRing: THREE.Mesh | null = null;
    // Extrae el número del botón (por ejemplo, 'Boton1' => '1')
    const buttonNumber = buttonName.match(/\d+/)?.[0];
    if (!buttonNumber) return null;
    modelRef.current.traverse((child: THREE.Object3D) => {
      if (
        child instanceof THREE.Mesh &&
        child.name.toLowerCase().includes('aro')
      ) {
        // Extrae el número del aro
        const ringNumber = child.name.match(/\d+/)?.[0];
        if (ringNumber === buttonNumber) {
          associatedRing = child;
        }
      }
    });
    return associatedRing;
  }, []);

    const changeView = useCallback((viewName: 'normal' | 'chasis' | 'buttons' | 'knobs' | 'teclas' | 'faders') => {
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
        // Cambiar color del aro correspondiente
        const associatedRing = findAssociatedRing(btn.name);
        if (associatedRing && associatedRing.material) {
          (associatedRing.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
          // Opcional: puedes guardar el color del aro en chosenColors si lo necesitas
        }
      });
      setChosenColors(newChosenColors);
      selectedButtons.forEach(btn => setEmissive(btn, 0x000000));
      setSelectedButtons([]);
      return;
    }

        // En la vista de knobs, si hay selección múltiple
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

    // En la vista de teclas, si hay selección múltiple
    if (currentView === 'teclas' && selectedTeclas.length > 0) {
      const newChosenColors = { ...chosenColors, teclas: { ...chosenColors.teclas } };
      selectedTeclas.forEach(tecla => {
        (tecla.material as THREE.MeshPhysicalMaterial).color.set(colorData.hex);
        newChosenColors.teclas[tecla.name] = colorName;
      });
      setChosenColors(newChosenColors);
      selectedTeclas.forEach(tecla => setEmissive(tecla, 0x000000));
      setSelectedTeclas([]);
      return;
    }

    // En la vista de faders, si hay selección múltiple
    if (currentView === 'faders' && selectedFaders.length > 0) {
      const newChosenColors = { ...chosenColors, faders: { ...chosenColors.faders } };
      selectedFaders.forEach(fader => {
        (fader.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
        newChosenColors.faders[fader.name] = colorName;
      });
      setChosenColors(newChosenColors);
      selectedFaders.forEach(fader => setEmissive(fader, 0x000000));
      setSelectedFaders([]);
      return;
    }

    // Selección individual
    if (!selectedForColoring) {
      Swal.fire({
        title: 'Selecciona una parte',
        text: 'Haz clic en una pieza del controlador para aplicar el color.',
        imageUrl: 'models/logo.png', // Cambia por la ruta de tu ilustración
        imageWidth: 120,
        imageHeight: 120,
        background: '#232846',
        color: '#fff',
        confirmButtonColor: '#a259ff',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    (selectedForColoring.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
    const newChosenColors = { ...chosenColors };
    const selectedName = selectedForColoring.name;
    if (selectable.buttons.includes(selectedForColoring)) {
      newChosenColors.buttons[selectedName] = colorName;
      // Cambiar color del aro correspondiente SOLO para ese botón
      if (selectedName.toLowerCase().includes('boton')) {
        const associatedRing = findAssociatedRing(selectedName);
        if (associatedRing && associatedRing.material) {
          (associatedRing.material as THREE.MeshStandardMaterial).color.set(colorData.hex);
          // Opcional: puedes guardar el color del aro en chosenColors si lo necesitas
        }
      }
      // Quitar glow del botón seleccionado
      setEmissive(selectedForColoring, 0x000000);
        } else if (selectable.knobs.includes(selectedForColoring)) {
      newChosenColors.knobs[selectedName] = colorName;
    } else if (selectable.teclas.includes(selectedForColoring)) {
      newChosenColors.teclas[selectedName] = colorName;
    } else if (selectable.faders.includes(selectedForColoring)) {
      newChosenColors.faders[selectedName] = colorName;
    }
    setChosenColors(newChosenColors);
    }, [selectedForColoring, selectedButtons, chosenColors, selectable, currentView, findAssociatedRing, selectedKnobs, selectedTeclas, selectedFaders]);

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
  }, [rendererRef, sceneRef, cameraRef, controlsRef, CAMERA_VIEWS, setScreenshot, setShowPaymentModal]);

    // Obtener título según la vista
  const getTitle = () => {
    switch (currentView) {
      case 'chasis': return 'ELIGE EL COLOR DEL CHASIS';
      case 'buttons': return 'PERSONALIZA LOS BOTONES';
      case 'knobs': return 'ESCOGE PARA LOS KNOBS';
      case 'teclas': return 'PERSONALIZA LAS TECLAS';
      case 'faders': return 'PERSONALIZA LOS FADERS';
      default: return 'ELIGE UN COLOR';
    }
  };

  // Obtener colores según la vista
  const getCurrentColors = () => {
    switch (currentView) {
      case 'chasis': return PALETTES.chasis;
      case 'buttons': return PALETTES.buttons;
      case 'knobs': return PALETTES.knobs;
      case 'teclas': return PALETTES.teclas;
      case 'faders': return PALETTES.faders;
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

  const particlesInit = async (main: any) => {
    await loadFull(main);
  };

  const menuIcons = [
  { id: 'normal', icon: 'M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5C17 19.5 21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5M12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17M12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z', title: 'Vista General' },
  { id: 'chasis', icon: `M4 4 Q2 4 2 8 L2 24 Q2 28 4 28 L28 28 Q30 28 30 24 L30 8 Q30 4 28 4 Z
    M8 8 A1.3 1.3 0 1 1 10.6 8 A1.3 1.3 0 1 1 8 8
    M12 8 A1.3 1.3 0 1 1 14.6 8 A1.3 1.3 0 1 1 12 8
    M16 8 A1.3 1.3 0 1 1 18.6 8 A1.3 1.3 0 1 1 16 8
    M20 8 A1.3 1.3 0 1 1 22.6 8 A1.3 1.3 0 1 1 20 8
    M5 15 A2 2 0 1 1 9 15 A2 2 0 1 1 5 15
    M11 15 A2 2 0 1 1 15 15 A2 2 0 1 1 11 15
    M17 15 A2 2 0 1 1 21 15 A2 2 0 1 1 17 15
    M23 15 A2 2 0 1 1 27 15 A2 2 0 1 1 23 15
    M5 22 A2 2 0 1 1 9 22 A2 2 0 1 1 5 22
    M11 22 A2 2 0 1 1 15 22 A2 2 0 1 1 11 22
    M17 22 A2 2 0 1 1 21 22 A2 2 0 1 1 17 22
    M23 22 A2 2 0 1 1 27 22 A2 2 0 1 1 23 22`, title: 'Chasis', viewBox: '0 0 32 32' },
  { id: 'buttons', icon: 'M12 1.999c5.524 0 10.002 4.478 10.002 10.002c0 5.523-4.478 10.001-10.002 10.001S1.998 17.524 1.998 12.001C1.998 6.477 6.476 1.999 12 1.999m0 1.5a8.502 8.502 0 1 0 0 17.003A8.502 8.502 0 0 0 12 3.5M11.996 6a5.998 5.998 0 1 1 0 11.996a5.998 5.998 0 0 1 0-11.996', title: 'Botones' },
  { id: 'knobs', icon: 'M9.42 4.074a.56.56 0 0 0-.56.56v.93c0 .308.252.56.56.56s.56-.252.56-.56v-.93a.56.56 0 0 0-.56-.56M11.554 8.8a.5.5 0 0 1 0 .707l-1.78 1.78a.5.5 0 1 1-.708-.707l1.78-1.78a.5.5 0 0 1 .708 0 M9.42 15.444c-1.16 0-2.32-.44-3.2-1.32a4.527 4.527 0 0 1 0-6.39a4.527 4.527 0 0 1 6.39 0a4.527 4.527 0 0 1 0 6.39c-.88.88-2.03 1.32-3.19 1.32m0-1.1a3.41 3.41 0 1 0 0-6.82a3.41 3.41 0 0 0 0 6.82M6.757 5.2a.56.56 0 1 0-.965.567l.465.809l.005.006a.58.58 0 0 0 .478.262a.53.53 0 0 0 .276-.075a.566.566 0 0 0 .205-.753zm5.315.012a.55.55 0 0 1 .761-.206c.277.152.36.5.203.764l-.458.797a.56.56 0 0 1-.478.277a.564.564 0 0 1-.487-.834zm7.598 5.722a.5.5 0 0 1 .5-.5h2.52a.5.5 0 1 1 0 1h-2.52a.5.5 0 0 1-.5-.5 M22.69 15.454c2.49 0 4.52-2.03 4.52-4.52s-2.03-4.52-4.52-4.52s-4.52 2.03-4.52 4.52s2.03 4.52 4.52 4.52m0-1.11a3.41 3.41 0 1 1 0-6.82a3.41 3.41 0 0 1 0 6.82m-.56-9.7c0-.308.252-.56.56-.56s.56.252.56.56v.945a.566.566 0 0 1-.56.535a.56.56 0 0 1-.56-.56zm-2.103.566a.557.557 0 0 0-.763-.202a.566.566 0 0 0-.204.753l.468.815l.004.006a.58.58 0 0 0 .478.262a.53.53 0 0 0 .276-.075a.566.566 0 0 0 .205-.753zm6.086-.204a.55.55 0 0 0-.761.206l-.458.795a.55.55 0 0 0 .194.759c.1.067.217.078.282.078a.6.6 0 0 0 .478-.262l.005-.006l.463-.806a.55.55 0 0 0-.203-.764M11.93 22.636H9.42a.5.5 0 0 0 0 1h2.51a.5.5 0 1 0 0-1 M4.9 23.136c0 2.49 2.03 4.52 4.52 4.52s4.52-2.03 4.52-4.52s-2.03-4.52-4.52-4.52s-4.52 2.03-4.52 4.52m7.93 0a3.41 3.41 0 1 1-6.82 0a3.41 3.41 0 0 1 6.82 0m-3.41-6.86a.56.56 0 0 0-.56.56v.93c0 .308.252.56.56.56s.56-.252.56-.56v-.93a.56.56 0 0 0-.56-.56m-3.418.93a.566.566 0 0 1 .755.206l.464.807c.137.258.06.6-.205.753a.53.53 0 0 1-.276.074a.58.58 0 0 1-.478-.261l-.005-.007l-.468-.814a.566.566 0 0 1 .207-.755zm6.08.209a.55.55 0 0 1 .761-.206c.277.151.36.499.203.764l-.462.802a.567.567 0 0 1-.766.194a.55.55 0 0 1-.194-.76zm8.475 3.588a.5.5 0 0 1 .707 0l1.78 1.78a.5.5 0 0 1-.707.707l-1.78-1.78a.5.5 0 0 1 0-.707 M22.69 27.656c-1.16 0-2.32-.44-3.2-1.32a4.527 4.527 0 0 1 0-6.39a4.527 4.527 0 0 1 6.39 0a4.527 4.527 0 0 1 0 6.39c-.88.88-2.04 1.32-3.19 1.32m0-1.11a3.41 3.41 0 1 0 0-6.82a3.41 3.41 0 0 0 0 6.82 M22.13 16.836c0-.308.252-.56.56-.56s.56.252.56.56v.945a.57.57 0 0 1-.56.545a.56.56 0 0 1-.56-.56zm-2.103.576a.566.566 0 0 0-.755-.206l-.006.003a.565.565 0 0 0-.206.755l.468.814l.004.007a.58.58 0 0 0 .478.262a.53.53 0 0 0 .276-.074a.566.566 0 0 0 .205-.753zm6.086-.203a.55.55 0 0 0-.761.206l-.458.795a.55.55 0 0 0 .194.759a.5.5 0 0 0 .282.077a.6.6 0 0 0 .478-.261l.005-.007l.463-.805a.55.55 0 0 0-.203-.764 M1 5.75A4.75 4.75 0 0 1 5.75 1h20.52a4.75 4.75 0 0 1 4.75 4.75v20.48a4.75 4.75 0 0 1-4.75 4.75H5.75A4.75 4.75 0 0 1 1 26.23zM5.75 3A2.75 2.75 0 0 0 3 5.75v20.48a2.75 2.75 0 0 0 2.75 2.75h20.52a2.75 2.75 0 0 0 2.75-2.75V5.75A2.75 2.75 0 0 0 26.27 3z', title: 'Knobs' },
  { id: 'teclas', icon: 'M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6zm3-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H6zm2 2h8v4H8V8z', title: 'Teclas' },
  { id: 'faders', icon: 'M12 2L2 7L12 12L22 7L12 2M2 17L12 22L22 17M2 12L12 17L22 12', title: 'Faders' }
];

  const [payuData, setPayuData] = useState({
    referenceCode: 'controlador123',
    amount: '185.00',
    currency: 'USD', // Forzar USD
    signature: '',
  });

  // Elimina la función isValidEmail y el estado emailTouched

  useEffect(() => {
    async function updateSignature() {
      const signature = await getPayuSignature({
        referenceCode: payuData.referenceCode,
        amount: payuData.amount,
        currency: payuData.currency,
      });
      setPayuData(prev => ({ ...prev, signature }));
    }
    updateSignature();
    // eslint-disable-next-line
  }, [payuData.referenceCode, payuData.amount, payuData.currency]);

  // Al abrir el modal de carrito, genera un referenceCode único
  useEffect(() => {
    if (showCartModal) {
      const uniqueRef = `controlador${Date.now()}`;
      setPayuData(prev => ({
        ...prev,
        referenceCode: uniqueRef
      }));
    }
    // eslint-disable-next-line
  }, [showCartModal]);

  // Función para validar email simple
  // Elimina la función isValidEmail

  const PAYPAL_CLIENT_ID = "sb"; // Cambia por tu clientId real en producción

  const [sidebarFiles, setSidebarFiles] = useState<File[]>([]);
  const handleSidebarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSidebarFiles(Array.from(e.target.files));
      // Aquí puedes hacer lo que quieras con los archivos (enviarlos, mostrarlos, etc.)
    }
  };

  return (
  <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD" }}>
    <div className="w-full h-screen bg-black text-gray-200 overflow-hidden relative">
      {/* Fondo degradado estático recomendado */}
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
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10" style={{ background: 'linear-gradient(180deg, #6C4FCE 0%, #291A57 100%)', borderRadius: '12px', padding: '8px 24px' }}>
        <h1 className="text-2xl text-white font-bold leading-none m-0 text-shadow" style={{ fontFamily: 'Gotham Black, Arial, sans-serif' }}>
          BEATO16
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
            ? undefined
            : () => changeView(id as 'normal' | 'chasis' | 'buttons' | 'knobs' | 'teclas' | 'faders')
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
    {/* Botón de subir archivos */}
    <input
      id="sidebar-upload"
      type="file"
      accept="image/*,application/pdf"
      multiple
      style={{ display: 'none' }}
      onChange={handleSidebarFileChange}
    />
    <button
      type="button"
      onClick={() => document.getElementById('sidebar-upload')?.click()}
      className="w-full aspect-square border rounded flex items-center justify-center p-3 transition-all duration-200 text-white bg-[#6C4FCE] border-[#6C4FCE] shadow-[0_0_8px_2px_#6C4FCE80,0_0_16px_4px_#0ff5,0_0_2px_1px_#fff3] hover:bg-[#8e6cfb] hover:border-[#8e6cfb]"
      title="Subir archivos de personalización"
    >
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
        <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
    {sidebarFiles.length > 0 && (
      <span className="text-xs text-white mt-2">Archivos: {sidebarFiles.map(f => f.name).join(', ')}</span>
    )}
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
                  ONFIGURADOR
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
              <PayPalButtons
                style={{ layout: "horizontal", color: "blue", shape: "rect", label: "paypal", height: 48 }}
                createOrder={(data, actions) => {
                  if (!actions.order) return Promise.reject("PayPal actions.order no disponible");
                  return actions.order.create({
                    intent: "CAPTURE",
                    purchase_units: [
                      {
                        amount: {
                          value: payuData.amount || "185.00",
                          currency_code: "USD"
                        },
                        description: "Controlador MIDI personalizado"
                      }
                    ]
                  });
                }}
                onApprove={async (data, actions) => {
                  if (actions && actions.order) {
                    const details = await actions.order.capture();
                    const buyerEmail = details?.payer?.email_address || '';
                    try {
                      // Solo enviar correo con SendGrid después de pago exitoso
                      await fetch('http://localhost:4000/api/sendgrid-mail', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          colors: chosenColors,
                          screenshot,
                          buyerEmail,
                          paymentMethod: 'PayPal'
                        })
                      });
                    } catch (err) {
                      alert('Error enviando correo de pedido con SendGrid: ' + err);
                    }
                    alert("¡Pago realizado con PayPal!");
                    setShowPaymentModal(false);
                    setShowCartModal(true);
                  }
                }}
                onError={(err) => {
                  alert("Error en el pago con PayPal: " + err);
                }}
              />
              <form action="https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/" method="post" target="_blank" className="w-full flex flex-col items-center"
                onSubmit={async (e) => {
                  // Enviar correo con SendGrid antes de redirigir a PayU
                  try {
                    await fetch('http://localhost:4000/api/sendgrid-mail', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        colors: chosenColors,
                        screenshot,
                        paymentMethod: 'PayU'
                      })
                    });
                  } catch (err) {
                    alert('Error enviando correo de pedido con SendGrid: ' + err);
                  }
                }}
              >
                <input type="hidden" name="merchantId" value="508029" />
                <input type="hidden" name="accountId" value="512321" />
                <input type="hidden" name="description" value="Controlador MIDI personalizado" />
                <input type="hidden" name="referenceCode" value={payuData.referenceCode} />
                <input type="hidden" name="amount" value={payuData.amount} />
                <input type="hidden" name="currency" value={payuData.currency} />
                <input type="hidden" name="signature" value={payuData.signature} />
                <input type="hidden" name="test" value="1" />
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-green-400 to-cyan-400 text-white font-bold text-lg shadow-[0_0_12px_2px_#0ff580] hover:scale-105 transition-all mt-2"
                >
                  Pagar con PayU
                </button>
              </form>
            </div>
            <p className="text-xs text-gray-400 mt-6 text-center">Tu compra es 100% segura y protegida.</p>
          </div>
        </div>
      )}

      {/* Modal de carrito */}
      {showCartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative bg-[#232846] rounded-2xl shadow-2xl border-2 border-[#a259ff] p-6 w-full max-w-2xl mx-4 animate-fade-in flex flex-col items-center">
            <button onClick={() => setShowCartModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-pink-400 text-2xl font-bold">×</button>
            <h2 className="text-2xl md:text-3xl font-bold text-purple-400 mb-4 text-center tracking-widest">Carrito</h2>
            <div className="flex flex-col md:flex-row gap-4 items-center w-full">
              <div className="w-full max-w-[220px] aspect-[4/3] flex items-center justify-center">
                {screenshot && (
                  <img src={screenshot} alt="Controlador personalizado" className="w-full h-full object-contain" style={{ background: 'none', boxShadow: 'none', border: 'none' }} />
                )}
              </div>
              <div className="flex-1 mt-4 md:mt-0 w-full">
                <h3 className="text-lg font-semibold mb-2 text-cyan-400">Tu producto:</h3>
                <ul className="text-base space-y-1 mb-2">
                  <li><b>Chasis:</b> {chosenColors.chasis}</li>
                  <li><b>Botones:</b> {Object.values(chosenColors.buttons).join(', ') || 'Por defecto'}</li>
                  <li><b>Perillas:</b> {Object.values(chosenColors.knobs).join(', ') || 'Por defecto'}</li>
                </ul>
                <div className="text-xl font-bold text-green-300 mb-2">${payuData.amount} USD</div>
              </div>
            </div>
            <div className="flex flex-col gap-4 mt-6 w-full">
              <PayPalButtons
                style={{ layout: "horizontal", color: "blue", shape: "rect", label: "paypal", height: 48 }}
                createOrder={(data, actions) => {
                  if (!actions.order) return Promise.reject("PayPal actions.order no disponible");
                  return actions.order.create({
                    intent: "CAPTURE",
                    purchase_units: [
                      {
                        amount: {
                          value: payuData.amount || "185.00",
                          currency_code: "USD"
                        },
                        description: "Controlador MIDI personalizado"
                      }
                    ]
                  });
                }}
                onApprove={async (data, actions) => {
                  if (actions && actions.order) {
                    const details = await actions.order.capture();
                    const buyerEmail = details?.payer?.email_address || '';
                    // Enviar configuración personalizada al backend
                    try {
                      await fetch('http://localhost:4000/api/paypal-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          colors: chosenColors,
                          screenshot,
                          paypalOrderId: data.orderID,
                          buyerEmail
                        })
                      });
                    } catch (err) {
                      alert('Error guardando configuración personalizada en backend: ' + err);
                    }
                    alert("¡Pago realizado con PayPal!");
                    setShowPaymentModal(false);
                    setShowCartModal(true);
                  }
                }}
                onError={(err) => {
                  alert("Error en el pago con PayPal: " + err);
                }}
              />
              <form action="https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/" method="post" target="_blank" className="w-full flex flex-col items-center">
                <input type="hidden" name="merchantId" value="508029" />
                <input type="hidden" name="accountId" value="512321" />
                <input type="hidden" name="description" value="Controlador MIDI personalizado" />
                <input type="hidden" name="referenceCode" value={payuData.referenceCode} />
                <input type="hidden" name="amount" value={payuData.amount} />
                <input type="hidden" name="currency" value={payuData.currency} />
                <input type="hidden" name="signature" value={payuData.signature} />
                <input type="hidden" name="test" value="1" />
                <button
                  type="submit"
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-green-400 to-cyan-400 text-white font-bold text-lg shadow-[0_0_12px_2px_#0ff580] hover:scale-105 transition-all mt-2"
                >
                  Pagar con PayU
                </button>
              </form>
            </div>
            <p className="text-xs text-gray-400 mt-6 text-center">Tu compra es 100% segura y protegida.</p>
          </div>
        </div>
      )}
    </div>
  </PayPalScriptProvider>
);
};

export default Beato16Configurator;