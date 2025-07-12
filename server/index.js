require('dotenv').config();
const express = require('express');
const cors = require('cors');
const md5 = require('md5');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint para generar la firma PayU
app.post('/api/payu-signature', (req, res) => {
  const { referenceCode, amount, currency } = req.body;
  const apiKey = process.env.PAYU_API_KEY;
  const merchantId = process.env.PAYU_MERCHANT_ID;

  if (!referenceCode || !amount || !currency) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  // La firma es: API_KEY~merchantId~referenceCode~amount~currency
  const signatureString = `${apiKey}~${merchantId}~${referenceCode}~${amount}~${currency}`;
  const signature = md5(signatureString);

  res.json({ signature });
});

// Endpoint para recibir notificaciones de PayU
app.post('/api/payu-webhook', async (req, res) => {
  // PayU envía los datos en req.body
  const { state_pol, email_buyer, reference_sale, description, value, extra1 } = req.body;

  // Solo si el pago fue aprobado
  if (state_pol === '4') { // 4 = aprobado
    // Configura tu transportador de correo
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NOTIFY_EMAIL_USER, // Usa variables de entorno
        pass: process.env.NOTIFY_EMAIL_PASS
      }
    });

    // Construye el mensaje
    let mailOptions = {
      from: 'Notificaciones Beato <' + process.env.NOTIFY_EMAIL_USER + '>',
      to: process.env.NOTIFY_EMAIL_TO || process.env.NOTIFY_EMAIL_USER, // Admin
      subject: '¡Nuevo pago recibido!',
      text: `Pago aprobado.\nComprador: ${email_buyer}\nReferencia: ${reference_sale}\nProducto: ${description}\nValor: ${value}\nEspecificaciones: ${extra1 || 'No especificadas'}`
    };

    // Envía el correo
    try {
      await transporter.sendMail(mailOptions);
      console.log('Correo de notificación enviado.');
    } catch (err) {
      console.error('Error enviando correo:', err);
    }
  }

  // Responde a PayU
  res.send('OK');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor PayU Signature corriendo en puerto ${PORT}`);
}); 