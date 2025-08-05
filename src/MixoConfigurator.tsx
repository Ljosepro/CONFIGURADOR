import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import gsap from 'gsap';
import Particles from "react-tsparticles";
import { loadFull } from "tsparticles";
import { getPayuSignature } from './api';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import type { ReactPayPalScriptOptions } from '@paypal/react-paypal-js';
import Swal from 'sweetalert2';

// PayPal Client ID
const PAYPAL_CLIENT_ID = "test";

// Tipos para los objetos seleccionables
interface Selectable {
  chasis: THREE.Mesh[];
  buttons: THREE.Mesh[];
  knobs: THREE.Mesh[];
  faders: THREE.Mesh[];
}

interface ChosenColors {
  type: string;
  chasis: string;
  buttons: Record<string, string>;
  knobs: Record<string, string>;
  faders: Record<string, string>;
}

interface PaletteColor {
  hex: string;
}

interface Palettes {
  chasis: Record<string, PaletteColor>;
  buttons: Record<string, PaletteColor>;
  knobs: Record<string, PaletteColor>;
  faders: Record<string, PaletteColor>;
}

const MixoConfigurator: React.FC<{ onProductChange?: (product: 'beato' | 'knobo' | 'mixo' | 'beato16') => void }> = ({ onProductChange }) => {
  // Estado para la firma PayU y referencia
  const [payuSignature, setPayuSignature] = useState("");
  const [payuReference, setPayuReference] = useState("");

  // Referencias para Three.js
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const modelOriginalPositionRef = useRef<THREE.Vector3 | null>(null);

  // Estados de React
  const [currentView, setCurrentView] = useState<'normal' | 'chasis' | 'buttons' | 'knobs' | 'faders'>(() => {
    const saved = localStorage.getItem('mixo_currentView');
    return saved ? (saved as 'normal' | 'chasis' | 'buttons' | 'knobs' | 'faders') : 'normal';
  });
  const [selectedForColoring, setSelectedForColoring] = useState<THREE.Mesh | null>(null);
  const [chosenColors, setChosenColors] = useState<ChosenColors>(() => {
    const saved = localStorage.getItem('mixo_chosenColors');
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
      faders: {}
    };
  });
  const [selectable, setSelectable] = useState<Selectable>({ chasis: [], buttons: [], knobs: [], faders: [] });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);



  // Ref para guardar el estado anterior de currentView
  const prevViewRef = useRef<'normal' | 'chasis' | 'buttons' | 'knobs' | 'faders'>(currentView);

  // Estado para selección múltiple de botones
  const [selectedButtons, setSelectedButtons] = useState<THREE.Mesh[]>([]);

  // Estado para selección múltiple de knobs
  const [selectedKnobs, setSelectedKnobs] = useState<THREE.Mesh[]>([]);

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

  // Configuración de vistas de cámara
  const CAMERA_VIEWS = {
    normal: { pos: new THREE.Vector3(2, 1, -0.1), target: new THREE.Vector3(0, -0.5, -0.1) },
    top:    { pos: new THREE.Vector3(1, 1.65, -0.6), target: new THREE.Vector3(-0.35, -0.9, -0.6) },
  };

  // Función para abrir el modal de pago
  const handleOpenPayment = useCallback(() => {
    // Guardar posición y configuración actual de la cámara
    const originalPos = cameraRef.current?.position.clone();
    const originalTarget = controlsRef.current?.target.clone();
    const originalFov = cameraRef.current?.fov;

    // Mover a la posición inicial (frontal) - usar la vista normal mejorada
    const initialPos = CAMERA_VIEWS.normal.pos.clone();
    const initialTarget = CAMERA_VIEWS.normal.target.clone();
    cameraRef.current!.position.copy(initialPos);
    cameraRef.current!.fov = 35; // FOV ligeramente más amplio para mejor vista
    cameraRef.current!.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.copy(initialTarget);
      controlsRef.current.update();
    }

    setTimeout(() => {
      rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
      const img = rendererRef.current!.domElement.toDataURL('image/png');
      setScreenshot(img);

      // Restaurar posición, target y FOV originales
      cameraRef.current!.position.copy(originalPos!);
      cameraRef.current!.fov = originalFov!;
      cameraRef.current!.updateProjectionMatrix();
      if (controlsRef.current && originalTarget) {
        controlsRef.current.target.copy(originalTarget);
        controlsRef.current.update();
      }
      setShowPaymentModal(true);
    }, 50);
  }, [rendererRef, sceneRef, cameraRef, controlsRef, CAMERA_VIEWS, setScreenshot, setShowPaymentModal]);

  // Referencias para la posición inicial de la cámara
  const initialCameraPosRef = useRef<THREE.Vector3 | null>(null);
  const initialCameraTargetRef = useRef<THREE.Vector3 | null>(null);



  // Guardar configuraciones en localStorage
  useEffect(() => {
    localStorage.setItem('mixo_currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    localStorage.setItem('mixo_chosenColors', JSON.stringify(chosenColors));
  }, [chosenColors]);

  // Asegurar que el modal de pago esté cerrado al cargar
  useEffect(() => {
    setShowPaymentModal(false);
    console.log('MixoConfigurator: Modal cerrado al cargar, showPaymentModal:', false);
  }, []);

  // Log para monitorear cambios en showPaymentModal
  useEffect(() => {
    console.log('MixoConfigurator: showPaymentModal cambió a:', showPaymentModal);
  }, [showPaymentModal]);

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

    // LUZ EXTRA DETRÁS DEL CONTROLADOR - MIXO CONFIGURATOR
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

  // 3. Al cargar el modelo, aplicar el envMap y MeshPhysicalMaterial
  const prepareModelParts = useCallback((model: THREE.Group) => {
    const newSelectable: Selectable = { chasis: [], buttons: [], knobs: [], faders: [] };
    const newChosenColors: ChosenColors = {
      type: 'configUpdate',
      chasis: 'Azul',
      buttons: {},
      knobs: {},
      faders: {}
    };

    model.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const meshName = typeof child.name === 'string' ? child.name.toLowerCase() : '';
      console.log('Procesando mesh:', child.name, 'meshName:', meshName);

      // Si es logo/texto y tiene textura PNG, puedes mejorar la visualización así:
      if (
        meshName.includes('logo') ||
        meshName.includes('mixo') ||
        meshName.includes('knobo02') ||
        meshName.includes('knobo-02') ||
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
        const defaultColor = 'Amarillo';
        child.material = new THREE.MeshPhysicalMaterial({ 
          color: PALETTES.buttons[defaultColor].hex, 
          metalness: 0.0,
          roughness: 0.0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.0,
          reflectivity: 1.0,
          transmission: 0.0,
          thickness: 0.3,
          ior: 1.5,
          attenuationDistance: 0.5,
          attenuationColor: 0xFFFF00,
          transparent: false,
          opacity: 1.0,
          emissive: 0xFFFF00,
          emissiveIntensity: 3.0
        });
        newSelectable.buttons.push(child);
        newChosenColors.buttons[child.name] = defaultColor;
      }
      else if (meshName.includes('aro')) {
        // Efecto plástico para los aros
        child.material = new THREE.MeshPhysicalMaterial({ 
          color: 0x000000, // Color base negro
          metalness: 0.0,
          roughness: 0.2,
          clearcoat: 0.8,
          clearcoatRoughness: 0.1,
          reflectivity: 0.5,
          transmission: 0.3,
          thickness: 0.5,
          ior: 1.4,
          attenuationDistance: 1.0,
          attenuationColor: 0xffffff,
          transparent: true,
          opacity: 0.7
        });
        newSelectable.buttons.push(child);
        newChosenColors.buttons[child.name] = 'Negro';
      }
      else if (meshName.startsWith('knob1_') || meshName.startsWith('knob2_') || meshName.startsWith('knob3_') || meshName.startsWith('knob4_')) {
        // Aplicar la misma lógica que Beato: preservar líneas blancas
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
            // Mantener blanco para preservar líneas blancas
            child.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
          }
        }
      }
      else if (meshName.includes('fader')) {
        // Para fader1_1, fader2_1, fader3_1, fader4_1 específicos, aplicar material rosa
        if (meshName === 'fader1_1' || meshName === 'fader2_1' || meshName === 'fader3_1' || meshName === 'fader4_1') {
          const defaultColor = 'Rosa';
          child.material = new THREE.MeshStandardMaterial({ 
            color: PALETTES.knobs[defaultColor].hex, 
            metalness: 0, 
            roughness: 1 
          });
          newSelectable.faders.push(child);
          newChosenColors.faders[child.name] = defaultColor;
          console.log('Fader procesado:', child.name, 'con material rosa');
        } else {
          // Para otros faders, mantener la lógica original
          if (child.material) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (mat.color) {
              const lightness = (mat.color.r + mat.color.g + mat.color.b) / 3;
              // Solo agregar a seleccionables si no es blanco
              if (lightness < 0.8) {
                // Solo cambiar color de partes oscuras, preservar material original
                const defaultColor = 'Rosa';
                // No clonar el material, solo cambiar el color
                mat.color.setHex(parseInt(PALETTES.knobs[defaultColor].hex.replace('#', ''), 16));
                newSelectable.faders.push(child);
                newChosenColors.faders[child.name] = defaultColor;
              }
              // Si es blanco, mantener el material original sin cambios
            }
          }
        }
      }
    });

    // Procesar también los hijos directos del modelo (para capturar faders adicionales)
    model.children.forEach((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        const meshName = typeof child.name === 'string' ? child.name.toLowerCase() : '';
        console.log('Procesando hijo directo:', child.name, 'meshName:', meshName);
        
        // Buscar faders adicionales que no fueron capturados en el traverse principal
        if (meshName.includes('fader') || meshName.includes('slider') || meshName.includes('pot')) {
          console.log('¡MESH FADER ADICIONAL ENCONTRADO!:', child.name, 'meshName:', meshName);
        }
      }
    });

    console.log('Knobs detectados:', newSelectable.knobs.map(k => k.name));
    console.log('Faders detectados:', newSelectable.faders.map(f => f.name));
    console.log('Todos los meshes procesados:', model.children.map(child => child.name).filter(name => name && typeof name === 'string'));
    console.log('Paleta de knobs disponible:', Object.keys(PALETTES.knobs));
    console.log('Color rosa de knobs:', PALETTES.knobs['Rosa']);
    
    // Mostrar todos los nombres de meshes que se procesaron
    const allMeshNames: string[] = [];
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        allMeshNames.push(child.name);
      }
    });
    console.log('TODOS LOS MESHES DEL MODELO:', allMeshNames);
    setSelectable(newSelectable);
    setChosenColors(newChosenColors);
    
    // Log de los arrays detectados
    console.log('FADERS DETECTADOS:', newSelectable.faders.map(f => f.name));
    console.log('KNOBS DETECTADOS:', newSelectable.knobs.map(k => k.name));
    console.log('BUTTONS DETECTADOS:', newSelectable.buttons.map(b => b.name));
    console.log('TOTAL FADERS EN SELECTABLE:', newSelectable.faders.length);
  }, [envMap]);

  // Función para restaurar el brillo LED original de un botón
  const restoreButtonLED = useCallback((button: THREE.Mesh) => {
    if (button.material instanceof THREE.MeshPhysicalMaterial) {
      const material = button.material;
      const colorName = chosenColors.buttons[button.name];
      if (colorName && PALETTES.buttons[colorName]) {
        const colorHex = PALETTES.buttons[colorName].hex;
        material.emissive.setHex(parseInt(colorHex.replace('#', ''), 16));
        material.emissiveIntensity = 3.0;
      }
    }
  }, [chosenColors, PALETTES]);

  // Cargar modelo
  const loadModel = useCallback(async () => {
    try {
      // Importar GLTFLoader dinámicamente
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      
      loader.load('./models/mixo.glb', (gltf: any) => {
        console.log('MixoConfigurator: Modelo cargado exitosamente');
        const model = gltf.scene as THREE.Group;
        modelRef.current = model;
        prepareModelParts(model);
        centerAndScaleModel(model);
        sceneRef.current?.add(model);
        // Guardar la posición original del modelo solo si no está guardada
        if (!modelOriginalPositionRef.current) {
          modelOriginalPositionRef.current = model.position.clone();
        }
        // Solo forzar color negro en aros, no en botones LED
        const negroHex = 0x1C1C1C;
        model.traverse((child: any) => {
          // LOGOS Y TEXTOS AQUÍ: Si tienes meshes de logo/texto con textura, puedes modificar su material aquí
          if (
            child.isMesh &&
            (typeof child.name === 'string' && child.name.toLowerCase().includes('aro'))
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
          if (obj instanceof THREE.Mesh) {
            console.log('Mesh encontrado:', obj.name);
            // Si el nombre contiene algún patrón que pueda ser fader, lo marcamos
            if (obj.name.toLowerCase().includes('fader') || obj.name.toLowerCase().includes('slider') || obj.name.toLowerCase().includes('pot')) {
              console.log('¡POSIBLE FADER ENCONTRADO!:', obj.name);
            }
            // También buscar por colores azules o verdes que podrían ser faders
            if (obj.material && 'color' in obj.material) {
              const color = obj.material.color;
              if ((color.r < 0.5 && color.g > 0.5 && color.b > 0.5) || // Verde
                  (color.r < 0.5 && color.g < 0.5 && color.b > 0.5)) { // Azul
                console.log('¡MESH CON COLOR AZUL/VERDE ENCONTRADO!:', obj.name, 'Color:', color);
              }
            }
          }
        });
        
        // Log final: mostrar todos los meshes del modelo
        const allMeshNames: string[] = [];
        model.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            allMeshNames.push(child.name);
          }
        });
        console.log('TODOS LOS MESHES DEL MODELO:', allMeshNames);
        
      }, undefined, (error: any) => {
        console.error('ERROR AL CARGAR EL MODELO:', error);
      });
    } catch (error) {
      console.error('Error importing GLTFLoader:', error);
    }
  }, [prepareModelParts, centerAndScaleModel]);

  // Función para establecer emisivo (glow effect)
  const setEmissive = useCallback((object: THREE.Mesh | null, color: number = 0x000000) => {
    if (object && (object.material as THREE.MeshPhysicalMaterial)?.emissive) {
      const material = object.material as THREE.MeshPhysicalMaterial;
      
      // Para botones LED, restaurar el brillo LED original si es 0x000000 (limpiar selección)
      if (object.name.toLowerCase().includes('boton') && color === 0x000000) {
        restoreButtonLED(object);
        return;
      }
      
      material.emissive.setHex(color);
      // Para botones LED, mantener la intensidad alta
      if (object.name.toLowerCase().includes('boton')) {
        material.emissiveIntensity = 3.0;
      }
      // Para aros, crear un efecto de brillo sutil
      else if (object.name.toLowerCase().includes('aro')) {
        material.emissiveIntensity = 0.3;
        // Aumentar ligeramente la opacidad para el efecto de selección
        material.opacity = 0.8;
      }
    }
  }, [restoreButtonLED]);

  // Función para manejar clics en el canvas
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!sceneRef.current || !cameraRef.current) return;

    // Si la vista es 'chasis', no permitir seleccionar nada
    if (currentView === 'chasis') {
      setSelectedForColoring(null);
      setSelectedButtons([]);
      setSelectedKnobs([]);
      setSelectedFaders([]);
      return;
    }

    const rect = mountRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    
    // Determinar qué objetos intersectar según la vista
    let objectsToIntersect: THREE.Mesh[] = [];
    if (currentView === 'buttons') {
      objectsToIntersect = selectable.buttons;
    } else if (currentView === 'knobs') {
      objectsToIntersect = selectable.knobs;
      console.log('Vista knobs - Objetos a intersectar:', objectsToIntersect.map(k => k.name));
    } else if (currentView === 'faders') {
      objectsToIntersect = selectable.faders;
      console.log('Vista faders - Objetos a intersectar:', objectsToIntersect.map(f => f.name));
      console.log('Total faders en selectable.faders:', selectable.faders.length);
    } else if (currentView === 'normal') {
      // En vista normal, permitir clicks en botones para animación
      objectsToIntersect = selectable.buttons;
    }
    
    if (objectsToIntersect.length === 0) return;
    
    const intersects = raycaster.intersectObjects(objectsToIntersect, false);
    console.log('Intersecciones encontradas:', intersects.length, 'Objetos:', objectsToIntersect.length);
    console.log('Objetos disponibles para intersección:', objectsToIntersect.map(obj => obj.name));
    
    // Limpia el resaltado de todos los botones (solo en vista de botones)
    if (currentView === 'buttons') {
      selectable.buttons.forEach(btn => setEmissive(btn, 0x000000));
    }
    if (selectedForColoring && currentView !== 'normal') {
      setEmissive(selectedForColoring, 0x000000);
    }

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object as THREE.Mesh;
      const name = clickedMesh.name.toLowerCase();

      // En vista normal, solo reproducir animación sin selección
      if (currentView === 'normal') {
        return;
      }

      if (name.includes('boton') || name.includes('aro')) {
        // Limpiar selecciones de otros tipos
        setSelectedKnobs([]);
        setSelectedFaders([]);
        if (event.shiftKey) {
          if (selectedButtons.length === 0 && selectedForColoring && selectedForColoring !== clickedMesh) {
            setSelectedButtons([selectedForColoring, clickedMesh]);
            setSelectedForColoring(null);
            // Aplicar glow a ambos elementos seleccionados
            setEmissive(selectedForColoring, 0x444444);
            setEmissive(clickedMesh, 0x444444);
          } else {
            setSelectedForColoring(null);
            setSelectedButtons(prev => {
              if (prev.length === 0) {
                setEmissive(clickedMesh, 0x444444);
                return [clickedMesh];
              }
              const already = prev.includes(clickedMesh);
              let newSelected;
              if (already) {
                newSelected = prev.filter(obj => obj !== clickedMesh);
                // Quitar glow del elemento deseleccionado
                setEmissive(clickedMesh, 0x000000);
              } else {
                newSelected = [...prev, clickedMesh];
                setEmissive(clickedMesh, 0x444444);
              }
              // Aplicar glow a todos los elementos seleccionados
              newSelected.forEach(btn => setEmissive(btn, 0x444444));
              return newSelected;
            });
          }
        } else {
          setSelectedButtons([clickedMesh]);
          setSelectedForColoring(clickedMesh);
          // Aplicar glow al elemento seleccionado
          setEmissive(clickedMesh, 0x444444);
        }
      } else if (name.startsWith('knob1_') || name.startsWith('knob2_') || name.startsWith('knob3_') || name.startsWith('knob4_')) {
        console.log('Click detectado en knob:', name);
        // Limpiar selecciones de otros tipos
        setSelectedButtons([]);
        setSelectedFaders([]);
        if (event.shiftKey) {
          if (selectedKnobs.length === 0 && selectedForColoring && selectedForColoring !== clickedMesh) {
            setSelectedKnobs([selectedForColoring, clickedMesh]);
            setSelectedForColoring(null);
            // Aplicar glow a ambos knobs seleccionados
            setEmissive(selectedForColoring, 0x444444);
            setEmissive(clickedMesh, 0x444444);
          } else {
            setSelectedForColoring(null);
            setSelectedKnobs(prev => {
              if (prev.length === 0) {
                setEmissive(clickedMesh, 0x444444);
                return [clickedMesh];
              }
              const already = prev.includes(clickedMesh);
              let newSelected;
              if (already) {
                newSelected = prev.filter(obj => obj !== clickedMesh);
                // Quitar glow del knob deseleccionado
                setEmissive(clickedMesh, 0x000000);
              } else {
                newSelected = [...prev, clickedMesh];
                setEmissive(clickedMesh, 0x444444);
              }
              // Aplicar glow a todos los knobs seleccionados
              newSelected.forEach(knob => setEmissive(knob, 0x444444));
              return newSelected;
            });
          }
        } else {
          setSelectedKnobs([clickedMesh]);
          setSelectedForColoring(clickedMesh);
          // Aplicar glow al knob seleccionado
          setEmissive(clickedMesh, 0x444444);
        }
      } else if (name.startsWith('fader1') || name.startsWith('fader2') || name.startsWith('fader3') || name.startsWith('fader4')) {
        console.log('Click detectado en fader:', name, 'Vista actual:', currentView);
        console.log('Total faders en selectable.faders:', selectable.faders.length);
        console.log('Faders disponibles:', selectable.faders.map(f => f.name));
        console.log('Fader encontrado en selectable.faders:', selectable.faders.find(f => f.name === clickedMesh.name));
        console.log('Nombre del mesh clickeado:', clickedMesh.name);
        // Limpiar selecciones de otros tipos
        setSelectedButtons([]);
        setSelectedKnobs([]);
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
          setSelectedFaders([clickedMesh]);
          setSelectedForColoring(clickedMesh);
          // Aplicar glow al fader seleccionado
          setEmissive(clickedMesh, 0x444444);
        }
      } else if (name.includes('cubechasis')) {
        setSelectedButtons([]);
        setSelectedKnobs([]);
        setSelectedFaders([]);
        setSelectedForColoring(clickedMesh);
      }
    }
  }, [currentView, selectable, selectedForColoring, setEmissive, selectedButtons, selectedKnobs, selectedFaders]);

  // Función para aplicar color
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
        const material = btn.material as THREE.MeshPhysicalMaterial;
        material.color.set(colorData.hex);
        // Mantener el efecto LED brillante sin transparencia
        material.emissive.setHex(parseInt(colorData.hex.replace('#', ''), 16));
        material.emissiveIntensity = 3.0;
        material.transmission = 0.0;
        material.thickness = 0.3;
        material.ior = 1.5;
        material.attenuationDistance = 0.5;
        material.attenuationColor.setHex(parseInt(colorData.hex.replace('#', ''), 16));
        material.transparent = false;
        material.opacity = 1.0;
        material.clearcoat = 1.0;
        material.clearcoatRoughness = 0.0;
        material.reflectivity = 1.0;
        newChosenColors.buttons[btn.name] = colorName;
        
        // Aplicar efecto plástico al aro asociado
        const aroName = btn.name.replace('boton', 'aro');
        const aroMesh = selectable.buttons.find(m => m.name === aroName);
        if (aroMesh && aroMesh.material instanceof THREE.MeshPhysicalMaterial) {
          const aroMaterial = aroMesh.material;
          aroMaterial.color.setHex(parseInt(colorData.hex.replace('#', ''), 16));
          aroMaterial.transmission = 0.3;
          aroMaterial.thickness = 0.5;
          aroMaterial.ior = 1.4;
          aroMaterial.attenuationDistance = 1.0;
          aroMaterial.attenuationColor.setHex(parseInt(colorData.hex.replace('#', ''), 16));
          aroMaterial.transparent = true;
          aroMaterial.opacity = 0.7;
          newChosenColors.buttons[aroName] = colorName;
        }
      });
      setChosenColors(newChosenColors);
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
      setSelectedKnobs([]);
      return;
    }

    // En la vista de faders, si hay selección múltiple
    if (currentView === 'faders' && selectedFaders.length > 0) {
      console.log('Aplicando color a faders múltiples:', selectedFaders.map(f => f.name), 'Color:', colorName);
      const newChosenColors = { ...chosenColors, faders: { ...chosenColors.faders } };
      selectedFaders.forEach(fader => {
        // Aplicar el material de los knobs para las partes rosas
        fader.material = new THREE.MeshStandardMaterial({ 
          color: colorData.hex, 
          metalness: 0, 
          roughness: 1 
        });
        newChosenColors.faders[fader.name] = colorName;
      });
      setChosenColors(newChosenColors);
      setSelectedFaders([]);
      return;
    }

    // Selección individual
    if (!selectedForColoring) {
      Swal.fire({
        title: 'Selecciona una parte',
        text: 'Haz clic en una pieza del controlador para aplicar el color.',
        imageUrl: 'models/logo.png',
        imageWidth: 120,
        imageHeight: 120,
        background: '#232846',
        color: '#fff',
        confirmButtonColor: '#a259ff',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const name = selectedForColoring.name.toLowerCase();
    const color = new THREE.Color(colorData.hex);

    if (name.includes('cubechasis')) {
      setChosenColors(prev => ({ ...prev, chasis: colorName }));
      if (selectedForColoring.material instanceof THREE.MeshStandardMaterial) {
        selectedForColoring.material.color = color;
      }
    } else if (name.includes('boton')) {
      setChosenColors(prev => ({
        ...prev,
        buttons: { ...prev.buttons, [selectedForColoring.name]: colorName }
      }));
      if (selectedForColoring.material instanceof THREE.MeshPhysicalMaterial) {
        const material = selectedForColoring.material;
        material.color = color;
        // Mantener el efecto LED brillante sin transparencia
        material.emissive.setHex(parseInt(colorData.hex.replace('#', ''), 16));
        material.emissiveIntensity = 3.0;
        material.transmission = 0.0;
        material.thickness = 0.3;
        material.ior = 1.5;
        material.attenuationDistance = 0.5;
        material.attenuationColor.setHex(parseInt(colorData.hex.replace('#', ''), 16));
        material.transparent = false;
        material.opacity = 1.0;
        material.clearcoat = 1.0;
        material.clearcoatRoughness = 0.0;
        material.reflectivity = 1.0;
        
        // Aplicar efecto plástico al aro asociado
        const aroName = selectedForColoring.name.replace('boton', 'aro');
        const aroMesh = selectable.buttons.find(m => m.name === aroName);
        if (aroMesh && aroMesh.material instanceof THREE.MeshPhysicalMaterial) {
          const aroMaterial = aroMesh.material;
          aroMaterial.color.setHex(parseInt(colorData.hex.replace('#', ''), 16));
          aroMaterial.transmission = 0.3;
          aroMaterial.thickness = 0.5;
          aroMaterial.ior = 1.4;
          aroMaterial.attenuationDistance = 1.0;
          aroMaterial.attenuationColor.setHex(parseInt(colorData.hex.replace('#', ''), 16));
          aroMaterial.transparent = true;
          aroMaterial.opacity = 0.7;
          setChosenColors(prev => ({
            ...prev,
            buttons: { ...prev.buttons, [aroName]: colorName }
          }));
        }
      }
    } else if (name.startsWith('knob1_') || name.startsWith('knob2_') || name.startsWith('knob3_') || name.startsWith('knob4_')) {
      console.log('Aplicando color a knob:', selectedForColoring.name, 'Color:', colorName, 'Hex:', colorData.hex);
      setChosenColors(prev => ({
        ...prev,
        knobs: { ...prev.knobs, [selectedForColoring.name]: colorName }
      }));
      // Preservar el material original y solo cambiar el color
      if (selectedForColoring.material && 'color' in selectedForColoring.material) {
        (selectedForColoring.material as any).color = color;
        (selectedForColoring.material as any).metalness = 0;
        (selectedForColoring.material as any).roughness = 1;
        console.log('Color aplicado al material del knob preservando texturas');
      } else {
        console.log('No se pudo aplicar color al knob:', selectedForColoring.material);
      }
    } else if (name.startsWith('fader1') || name.startsWith('fader2') || name.startsWith('fader3') || name.startsWith('fader4')) {
      console.log('Aplicando color a fader individual:', selectedForColoring.name, 'Color:', colorName);
      setChosenColors(prev => ({
        ...prev,
        faders: { ...prev.faders, [selectedForColoring.name]: colorName }
      }));
      // Aplicar el material de los knobs para las partes rosas
      selectedForColoring.material = new THREE.MeshStandardMaterial({ 
        color: colorData.hex, 
        metalness: 0, 
        roughness: 1 
      });
      console.log('Material de knobs aplicado al fader');
    }
  }, [selectedForColoring, selectedButtons, chosenColors, selectable, currentView, setEmissive]);

  // Función para obtener el título
  const getTitle = () => {
    switch (currentView) {
      case 'chasis': return 'ELIGE EL COLOR DEL CHASIS';
      case 'buttons': return 'PERSONALIZA LOS BOTONES';
      case 'knobs': return 'PERSONALIZA LOS KNOBS';
      case 'faders': return 'PERSONALIZA LOS FADERS';
      default: return 'ELIGE UN COLOR';
    }
  };

  // Función para obtener colores actuales
  const getCurrentColors = () => {
    switch (currentView) {
      case 'chasis': return PALETTES.chasis;
      case 'buttons': return PALETTES.buttons;
      case 'knobs': return PALETTES.knobs;
      case 'faders': return PALETTES.faders;
      default: return {};
    }
  };



  // Función para cambiar vista
  const changeView = useCallback((viewName: 'normal' | 'chasis' | 'buttons' | 'knobs' | 'faders') => {
    setCurrentView(viewName);

    // Limpiar glow effects al cambiar vista
    if (selectedForColoring) {
      setEmissive(selectedForColoring, 0x000000);
    }
    selectedButtons.forEach(btn => setEmissive(btn, 0x000000));
    selectedKnobs.forEach(knob => setEmissive(knob, 0x000000));
    selectedFaders.forEach(fader => setEmissive(fader, 0x000000));

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
  }, [selectable, selectedForColoring, setEmissive, selectedButtons, selectedKnobs, selectedFaders]);



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

  // Inicialización de Three.js
  useEffect(() => {
    console.log('MixoConfigurator: Inicializando Three.js');
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

  // Efecto para cambiar vista de cámara
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;

    let targetView;
    if (currentView === 'normal') {
      targetView = CAMERA_VIEWS.normal;
    } else {
      targetView = CAMERA_VIEWS.top;
    }

    gsap.to(cameraRef.current.position, {
      x: targetView.pos.x,
      y: targetView.pos.y,
      z: targetView.pos.z,
      duration: 1,
      ease: 'power2.inOut'
    });

    gsap.to(controlsRef.current.target, {
      x: targetView.target.x,
      y: targetView.target.y,
      z: targetView.target.z,
      duration: 1,
      ease: 'power2.inOut'
    });
  }, [currentView]);

  // Efecto para aplicar colores cuando cambien
  useEffect(() => {
    if (!sceneRef.current || !modelRef.current) return;

    // Aplicar colores guardados cuando el modelo esté cargado
    if (selectable.chasis.length > 0 || selectable.buttons.length > 0 || selectable.faders.length > 0) {
      // Aplicar colores del chasis
      if (selectable.chasis.length > 0) {
        const chasisColor = PALETTES.chasis[chosenColors.chasis];
        if (chasisColor) {
          selectable.chasis.forEach((mesh: THREE.Mesh) => {
            if (mesh.material instanceof THREE.MeshStandardMaterial) {
              mesh.material.color = new THREE.Color(chasisColor.hex);
            }
          });
        }
      }

      // Aplicar colores de botones
      Object.entries(chosenColors.buttons).forEach(([buttonName, colorName]) => {
        const mesh = selectable.buttons.find(m => m.name === buttonName);
        if (mesh && PALETTES.buttons[colorName]) {
          if (mesh.material instanceof THREE.MeshPhysicalMaterial) {
            const material = mesh.material;
            material.color = new THREE.Color(PALETTES.buttons[colorName].hex);
            
            // Si es un botón, aplicar efecto LED brillante sin transparencia
            if (mesh.name.toLowerCase().includes('boton')) {
              material.emissive.setHex(parseInt(PALETTES.buttons[colorName].hex.replace('#', ''), 16));
              material.emissiveIntensity = 3.0;
              material.transmission = 0.0;
              material.thickness = 0.3;
              material.ior = 1.5;
              material.attenuationDistance = 0.5;
              material.attenuationColor.setHex(parseInt(PALETTES.buttons[colorName].hex.replace('#', ''), 16));
              material.transparent = false;
              material.opacity = 1.0;
              material.clearcoat = 1.0;
              material.clearcoatRoughness = 0.0;
              material.reflectivity = 1.0;
            }
            // Si es un aro, aplicar efecto plástico
            else if (mesh.name.toLowerCase().includes('aro')) {
              material.transmission = 0.3;
              material.thickness = 0.5;
              material.ior = 1.4;
              material.attenuationDistance = 1.0;
              material.attenuationColor.setHex(parseInt(PALETTES.buttons[colorName].hex.replace('#', ''), 16));
              material.transparent = true;
              material.opacity = 0.7;
            }
          }
        }
      });

      // Aplicar colores de faders
      Object.entries(chosenColors.faders).forEach(([faderName, colorName]) => {
        const mesh = selectable.faders.find(m => m.name === faderName);
        if (mesh && PALETTES.faders[colorName]) {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.color = new THREE.Color(PALETTES.faders[colorName].hex);
          }
        }
      });
    }
  }, [chosenColors, PALETTES, prepareModelParts]);

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
    { id: 'faders', icon: 'M12 2L2 7L12 12L22 7L12 2M2 17L12 22L22 17M2 12L12 17L22 12', title: 'Faders' }
  ];

  const [payuData, setPayuData] = useState({
    referenceCode: 'controlador123',
    amount: '185.00',
    currency: 'USD',
    signature: '',
  });

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
  }, [payuData.referenceCode, payuData.amount, payuData.currency]);



  const PAYPAL_CLIENT_ID = "sb";

  const [sidebarFiles, setSidebarFiles] = useState<File[]>([]);
  const handleSidebarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSidebarFiles(Array.from(e.target.files));
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
        <div className="absolute top-6 left-32 z-10" style={{ background: 'linear-gradient(180deg, #6C4FCE 0%, #291A57 100%)', borderRadius: '12px', padding: '8px 24px' }}>
          <h1 className="text-2xl text-white font-bold leading-none m-0 text-shadow" style={{ fontFamily: 'Gotham Black, Arial, sans-serif' }}>
            MIXO
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
        </main>

        {/* Panel de UI */}
        <div
          className={`fixed top-0 right-0 h-screen border-l border-gray-700 shadow-2xl transition-all duration-400 flex overflow-hidden z-10 ${
            currentView === 'normal' ? 'w-28' : 'w-[480px]'
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
                  onClick={() => changeView(id as 'normal' | 'chasis' | 'buttons' | 'knobs' | 'faders')}
                  className={`w-full aspect-square border rounded flex items-center justify-center p-3 transition-all duration-200 text-white ${
                    currentView === id 
                      ? 'bg-[#6C4FCE] border-[#6C4FCE] shadow-[0_0_8px_2px_#6C4FCE80,0_0_16px_4px_#0ff5,0_0_2px_1px_#fff3]'
                      : 'border-gray-600 bg-[#A693E5] bg-opacity-100 hover:bg-[#6C4FCE] hover:border-[#6C4FCE] hover:shadow-[0_0_4px_1px_#6C4FCE60,0_0_8px_2px_#0ff3]'
                  }`}
                  title={title}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox={viewBox || '0 0 24 24'}
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
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4/5 h-4/5 fill-white">
                  <path d="M12 2C13.1 2 14 2.9 14 4V6H16C17.1 6 18 6.9 18 8V19C18 20.1 17.1 21 16 21H8C6.9 21 6 20.1 6 19V8C6 6.9 6.9 6 8 6H10V4C10 2.9 10.9 2 12 2M12 4V6H12.5V4H12M8 8V19H16V8H8M10 10H14V12H10V10M10 14H14V16H10V14Z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Panel de colores */}
          {currentView !== 'normal' && (
            <div className="flex-1 p-6 overflow-y-auto animate-slideIn" style={{ paddingTop: '200px' }}>
              {/* Panel de colores */}
              <div className="mb-6 animate-fadeIn">
                <h3 className="text-xl font-bold text-white mb-4 animate-fadeIn">{getTitle()}</h3>
                <div className="grid grid-cols-5 gap-3 animate-scaleIn">
                  {Object.entries(getCurrentColors()).map(([name, color], index) => (
                                    <button
                  key={name}
                  onClick={() => applyColor(name, color)}
                  className="w-8 h-8 rounded-full cursor-pointer border-2 border-[#a259ff] shadow-[0_0_6px_1px_#a259ff55] transition-all duration-200 shadow-inner hover:scale-110 animate-fadeInUp"
                  style={{ 
                    backgroundColor: color.hex,
                    animationDelay: `${index * 50}ms`
                  }}
                  title={name}
                />
                  ))}
                </div>
              </div>

              {/* Información de selección múltiple */}
              {(selectedButtons.length > 0 || selectedKnobs.length > 0 || selectedFaders.length > 0) && (
                <div className="mb-6 p-4 bg-gray-800 rounded-lg animate-scaleIn">
                  <h4 className="text-lg font-semibold text-white mb-2 animate-fadeIn">
                    Selección múltiple ({selectedButtons.length + selectedKnobs.length + selectedFaders.length} elementos)
                  </h4>
                  <p className="text-gray-300 text-sm animate-fadeIn">
                    Haz clic en un color para aplicarlo a todos los elementos seleccionados
                  </p>
                </div>
              )}


            </div>
          )}
        </div>

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
                    <li><b>Faders:</b> {Object.values(chosenColors.faders).join(', ') || 'Por defecto'}</li>
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
                            value: "185.00",
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
                  <input type="hidden" name="referenceCode" value={payuReference} />
                  <input type="hidden" name="amount" value="185.00" />
                  <input type="hidden" name="tax" value="0" />
                  <input type="hidden" name="taxReturnBase" value="0" />
                  <input type="hidden" name="currency" value="USD" />
                  <input type="hidden" name="signature" value={payuSignature} />
                  <input type="hidden" name="test" value="1" />
                  <input type="hidden" name="buyerEmail" value="test@test.com" />
                  <input type="hidden" name="responseUrl" value="https://www.crearttech.com/" />
                  <input type="hidden" name="confirmationUrl" value="https://www.crearttech.com/" />
                  <button
                    type="submit"
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
                  >
                    Pagar con PayU
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}


      </div>
    </PayPalScriptProvider>
  );
};

export default MixoConfigurator;