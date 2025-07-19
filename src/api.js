// @ts-nocheck
export async function getPayuSignature({ referenceCode, amount, currency }) {
  const res = await fetch('http://localhost:4000/api/payu-signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referenceCode, amount, currency })
  });
  if (!res.ok) throw new Error('Error obteniendo la firma');
  const data = await res.json();
  return data.signature;
} 