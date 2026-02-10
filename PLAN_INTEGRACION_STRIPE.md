# Plan de Integración: Stripe + Flujo de Inscripción + Generación CSV

## 📋 Resumen General
Integrar pasarela de pago **Stripe** en el flujo de inscripción para validar modalidad (Presencial/En línea), procesar pagos según precio correspondiente, y generar archivo CSV con todos los detalles de registro para descarga administrativo.

---

## 🎯 Objetivos Principales

1. **Integración de Stripe**: Capturar pago antes de completar inscripción
2. **Validación de Modalidad**: Asociar precio correcto según modalidad seleccionada
3. **Generación de CSV**: Guardar datos de registro con timestamp
4. **Descarga de CSV**: Permitir descarga de archivo consolidado

---

## 📊 Flujo de Registro Actualizado

```
[Usuario llena formulario] 
    ↓
[Selecciona modalidad] → Precio asociado dinámicamente
    ↓
[Crea sesión Stripe con precio según modalidad]
    ↓
[Redirige a checkout de Stripe]
    ↓
[Usuario completa pago en Stripe]
    ↓
[Webhook de Stripe confirma pago] → Ok: continuar
    ↓
[Guarda en CSV + Envía confirmación]
    ↓
[Retorna a página de éxito]
```

---

## 🛠️ Cambios por Componente

### **1. Backend: API `/api/register.ts`**

#### Cambios:
- ✅ Mantener recolección de datos del formulario
- ✅ Crear sesión Stripe con endpoint `/api/checkout-session`
- ✅ Guardar datos en caché temporal (Redis o archivo JSON)
- ✅ Al webhook de Stripe confirmar pago → guardar en CSV
- ✅ Crear endpoint `/api/download-csv` para descargar archivo consolidado

#### Nuevos endpoints:
```
POST /api/checkout-session
  Input: formData (name, email, phone, program, modality, price)
  Output: { sessionId, checkoutUrl }

POST /api/stripe-webhook
  Input: webhook de Stripe
  Output: procesamiento de evento payment_intent.succeeded
  
GET /api/download-csv
  Input: (opcional) filtro por fecha/programa
  Output: archivo CSV descargable
```

---

### **2. Frontend: `RegistrationForm.astro`**

#### Cambios:
- ✅ Remover campo "Comprobante de Pago" (Stripe maneja el pago seguro)
- ✅ Agregar campo dinámico de **precio** basado en modalidad
- ✅ Cambiar flujo de submit: en lugar de POST directo a `/api/register`
  1. POST a `/api/checkout-session` → obtener `sessionId`
  2. Redirigir a `https://checkout.stripe.com/pay/{sessionId}`
- ✅ Agregar estado "Redirigiendo a pago..."
- ✅ Mantener recolección de datos básicos (nombre, email, teléfono)

#### Archivo a modificar:
```
src/components/RegistrationForm.astro
```

---

### **3. Nuevos Archivos**

#### `src/utils/csv-handler.ts`
```typescript
// Funciones para:
// - Agregar fila a CSV
// - Leer archivo CSV
// - Validar estructura
export function appendToCSV(data: RegistrationData): void
export function readAllRegistrations(): RegistrationData[]
export function getCSVContent(): string
```

#### `src/utils/stripe-config.ts`
```typescript
// Configuración de Stripe
// - Inicializar cliente
// - Crear sesiones
export function initStripe()
export function createCheckoutSession(data, price, modality)
export function verifyWebhook(rawBody, signature)
```

#### `src/pages/api/checkout-session.ts`
```typescript
// POST: crear sesión de Stripe
// 1. Validar datos (name, email, phone, program, modality)
// 2. Obtener precio según modalidad
// 3. Crear sesión con Stripe
// 4. Guardar datos temporales
// 5. Retornar sessionId + URL checkout
```

#### `src/pages/api/stripe-webhook.ts`
```typescript
// POST: recibir webhook de Stripe
// 1. Verificar signature
// 2. Si payment_intent.succeeded:
//    - Recuperar datos temporales
//    - Guardar en CSV
//    - Enviar confirmación por correo (Brevo)
// 3. Retornar 200 OK
```

#### `src/pages/api/download-csv.ts`
```typescript
// GET: descargar CSV
// 1. Validar autenticación (token/API key)
// 2. Leer archivo CSV
// 3. Retornar archivo con headers de descarga
```

#### `src/pages/success-registration.astro`
```astro
// Nueva página de éxito tras pago completado
// - Mostrar confirmación de inscripción
// - Mostrar detalles registrados (programa, modalidad, precio)
// - Mostrar referencia de transacción de Stripe
// - Link a descargar comprobante de Stripe desde email
```

---

## 📦 Dependencias a Instalar

```bash
pnpm add stripe
pnpm add -D @types/stripe

# Opcional (si se elige persistencia con DB):
# pnpm add better-sqlite3  # O tu DB preferida
```

---

## 🔐 Variables de Entorno Necesarias

Agregar al `.env`:
```env
# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# CSV Storage
CSV_FILE_PATH=./data/registrations.csv
CSV_TEMP_DIR=./data/temp

# URLs
SITE_URL=https://ceprija.edu.mx
SUCCESS_REDIRECT_URL=/success-registration
CANCEL_REDIRECT_URL=/formulario-cancelado
```

---

## 📊 Estructura CSV Final

```csv
fecha_registro,nombre,email,telefono,programa,modalidad,precio,estado,fecha_pago,transaccion_stripe
2026-02-10 14:30:45,Juan Pérez,juan@email.com,+52 33 1234 5678,Maestría Penal,Presencial,$8000.00,pagado,2026-02-10 14:35:22,ch_1XXXXX
2026-02-10 14:32:10,María López,maria@email.com,+52 33 1234 5679,Curso Fiscal,En línea,$1400.00,pagado,2026-02-10 14:33:55,ch_1YYYYY
```

