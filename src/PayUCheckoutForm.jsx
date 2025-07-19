import React, { useState } from 'react';

export default function PayUCheckoutForm() {
  const [form, setForm] = useState({
    merchantId: '1012025',
    accountId: '512321',
    description: 'Tu producto',
    referenceCode: '',
    amount: '',
    currency: 'USD',
    buyerEmail: ''
  });
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(false);

  // Pide la firma al backend
  const getSignature = async () => {
    setLoading(true);
    const res = await fetch('http://localhost:3002/api/payu/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: form.merchantId,
        referenceCode: form.referenceCode,
        amount: form.amount,
        currency: form.currency
      })
    });
    const data = await res.json();
    setSignature(data.signature);
    setLoading(false);
  };

  // Cuando el usuario hace click en pagar, primero pide la firma y luego envía el formulario
  const handlePay = async (e) => {
    e.preventDefault();
    await getSignature();
    setTimeout(() => {
      document.getElementById('payu-form').submit();
    }, 200);
  };

  // Maneja cambios en los campos del formulario
  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSignature(''); // Borra la firma si cambian los datos
  };

  return (
    <form
      id="payu-form"
      action="https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/"
      method="post"
      target="_blank"
      onSubmit={handlePay}
      style={{ maxWidth: 400, margin: 'auto', fontFamily: 'sans-serif', background: '#f8f8f8', padding: 24, borderRadius: 12 }}
    >
      <input name="merchantId" value={form.merchantId} readOnly hidden />
      <input name="accountId" value={form.accountId} readOnly hidden />
      <input name="description" value={form.description} readOnly hidden />

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

      <input type="hidden" name="signature" value={signature} />
      <input type="hidden" name="test" value="1" />

      <button type="submit" disabled={loading || !form.referenceCode || !form.amount || !form.buyerEmail} style={{width:'100%',padding:10,background:'#6C4FCE',color:'#fff',border:'none',borderRadius:6,fontWeight:'bold'}}>
        {loading ? 'Generando firma...' : 'Pagar con PayU'}
      </button>
    </form>
  );
} 