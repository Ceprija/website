# Resumen: Implementación de Pagos Diferidos con Límite de 4 Cuotas

## ✅ Lo que ya está implementado

### 1. Backend - Detección automática de subscripciones
**Archivo:** `src/pages/api/stripe/create-checkout-session.ts`

- ✅ El endpoint ahora **detecta automáticamente** si un Price ID es recurrente
- ✅ Si es recurrente, crea una Checkout Session de tipo `subscription` en lugar de `payment`
- ✅ Agrega metadata `payment_cycle_limit: "4"` para marcar que debe limitarse a 4 pagos

### 2. Webhook - Cancelación automática después de 4 pagos
**Archivo:** `src/pages/api/stripe/webhook.ts`

- ✅ Escucha el evento `invoice.payment_succeeded` (se dispara cada vez que se cobra una cuota)
- ✅ Cuenta cuántos pagos se han realizado para esa suscripción
- ✅ Cuando llega al pago #4, marca la suscripción como `cancel_at_period_end: true`
- ✅ La suscripción se cancela automáticamente y NO habrá un 5to cobro

### 3. Documentación
**Archivos creados:**
- ✅ `docs/stripe-setup-diplomado-civil.md` - Instrucciones paso a paso
- ✅ Este documento (resumen de implementación)

---

## ⚠️ Lo que FALTA por hacer

### 1. Obtener Price IDs de Stripe (CRÍTICO)

Actualmente tienes **Product IDs** (`prod_xxx`) pero necesitas **Price IDs** (`price_xxx`).

**Cómo obtenerlos:**
1. Ve a Stripe Dashboard → Products
2. Para cada producto (`prod_USVZ0r3YWSKS7C` y `prod_USVYeCU5wWBBqh`):
   - Click en el producto
   - En "Pricing", verás los precios con sus Price IDs (empiezan con `price_`)
   - Copia esos Price IDs

**Tabla de IDs necesarios:**

| Opción | Product ID | Price ID actual | ¿Correcto? |
|--------|-----------|----------------|-----------|
| Pago completo ($21,500) | `prod_USVZ0r3YWSKS7C` | `prod_USVZ0r3YWSKS7C` ❌ | NO - necesita Price ID |
| Inscripción ($1,500) | `prod_USVYeCU5wWBBqh` | `prod_USVYeCU5wWBBqh` ❌ | NO - necesita Price ID |
| Plan diferido ($5,000x4) | `prod_USVtFXgLoXuyIJ` | `price_1TTarXKVaWLbvt9DqBhp8Gap` ✅ | SÍ |

### 2. Actualizar archivo del programa

**Archivo:** `src/content/programas/juridica/diplomado-derechoCivilFamiliarOralidad.md`

Reemplazar las líneas 15-30 con:

```yaml
paymentOptions:
  - id: "pago_completo"
    label: "Pago completo (Inscripción + Diplomado = $21,500)"
    price: 21500
    stripePriceId: "price_XXXXX"  # ← Reemplazar con Price ID real
    type: "hibrido"
  - id: "inscripcion_sola"
    label: "Solo Inscripción ($1,500) — pagarás $20,000 después"
    price: 1500
    stripePriceId: "price_YYYYY"  # ← Reemplazar con Price ID real
    type: "hibrido"
  - id: "plan_diferido"
    label: "Plan de 4 pagos de $5,000 (Inscripción $1,500 aparte)"
    price: 5000
    stripePriceId: "price_1TTarXKVaWLbvt9DqBhp8Gap"  # ← Ya es correcto
    type: "hibrido"
```

### 3. Modificar el formulario para múltiples opciones de pago

**Problema:** El `ContinuousEducationForm` actual solo soporta 2 opciones:
- Presencial
- En línea

Pero ahora necesitas que el usuario elija entre 3 opciones de pago:
- Pago completo ($21,500)
- Solo inscripción ($1,500)
- Plan diferido de 4 pagos ($5,000 cada uno)

**Soluciones posibles:**

#### Opción A: Formulario personalizado (recomendado a largo plazo)
Crear un nuevo componente `ContinuousEducationFormMultiPayment.astro` que:
1. Primero muestre las 3 opciones de pago con radio buttons
2. Si el usuario selecciona "Plan diferido", mostrar advertencia: 
   > ⚠️ **Importante:** La inscripción de $1,500 debe pagarse por separado antes de iniciar el plan de pagos.
3. Luego pida los datos del estudiante
4. Al crear la sesión de Stripe, use el `stripePriceId` de la opción seleccionada

#### Opción B: Solución rápida (temporal)
Por ahora, puedes:
1. Usar el formulario actual solo para "Pago completo" e "Inscripción"
2. Para "Plan diferido", crear un Payment Link manual en Stripe y ponerlo como un botón separado
3. Agregar un texto claro: "Para plan de pagos diferidos, haz clic aquí"

### 4. Configurar webhook en Stripe (CRÍTICO)

