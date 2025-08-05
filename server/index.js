// server.js

// 1. Carga las variables de entorno del archivo .env
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
// ¡Importante! Necesitamos el transportador de SendGrid
const sendgridTransport = require('nodemailer-sendgrid-transport');
const { body, validationResult } = require('express-validator');

const app = express();
// Configuración de CORS seguro
const allowedOrigin = process.env.WIX_ORIGIN || 'https://tusitio.wixsite.com';
app.use(cors({ origin: allowedOrigin }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// --- CONFIGURACIÓN DEL "CARTERO" (Ahora con SendGrid) ---
// Nos aseguramos de que coincida con tu archivo .env
const transporter = nodemailer.createTransport(sendgridTransport({
  auth: {
    api_key: process.env.SENDGRID_API_KEY // Usa la API Key de SendGrid desde el .env
  }
}));

// --- RUTA NUEVA PARA LA CONFIRMACIÓN DE PAYU ---
app.post('/api/payu-confirmation', [
  body('merchant_id').isString(),
  body('reference_sale').isString(),
  body('value').isNumeric(),
  body('currency').isString(),
  body('state_pol').isString(),
  body('sign').isString(),
  body('email_buyer').optional().isEmail()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const {
    merchant_id,
    reference_sale,
    value,
    currency,
    state_pol, // El estado de la transacción (4 = Aprobada)
    sign,      // La firma que envía PayU para que verifiquemos
    email_buyer
  } = req.body;

  const apiKey = process.env.PAYU_API_KEY;

  // 1. VERIFICAR LA FIRMA DE PAYU
  const valueRounded = parseFloat(value).toFixed(1);
  const signatureString = `${apiKey}~${merchant_id}~${reference_sale}~${valueRounded}~${currency}~${state_pol}`;
  const createdSign = crypto.createHash('md5').update(signatureString).digest('hex');

  if (createdSign.toLowerCase() !== sign.toLowerCase()) {
    console.error("¡ALERTA! Las firmas de PayU no coinciden.");
    return res.status(400).send("Firma no válida.");
  }

  // 2. VERIFICAR SI LA TRANSACCIÓN FUE APROBADA
  if (state_pol === '4') {
    console.log(`✅ Pago con PayU APROBADO para la referencia: ${reference_sale}`);

    const emailContent = `
      <h1>¡Nuevo pedido pagado con PayU!</h1>
      <p><strong>Referencia de Venta:</strong> ${reference_sale}</p>
      <p><strong>Email del Comprador:</strong> ${email_buyer}</p>
      <p><strong>Valor:</strong> ${value} ${currency}</p>
      <p>Este pedido ha sido pagado exitosamente a través de PayU.</p>
    `;

    // Usamos las variables de entorno de SendGrid
    const mailOptions = {
      from: process.env.SENDGRID_FROM_EMAIL,
      to: process.env.SENDGRID_TO_EMAIL, 
      subject: `Nuevo Pedido con PayU - ${reference_sale}`,
      html: emailContent,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error al enviar el correo de PayU:', error);
      } else {
        console.log('Correo de notificación de PayU enviado con éxito:', info.response);
      }
    });

  } else {
    console.log(`Transacción de PayU NO aprobada. Estado: ${state_pol}`);
  }

  res.status(200).send('Confirmación recibida');
});

// --- ENDPOINT PARA OBTENER FIRMA DE PAYU ---
app.post('/api/payu-signature', [
  body('referenceCode').isString(),
  body('amount').isNumeric(),
  body('currency').isString()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { referenceCode, amount, currency } = req.body;
  const apiKey = process.env.PAYU_API_KEY;
  const merchantId = process.env.PAYU_MERCHANT_ID;
  
  // Crear la firma para PayU
  const signatureString = `${apiKey}~${merchantId}~${referenceCode}~${amount}~${currency}`;
  const signature = crypto.createHash('md5').update(signatureString).digest('hex');
  
  res.json({ signature });
});

// --- ENDPOINT PARA ENVIAR CORREO CON SENDGRID DESDE EL FRONTEND ---
app.post('/api/sendgrid-mail', [
  body('colors').isObject(),
  body('screenshot').isString(),
  body('buyerEmail').optional().isEmail(),
  body('paymentMethod').isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { colors, screenshot, buyerEmail, paymentMethod } = req.body;

  let htmlContent = `<h1>Nuevo pedido recibido</h1>`;
  htmlContent += `<p><strong>Método de pago:</strong> ${paymentMethod || 'No especificado'}</p>`;
  if (buyerEmail) htmlContent += `<p><strong>Email del comprador:</strong> ${buyerEmail}</p>`;
  if (colors) {
    htmlContent += `<h2>Colores seleccionados:</h2><ul>`;
    htmlContent += `<li><b>Chasis:</b> ${colors.chasis}</li>`;
    htmlContent += `<li><b>Botones:</b> ${(Object.values(colors.buttons || {}).join(', ') || 'Por defecto')}</li>`;
    htmlContent += `<li><b>Perillas:</b> ${(Object.values(colors.knobs || {}).join(', ') || 'Por defecto')}</li>`;
    htmlContent += `</ul>`;
  }
  if (screenshot) {
    htmlContent += `<h2>Imagen de la configuración:</h2><img src="${screenshot}" alt="Configuración" style="max-width:400px; border-radius:8px;" />`;
  }

  const mailOptions = {
    from: process.env.SENDGRID_FROM_EMAIL,
    to: process.env.SENDGRID_TO_EMAIL,
    subject: `Nuevo Pedido (${paymentMethod || 'Pago'})`,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ ok: true, message: 'Correo enviado correctamente' });
  } catch (error) {
    console.error('Error al enviar correo con SendGrid:', error);
    res.status(500).json({ ok: false, error: 'Error enviando correo' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});