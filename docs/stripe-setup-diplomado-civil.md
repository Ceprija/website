# Configuración de Stripe para Diplomado Civil y Familiar

## ⚠️ IMPORTANTE: Product IDs vs Price IDs

Los IDs que creaste (`prod_XXX`) son **Product IDs**, pero para el checkout necesitas **Price IDs** (`price_XXX`).

## Paso 1: Obtener los Price IDs correctos

Para cada producto que creaste en Stripe:

### 1. Pago Completo ($21,500) - `prod_USVZ0r3YWSKS7C`
1. Ve a Stripe Dashboard → Products
2. Click en el producto "Pago completo"
3. En la sección **Pricing**, verás una tabla con el precio
4. Copia el **Price ID** (empieza con `price_`)
5. Este debe ser un precio **one-time** (no recurrente)

### 2. Solo Inscripción ($1,500) - `prod_USVYeCU5wWBBqh`
1. Ve a Stripe Dashboard → Products
2. Click en el producto "Inscripción"
3. En la sección **Pricing**, copia el **Price ID**
4. Este debe ser un precio **one-time** (no recurrente)

### 3. Plan de Pagos Recurrente ($5,000/mes) - `prod_USVtFXgLoXuyIJ`
1. Ve a Stripe Dashboard → Products
2. Click en el producto "Pago recurrente"
3. En la sección **Pricing**, copia el **Price ID**
4. **CRUCIAL**: Este debe ser un precio **recurring** (mensual o el intervalo que configuraste)
5. Parece que ya tienes: `price_1TTarXKVaWLbvt9DqBhp8Gap` ✅

## Paso 2: Actualizar el archivo del programa

Una vez que tengas los 3 Price IDs, actualiza el archivo:

`src/content/programas/juridica/diplomado-derechoCivilFamiliarOralidad.md`

Reemplaza la sección `paymentOptions` con:

```yaml
paymentOptions:
  - id: "pago_completo"
    label: "Pago completo (Inscripción + Diplomado = $21,500)"
    price: 21500
    stripePriceId: "price_XXX_REEMPLAZAR"  # Price ID del producto prod_USVZ0r3YWSKS7C
    type: "hibrido"
  - id: "inscripcion"
    label: "Solo Inscripción ($1,500) — debes pagar $20,000 después"
    price: 1500
    stripePriceId: "price_XXX_REEMPLAZAR"  # Price ID del producto prod_USVYeCU5wWBBqh
    type: "hibrido"
  - id: "plan_diferido"
    label: "Plan de pagos: 4 pagos de $5,000 (Inscripción aparte)"
    price: 5000
    stripePriceId: "price_1TTarXKVaWLbvt9DqBhp8Gap"  # ✅ Este ya es correcto
    type: "hibrido"
```

## Paso 3: Nota importante sobre el Plan Diferido

**Cuando un estudiante seleccione "Plan de pagos de 4 pagos":**
- La suscripción se cobrará automáticamente cada mes (o el intervalo configurado)
- Después del 4to pago, la suscripción se cancelará **automáticamente**
- **La inscripción de $1,500 NO está incluida** — el estudiante debe pagarla por separado primero

## Paso 4: Actualizar `.env` para producción

```env
# Stripe (Production)
STRIPE_SECRET_KEY=sk_live_XXXXXXXXX  # Cambia a tu clave LIVE
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXX  # Configura el webhook en Stripe
STRIPE_ALLOWED_PRICE_IDS=price_XXX,price_YYY,price_1TTarXKVaWLbvt9DqBhp8Gap
```

## Paso 5: Configurar Webhook en Stripe

1. Ve a Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://tudominio.com/api/stripe/webhook`
4. **Eventos a escuchar:**
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded` ← **CRÍTICO para el límite de 4 pagos**
   - `customer.subscription.deleted`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
5. Copia el **Signing secret** (empieza con `whsec_`) y ponlo en `STRIPE_WEBHOOK_SECRET`

## Cómo funciona el límite de 4 pagos

El código ya está implementado para:
1. Detectar automáticamente si un Price ID es recurrente
2. Crear una Checkout Session de tipo `subscription` (en lugar de `payment`)
3. En cada pago exitoso (`invoice.payment_succeeded`), contar cuántos pagos se han hecho
4. Cuando llegue al 4to pago, marcar la suscripción como `cancel_at_period_end: true`
5. La suscripción se cancelará automáticamente y no habrá un 5to cobro

## Paso 6: Probar en modo Test

Antes de ir a producción:

1. Usa tus claves de **Test** (`sk_test_XXX`)
2. Crea precios de test (ej. $1 USD en lugar de $5,000 MXN)
3. Usa tarjetas de prueba de Stripe:
   - `4242 4242 4242 4242` (pago exitoso)
   - `4000 0000 0000 0341` (pago rechazado)
4. Verifica que después de 4 pagos, la suscripción se cancele automáticamente
5. Revisa los logs en `/Users/estebanm/.cursor/projects/Users-estebanm-Ceprija/terminals/1.txt`

## Resumen de Price IDs necesarios

| Opción | Precio | Tipo | Product ID | Price ID (necesario) | Status |
|--------|--------|------|------------|---------------------|--------|
| Pago completo | $21,500 | One-time | `prod_USVZ0r3YWSKS7C` | `price_???` | ❌ Falta |
| Inscripción | $1,500 | One-time | `prod_USVYeCU5wWBBqh` | `price_???` | ❌ Falta |
| Plan diferido | $5,000 | Recurring | `prod_USVtFXgLoXuyIJ` | `price_1TTarXKVaWLbvt9DqBhp8Gap` | ✅ Listo |

---

**Próximos pasos:**
1. Obtén los 2 Price IDs faltantes desde Stripe Dashboard
2. Actualiza el archivo `.md` del diplomado
3. Actualiza `STRIPE_ALLOWED_PRICE_IDS` en `.env`
4. Configura el webhook en Stripe
5. Prueba en modo Test antes de producción
