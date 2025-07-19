const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Verifica que las variables estén presentes
if (!process.env.SENDGRID_API_KEY) {
  console.error('Falta SENDGRID_API_KEY en el .env');
  process.exit(1);
}
if (!process.env.SENDGRID_TO_EMAIL) {
  console.error('Falta SENDGRID_TO_EMAIL en el .env');
  process.exit(1);
}
if (!process.env.SENDGRID_FROM_EMAIL) {
  console.error('Falta SENDGRID_FROM_EMAIL en el .env');
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: process.env.SENDGRID_TO_EMAIL,
  from: process.env.SENDGRID_FROM_EMAIL,
  subject: 'Prueba SendGrid',
  text: '¡Funciona SendGrid desde Node.js!',
  html: '<strong>¡Funciona SendGrid desde Node.js!</strong>',
};

sgMail
  .send(msg)
  .then(() => {
    console.log('Correo de prueba enviado correctamente.');
  })
  .catch((error) => {
    console.error('Error enviando correo de prueba:', error.message || error);
    if (error.response && error.response.body) {
      console.error('Detalles:', JSON.stringify(error.response.body, null, 2));
    }
  }); 