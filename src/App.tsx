import React, { useState } from 'react';
import BeatoConfigurator from './BeatoConfigurator';
import KnoboConfigurator from './KnoboConfigurator';
import MixoConfigurator from './MixoConfigurator';
import Beato16Configurator from './Beato16Configurator';
import LoopoConfigurator from './LoopoConfigurator';
import FadoConfigurator from './FadoConfigurator';

function App() {
  const [currentProduct, setCurrentProduct] = useState<'beato' | 'knobo' | 'mixo' | 'beato16' | 'loopo' | 'fado'>('beato');

  const handleProductChange = (product: 'beato' | 'knobo' | 'mixo' | 'beato16' | 'loopo' | 'fado') => {
    setCurrentProduct(product);
  };

  const menuItems = [
    { id: 'beato', name: 'BEATO', icon: '/textures/beato.png', description: 'Controlador MIDI', isImage: true },
    { id: 'beato16', name: 'BEATO16', icon: '/textures/beato16.png', description: '16 Botones + 4 Knobs', isImage: true },
    { id: 'knobo', name: 'KNOBO', icon: '/textures/knobo.png', description: 'Controlador de Knobs', isImage: true },
    { id: 'mixo', name: 'MIXO', icon: '/textures/mixo.png', description: 'Mixer con Faders', isImage: true },
    { id: 'loopo', name: 'LOOPO', icon: '/textures/loopo.png', description: 'Controlador Loop', isImage: true },
    { id: 'fado', name: 'FADO', icon: 'CONFIGURATOR/textures/fado.png', description: '8 Faders', isImage: true }
  ] as const;

  return (
    <div className="App">
      {/* Navigation Menu */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: 10,
        transform: 'translateY(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        backgroundColor: '#2D3559',
        padding: '12px 6px',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(162, 89, 255, 0.3)'
      }}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleProductChange(item.id)}
            style={{
              padding: '4px 8px',
              backgroundColor: currentProduct === item.id ? '#6C4FCE' : 'transparent',
              border: currentProduct === item.id ? '1px solid #6C4FCE' : '1px solid transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold',
              color: currentProduct === item.id ? 'white' : '#ffffff',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              minWidth: '60px',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              if (currentProduct !== item.id) {
                e.currentTarget.style.backgroundColor = 'rgba(162, 89, 255, 0.2)';
                e.currentTarget.style.transform = 'translateX(3px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(162, 89, 255, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentProduct !== item.id) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'translateX(0) scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {item.isImage ? (
              <img 
                src={item.icon} 
                alt={item.name}
                style={{ 
                  width: '30px', 
                  height: '30px', 
                  objectFit: 'contain',
                  filter: currentProduct === item.id ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' : 'none'
                }}
              />
            ) : (
              <span style={{ fontSize: '14px', filter: currentProduct === item.id ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' : 'none' }}>
                {item.icon}
              </span>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', fontWeight: 'bold', marginBottom: '1px' }}>
                {item.name}
              </div>
              <div style={{ fontSize: '6px', opacity: 0.7, fontWeight: 'normal' }}>
                {item.description}
              </div>
            </div>
            {currentProduct === item.id && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '2px',
                height: '50%',
                backgroundColor: '#6C4FCE',
                borderRadius: '1px',
                animation: 'pulse 2s infinite'
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Configurators */}
      {currentProduct === 'beato' ? (
        <BeatoConfigurator onProductChange={handleProductChange} />
      ) : currentProduct === 'beato16' ? (
        <Beato16Configurator onProductChange={handleProductChange} />
      ) : currentProduct === 'knobo' ? (
        <KnoboConfigurator onProductChange={handleProductChange} />
      ) : currentProduct === 'mixo' ? (
        <MixoConfigurator onProductChange={handleProductChange} />
      ) : currentProduct === 'loopo' ? (
        <LoopoConfigurator onProductChange={handleProductChange} />
      ) : currentProduct === 'fado' ? (
        <FadoConfigurator onProductChange={handleProductChange} />
      ) : (
        <BeatoConfigurator onProductChange={handleProductChange} />
      )}


    </div>
  );
}

export default App;