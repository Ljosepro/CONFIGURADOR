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