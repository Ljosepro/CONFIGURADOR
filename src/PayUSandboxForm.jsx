import React, { useEffect, useState } from 'react';
import { getPayuSignature } from './api'; // Ajusta la ruta si es necesario

export default function PayUSandboxForm() {
  const [signature, setSignature] = useState('');
  const [form, setForm] = useState({
    merchantId: '508029',
    accountId: '512321',
    description: 'Controlador Personalizado',
    referenceCode: 'Beato' + Date.now(),
    amount: '185.00',
    currency: 'USD',
    buyerEmail: 'cliente@correo.com',
    modelo: '',
    color: '',
    extras: ''
  });
  const [files, setFiles] = useState([]);

  useEffect(() => {
    setForm(f => ({ ...f, referenceCode: 'Beato' + Date.now() }));
  }, []);

  useEffect(() => {
    async function fetchSignature() {
      const sig = await getPayuSignature({
        referenceCode: form.referenceCode,
        amount: form.amount,
        currency: form.currency
      });
      setSignature(sig);
    }
    fetchSignature();
  }, [form.referenceCode, form.amount, form.currency]);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = (e) => {
    // Simplemente enviamos el formulario a PayU
    e.target.submit();
  };

  return (
    <form
      action="https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/"
      method="post"
      target="_blank"
      style={{ maxWidth: 400, margin: 'auto', fontFamily: 'sans-serif', background: '#f8f8f8', padding: 24, borderRadius: 12 }}
      onSubmit={handleSubmit}
    >
      {/* ... (Tus campos de modelo, color, extras, archivos, etc. siguen igual) ... */}
      <label>Modelo:</label>
      <input name="modelo" value={form.modelo} onChange={handleChange} required style={{width:'100%',marginBottom:8}} /><br />
      <label>Color:</label>
      <input name="color" value={form.color} onChange={handleChange} required style={{width:'100%',marginBottom:8}} /><br />
      <label>Extras:</label>
      <input name="extras" value={form.extras} onChange={handleChange} style={{width:'100%',marginBottom:8}} /><br />
      <label htmlFor="personalizacion" style={{ display: 'block', marginBottom: 8 }}>
        Personalización (imágenes o PDF):
      </label>
      <input
        id="personalizacion"
        type="file"
        name="personalizacion"
        accept="image/*,application/pdf"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => document.getElementById('personalizacion').click()}
        style={{
          width: '100%',
          padding: 10,
          background: '#6C4FCE',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontWeight: 'bold',
          marginBottom: 8,
          cursor: 'pointer'
        }}
      >
        Subir archivos
      </button>
      <span>
        {files.length > 0 && `Archivos seleccionados: ${files.map(f => f.name).join(', ')}`}
      </span>
      <label>Referencia:</label>
      <input name="referenceCode" value={form.referenceCode} onChange={handleChange} required style={{width:'100%',marginBottom:8}} /><br />
      <label>Monto:</label>
      <input name="amount" value={form.amount} onChange={handleChange} required type="number" step="0.01" style={{width:'100%',marginBottom:8}} /><br />
      <label>Moneda:</label>
      <select name="currency" value={form.currency} onChange={handleChange} style={{width:'100%',marginBottom:8}}>
        <option value="USD">USD</option>
        <option value="COP">COP</option>
      </select><br />
      <label>Email comprador:</label>
      <input name="buyerEmail" value={form.buyerEmail} onChange={handleChange} required type="email" style={{width:'100%',marginBottom:16}} /><br />
      
      {/* --- Campos Ocultos para PayU --- */}
      <input type="hidden" name="merchantId" value={form.merchantId} />
      <input type="hidden" name="accountId" value={form.accountId} />
      <input type="hidden" name="description" value={form.description} />
      <input type="hidden" name="signature" value={signature} />
      <input type="hidden" name="test" value="1" />

      {/* === CAMPO CORREGIDO === */}
      {/* Ahora usa la URL pública de ngrok que creaste */}
      <input type="hidden" name="confirmationUrl" value="https://74455b24c912.ngrok-free.app/api/payu-confirmation" />
      
      {/* Esta es la URL a la que PayU redirigirá al usuario después del pago */}
      <input type="hidden" name="responseUrl" value="http://localhost:5178/pago-finalizado" />

      <button type="submit" style={{width:'100%',padding:10,background:'#6C4FCE',color:'#fff',border:'none',borderRadius:6,fontWeight:'bold'}}>
        Pagar con PayU (Sandbox)
      </button>
    </form>
  );
}