**Paso a paso:**
1. Ve a Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL del endpoint: `https://tudominio.com/api/stripe/webhook`
4. **Eventos a escuchar:**
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.payment_failed`
   - ✅ `invoice.payment_succeeded` ← **CRÍTICO para límite de 4 pagos**
   - ✅ `customer.subscription.deleted`
   - ✅ `charge.refunded`
   - ✅ `charge.dispute.created`
   - ✅ `charge.dispute.closed`
5. Copia el **Signing secret** (empieza con `whsec_`)
6. Ponlo en `.env` como `STRIPE_WEBHOOK_SECRET=whsec_...`

**Sin este webhook configurado, la suscripción NO se cancelará automáticamente después de 4 pagos.**

### 5. Actualizar variables de entorno para producción

**Archivo:** `.env`

```env
# Stripe Production
STRIPE_SECRET_KEY=sk_live_XXXXXXXXX  # ← Cambiar a clave LIVE
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXX  # ← Del paso anterior
STRIPE_ALLOWED_PRICE_IDS=price_completo,price_inscripcion,price_1TTarXKVaWLbvt9DqBhp8Gap
```

---

## 🧪 Cómo probar

### Prueba en modo Test (recomendado primero)

1. **Crear precios de prueba en Stripe:**
   - Usa tu cuenta de Test Mode
   - Crea 3 precios de prueba:
     - Pago completo: $1 USD (one-time)
     - Inscripción: $0.50 USD (one-time)
     - Plan diferido: $0.25 USD (recurring mensual)

2. **Configurar webhook de test:**
   - Webhook URL: `http://localhost:4321/api/stripe/webhook`
   - O usa Stripe CLI para forward: `stripe listen --forward-to localhost:4321/api/stripe/webhook`

3. **Probar el flujo completo:**
   - Selecciona "Plan diferido"
   - Completa el pago en Stripe (usa tarjeta de prueba `4242 4242 4242 4242`)
   - Verifica que se crea la suscripción
   - Simula los 4 pagos manualmente desde Stripe Dashboard o espera (si configuraste intervalo corto)
   - Después del 4to pago, verifica que la suscripción se marca para cancelación

4. **Revisar logs:**
   - Logs del servidor: `/Users/estebanm/.cursor/projects/Users-estebanm-Ceprija/terminals/1.txt`
   - Logs de Stripe: Dashboard → Developers → Logs

---

## 📋 Checklist final antes de producción

- [ ] Obtener los 2 Price IDs faltantes desde Stripe Dashboard
- [ ] Actualizar `diplomado-derechoCivilFamiliarOralidad.md` con Price IDs correctos
- [ ] Decidir entre Opción A o B para el formulario (ver arriba)
- [ ] Configurar webhook en Stripe con los 7 eventos listados
- [ ] Copiar `STRIPE_WEBHOOK_SECRET` a `.env`
- [ ] Cambiar `STRIPE_SECRET_KEY` a clave LIVE (`sk_live_...`)
- [ ] Actualizar `STRIPE_ALLOWED_PRICE_IDS` con los 3 Price IDs
- [ ] Probar en Test Mode primero
- [ ] Hacer una prueba real con $1 MXN en producción
- [ ] Verificar en Stripe Dashboard que después de 4 pagos se cancela
- [ ] Documentar proceso para control escolar (¿cómo saben cuántos pagos llevan?)

---

## 📄 Archivos modificados en esta implementación

1. ✅ `src/pages/api/stripe/create-checkout-session.ts` - Detecta y maneja subscripciones
2. ✅ `src/pages/api/stripe/webhook.ts` - Cancela después de 4 pagos
3. ✅ `docs/stripe-setup-diplomado-civil.md` - Instrucciones detalladas
4. ✅ `docs/implementacion-pagos-diferidos-resumen.md` - Este documento

---

## 💡 Próximos pasos inmediatos

1. **Conseguir los Price IDs** (5 minutos en Stripe Dashboard)
2. **Actualizar el archivo `.md`** (2 minutos)
3. **Configurar webhook** (10 minutos)
4. **Probar en Test Mode** (30 minutos)
5. **Decidir sobre el formulario** (depende de urgencia):
   - Si es urgente: usar Payment Link manual por ahora (Opción B)
   - Si tienes tiempo: crear formulario personalizado (Opción A)

---

## 📞 Preguntas frecuentes

**P: ¿El usuario debe pagar la inscripción antes del plan diferido?**
R: Sí. El plan diferido solo incluye los $20,000 del diplomado divididos en 4 pagos de $5,000. La inscripción de $1,500 debe pagarse por separado.

**P: ¿Qué pasa si el pago #2 o #3 falla?**
R: Stripe intentará cobrar automáticamente según su configuración de reintentos. Si todos los reintentos fallan, la suscripción se cancela. Puedes configurar esto en Stripe Dashboard → Settings → Billing.

**P: ¿Cómo sabrá control escolar cuántos pagos ha hecho un estudiante?**
R: En Stripe Dashboard → Customers → selecciona el cliente → Subscriptions → ve la lista de invoices pagadas.

**P: ¿Puedo cambiar el intervalo de pago (semanal, quincenal)?**
R: Sí. Al crear el Price en Stripe, puedes configurar:
- Mensual (monthly)
- Cada 2 semanas (every 2 weeks)
- Personalizado (custom interval)

**P: ¿Se puede pausar o cancelar anticipadamente?**
R: Sí. Desde Stripe Dashboard o programáticamente, puedes pausar o cancelar una suscripción en cualquier momento.

---

## ✨ Beneficios de esta implementación

1. ✅ **Automatización completa** - No necesitas intervención manual para cancelar después de 4 pagos
2. ✅ **Escalable** - Funciona para cualquier programa con cualquier límite de pagos (solo cambia el metadata)
3. ✅ **Logging completo** - Todos los eventos están registrados para auditoría
4. ✅ **Seguro** - Usa Stripe webhooks con verificación de firma
5. ✅ **Flexible** - Fácil cambiar el límite de pagos (4 → 3, 5, etc.) solo modificando el metadata