---

## 🔄 Flujo Detallado Step-by-Step

### **Paso 1: Usuario envía formulario**
```
Form submission en RegistrationForm.astro
Data: {name, email, phone, program, modality, paymentProof}
```

### **Paso 2: Crear sesión Stripe**
```typescript
// POST /api/checkout-session
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{
    price_data: {
      currency: 'mxn',
      product_data: { name: `${program} - ${modality}` },
      unit_amount: Math.round(parseFloat(price) * 100) // Stripe usa centavos
    },
    quantity: 1
  }],
  mode: 'payment',
  success_url: `${SITE_URL}/success-registration?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${SITE_URL}/formulario-cancelado`
});
```

### **Paso 3: Almacenamiento temporal**
```typescript
// Guardar en archivo temporal mientras usuario completa pago
const tempData = {
  sessionId: session.id,
  formData: { name, email, phone, program, modality },
  createdAt: new Date(),
  status: 'pending'
}
await fs.writeFile(`./data/temp/${session.id}.json`, JSON.stringify(tempData))
```

### **Paso 4: Webhook de Stripe**
```typescript
// POST /api/stripe-webhook
// Stripe envía: payment_intent.succeeded
if (event.type === 'payment_intent.succeeded') {
  const sessionId = event.data.object.metadata.session_id;
  const tempData = JSON.parse(await fs.readFile(`./data/temp/${sessionId}.json`));
  
  // Guardar en CSV
  appendToCSV({
    ...tempData.formData,
    fecha_registro: tempData.createdAt,
    fecha_pago: new Date(),
    transaccion_stripe: event.data.object.id,
    estado: 'pagado'
  });
  
  // Enviar correo de confirmación
  await sendConfirmationEmail(tempData.formData);
  
  // Limpiar temp
  await fs.unlink(`./data/temp/${sessionId}.json`);
}
```

### **Paso 5: Descarga de CSV**
```typescript
// GET /api/download-csv
// Admin request → validar token
// Retornar archivo CSV con headers:
response.headers.set('Content-Disposition', 'attachment; filename=registros.csv');
response.headers.set('Content-Type', 'text/csv; charset=utf-8');
```

---

## ✅ Checklist de Implementación

### Fase 1: Configuración Base
- [ ] Instalar `stripe` y tipos
- [ ] Agregar variables de entorno `.env`
- [ ] Crear estructura de carpetas (`/data`, `/data/temp`)
- [ ] Crear archivo CSV inicial con headers

### Fase 2: Utilidades
- [ ] Crear `src/utils/csv-handler.ts`
- [ ] Crear `src/utils/stripe-config.ts`
- [ ] Crear `src/utils/webhook-handler.ts`

### Fase 3: Endpoints API
- [ ] Crear `src/pages/api/checkout-session.ts`
- [ ] Crear `src/pages/api/stripe-webhook.ts`
- [ ] Crear `src/pages/api/download-csv.ts`
- [ ] Modificar `src/pages/api/register.ts` (opcional: mantener para webhooks)

### Fase 4: Frontend
- [ ] Actualizar `RegistrationForm.astro` para redirigir a Stripe
- [ ] Crear `src/pages/success-registration.astro`
- [ ] Crear `src/pages/formulario-cancelado.astro`

### Fase 5: Integración Brevo
- [ ] Actualizar correo de confirmación en `checkout-session`
- [ ] Validar que Brevo reciba datos correctamente

### Fase 6: Testing
- [ ] Probar flow completo con Stripe Test Keys
- [ ] Validar CSV se genera correctamente
- [ ] Validar webhooks se reciben
- [ ] Probar descarga de CSV
- [ ] Validar correos de confirmación

### Fase 7: Seguridad
- [ ] Validar firma de webhook
- [ ] Proteger endpoint de descarga CSV
- [ ] Validar datos antes de guardar en CSV
- [ ] Limpiar archivos temporales automáticamente

---

## 🚀 Orden de Ejecución Recomendado

1. **Primero**: Crear utilidades (`csv-handler`, `stripe-config`)
2. **Segundo**: Crear endpoints API
3. **Tercero**: Actualizar formulario
4. **Cuarto**: Crear páginas de success/cancel
5. **Quinto**: Implementar webhooks
6. **Sexto**: Testing exhaustivo

---

## 💡 Notas Importantes

- **Seguridad**: Nunca guardar datos sensibles de tarjeta (Stripe lo maneja)
- **Almacenamiento**: Considerar cambiar de archivos JSON a base de datos para producción
- **Limpieza**: Implementar limpieza de logs temporales cada X horas
- **Testing**: Usar `stripe listen --forward-to localhost:3000/api/stripe-webhook` para webhooks locales
- **Logs**: Guardar all requests/responses para debugging

---

## 📝 Ejemplo de Petición Completa

```bash
# 1. Usuario envía form (SIN comprobante)
POST /api/checkout-session
Content-Type: application/json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+52 3312345678",
  "program": "Maestría en Derecho Penal",
  "modality": "Presencial"
}

# Respuesta
{
  "sessionId": "cs_test_xxxx",
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_xxxx"
}

# 2. Frontend redirige a checkoutUrl
# 3. Usuario completa pago en Stripe (tarjeta, transferencia, etc.)
# 4. Stripe envía webhook a /api/stripe-webhook
# 5. Sistema guarda en CSV + envía correo de confirmación
# 6. Usuario redirigido a /success-registration
```

---

## 📞 Soporte y Testing

- Documentación Stripe: https://stripe.com/docs
- SDK Stripe (Node): https://github.com/stripe/stripe-node
- Webhooks Testing: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

