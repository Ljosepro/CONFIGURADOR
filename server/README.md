# Backend de Firma PayU

1. Crea un archivo `.env` en esta carpeta con el siguiente contenido:

```
PAYU_API_KEY=4Vj8eK4rloUd272L48hsrarnUA
PAYU_MERCHANT_ID=508029
PAYU_ACCOUNT_ID=512321
```

2. Instala las dependencias:

    npm install

3. Inicia el servidor:

    node index.js

El endpoint POST `/api/payu-signature` recibe `{ referenceCode, amount, currency }` y responde `{ signature }`. 

---

## Integración de PayPal Webhook

1. En el [PayPal Developer Dashboard](https://developer.paypal.com/), ve a tu app REST y agrega la URL de tu backend como webhook (por ejemplo, https://tudominio.com/api/paypal-webhook o http://localhost:4000/api/paypal-webhook para pruebas locales con ngrok).

2. Selecciona los eventos:
   - PAYMENT.CAPTURE.COMPLETED
   - (Opcional) Otros eventos que quieras manejar

3. Copia el Webhook ID que te da PayPal y agrégalo a tu archivo `.env`:

```
PAYPAL_WEBHOOK_ID=tu_webhook_id
PAYPAL_CLIENT_ID=tu_client_id
PAYPAL_CLIENT_SECRET=tu_client_secret
```

4. El endpoint `/api/paypal-webhook` ya está listo para recibir notificaciones. PayPal enviará POSTs firmados y el backend los verificará automáticamente.

5. Cuando recibas un pago exitoso, se enviará un correo igual que con PayU.

6. Para pruebas locales, usa [ngrok](https://ngrok.com/) para exponer tu servidor local a internet y configura la URL pública en el dashboard de PayPal.

--- 