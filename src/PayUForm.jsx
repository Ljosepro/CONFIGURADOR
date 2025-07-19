import React, { useState, useEffect } from 'react';

const BACKEND_URL = 'http://localhost:3001';

export default function PayUForm() {
  // Estados para bancos PSE
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState('');
  // Estados para feedback
  const [result, setResult] = useState(null);

  // Cargar bancos PSE al montar
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/payu/payment-methods`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        const pse = data.paymentMethods.find(pm => pm.paymentMethod === 'PSE');
        setBanks(pse ? pse.financialInstitutions : []);
      });
  }, []);

  // --- Formulario de tarjeta ---
  const [card, setCard] = useState({
    value: 250.00,
    currency: 'USD',
    referenceCode: 'pedido123',
    buyerEmail: '',
    payerName: '',
    payerDNI: '',
    cardNumber: '',
    cardExp: '',
    cardCVC: '',
    paymentMethod: 'VISA',
    paymentCountry: 'CO'
  });

  // --- Formulario de PSE ---
  const [pse, setPse] = useState({
    value: 250.00,
    currency: 'USD',
    referenceCode: 'pedido124',
    buyerEmail: '',
    payerName: '',
    payerDNI: '',
    bankCode: '',
    paymentCountry: 'CO'
  });

  // Pago con tarjeta
  const handleCardPay = async (e) => {
    e.preventDefault();
    setResult('Procesando...');
    const res = await fetch(`${BACKEND_URL}/api/payu/pay-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card)
    });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  // Pago con PSE
  const handlePsePay = async (e) => {
    e.preventDefault();
    setResult('Procesando...');
    const res = await fetch(`${BACKEND_URL}/api/payu/pay-pse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pse, bankCode })
    });
    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  // Mostrar resultado amigable
  function renderResult(result) {
    if (!result) return null;
    try {
      const data = JSON.parse(result);
      if (data.code === 'SUCCESS' && data.transactionResponse) {
        if (data.transactionResponse.state === 'APPROVED') {
          return <div style={{color: 'green'}}>¡Pago aprobado! ID: {data.transactionResponse.transactionId}</div>;
        }
        if (data.transactionResponse.state === 'PENDING') {
          if (data.transactionResponse.extraParameters && data.transactionResponse.extraParameters.BANK_URL) {
            return (
              <div>
                <div style={{color: 'orange'}}>Debes completar el pago en tu banco:</div>
                <a href={data.transactionResponse.extraParameters.BANK_URL} target="_blank" rel="noopener noreferrer">
                  Ir al banco
                </a>
              </div>
            );
          }
          return <div style={{color: 'orange'}}>Pago pendiente. Por favor revisa tu correo o tu banco.</div>;
        }
        if (data.transactionResponse.state === 'DECLINED') {
          return <div style={{color: 'red'}}>Pago rechazado: {data.transactionResponse.responseCode}</div>;
        }
      }
      if (data.error) {
        return <div style={{color: 'red'}}>Error: {data.error}</div>;
      }
      return <pre>{result}</pre>;
    } catch {
      return <pre>{result}</pre>;
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: 'auto', fontFamily: 'sans-serif' }}>
      <h2>Pago con Tarjeta</h2>
      <form onSubmit={handleCardPay} style={{marginBottom: 32}}>
        <input type="email" placeholder="Email" value={card.buyerEmail} onChange={e => setCard({ ...card, buyerEmail: e.target.value })} required /><br />
        <input placeholder="Nombre" value={card.payerName} onChange={e => setCard({ ...card, payerName: e.target.value })} required /><br />
        <input placeholder="DNI" value={card.payerDNI} onChange={e => setCard({ ...card, payerDNI: e.target.value })} required /><br />
        <input placeholder="Número de tarjeta" value={card.cardNumber} onChange={e => setCard({ ...card, cardNumber: e.target.value })} required /><br />
        <input placeholder="Expiración (AAAA/MM)" value={card.cardExp} onChange={e => setCard({ ...card, cardExp: e.target.value })} required /><br />
        <input placeholder="CVC" value={card.cardCVC} onChange={e => setCard({ ...card, cardCVC: e.target.value })} required /><br />
        <button type="submit">Pagar con Tarjeta</button>
      </form>

      <h2>Pago con PSE</h2>
      <form onSubmit={handlePsePay}>
        <input type="email" placeholder="Email" value={pse.buyerEmail} onChange={e => setPse({ ...pse, buyerEmail: e.target.value })} required /><br />
        <input placeholder="Nombre" value={pse.payerName} onChange={e => setPse({ ...pse, payerName: e.target.value })} required /><br />
        <input placeholder="DNI" value={pse.payerDNI} onChange={e => setPse({ ...pse, payerDNI: e.target.value })} required /><br />
        <select value={bankCode} onChange={e => setBankCode(e.target.value)} required>
          <option value="">Selecciona un banco</option>
          {banks.map(bank => (
            <option key={bank.financialInstitutionCode} value={bank.financialInstitutionCode}>
              {bank.description}
            </option>
          ))}
        </select><br />
        <button type="submit">Pagar con PSE</button>
      </form>

      <h3>Resultado:</h3>
      <div>{renderResult(result)}</div>
    </div>
  );
} 