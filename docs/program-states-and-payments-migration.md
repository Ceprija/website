# Program States and Structured Payments - Implementation Guide

**Date:** May 4, 2026  
**Status:** ✅ COMPLETED

## Overview

Successfully implemented program states (active/waitlist/disabled) and structured payment options for Stripe integration, while maintaining 100% backward compatibility with existing program files and zero visual impact on the UI.

## What Changed

### 1. Schema Updates (`src/content.config.ts`)

#### New Fields

**`status`** (enum):
- `"active"` - Program is available for enrollment (default)
- `"waitlist"` - Program is visible but not available; shows "Request Info" form
- `"disabled"` - Program is hidden from catalog

**`paymentOptions`** (array):
```typescript
paymentOptions: [
  {
    id: string           // Unique identifier (e.g., "presencial", "paquete_1")
    label: string        // Display label (e.g., "Modalidad Presencial")
    price: number        // Price in MXN as number (e.g., 5000)
    stripePriceId: string // Stripe Price ID (e.g., "price_abc123")
    type: "presencial" | "online" | "hibrido" // Modality type
  }
]
```

#### Conditional Validation

Using Zod's `.refine()` method:
- When `status === "active"`: `paymentOptions` (min 1 item) and `enrollmentFlow` are **required**
- When `status === "waitlist"` or `"disabled"`: Both are optional

#### Deprecated Fields (still supported)

- `disabled` (boolean) → use `status: "disabled"` instead
- `price` (object/number) → use `paymentOptions` array instead
- Root `stripePriceIds` → use `paymentOptions[].stripePriceId` instead

### 2. New Helper Module (`src/lib/programPayments.ts`)

Created comprehensive helper functions for backward compatibility:

- **`getPaymentOptions(program)`** - Extracts payment options from both new and legacy formats
- **`getStripePriceIds(program)`** - Gets Stripe IDs in the format expected by forms
- **`getDisplayPrices(program)`** - Converts to UI display format (e.g., "$5,000 MXN")
- **`getProgramStatus(program)`** - Handles status with backward compatibility for `disabled` field
- **`formatPrice(number)`** - Formats numbers as Mexican currency

### 3. Updated Filtering Logic (`src/lib/programPublished.ts`)

- Now uses `getProgramStatus()` to check visibility
- Programs with status `"active"` or `"waitlist"` are published (visible)
- Programs with status `"disabled"` are hidden
- Maintains full backward compatibility with legacy `disabled: true` field

### 4. UI Updates (`src/pages/oferta-academica/[slug].astro`)

#### Investment Section
- Now displays `paymentOptions` array with same visual styling
- Falls back to legacy `price` object if `paymentOptions` not present
- Identical appearance - users see no difference

#### Enrollment Section
Three-way conditional logic:

1. **Waitlist Status (`status === "waitlist"`)**
   ```html
   Shows: "Próximamente Disponible" heading
          Explanation text
          ContactForm for info requests
   Style: Same white rounded card with shadow-xl
   ```

2. **Application Flow (`enrollmentFlow === "application"`)**
   ```html
   Shows: Existing ProgramEnrollmentAsideCard
          "Iniciar Solicitud" button → /enrollment/{slug}
   ```

3. **Inline Flow (default)**
   ```html
   Shows: Existing ContinuousEducationForm
          Payment and registration steps
   ```

### 5. Template and Documentation

- **Updated `src/content-templates/programas/TEMPLATE.md`** with:
  - New format examples
  - Migration notes
  - All status examples (active, waitlist, disabled, hibrido)
  
- **Migrated `src/content/programas/juridica/curso-nuevas-facultades.md`** as reference example

## Usage Examples

### Active Program (Standard)

```yaml
status: "active"
paymentOptions:
  - id: "presencial"
    label: "Modalidad Presencial"
    price: 5000
    stripePriceId: "price_abc123"
    type: "presencial"
  - id: "online"
    label: "Modalidad En Línea"
    price: 4000
    stripePriceId: "price_def456"
    type: "online"
enrollmentFlow: "inline"
```

### Hybrid Modality Program

```yaml
status: "active"
paymentOptions:
  - id: "hibrido"
    label: "Modalidad Híbrida (Presencial + En Línea)"
    price: 4500
    stripePriceId: "price_xyz789"
    type: "hibrido"
enrollmentFlow: "inline"
```

### Program with Multiple Packages

```yaml
status: "active"
paymentOptions:
  - id: "modulo_1"
    label: "Módulo Individual 1"
    price: 2500
    stripePriceId: "price_mod1"
    type: "presencial"
  - id: "paquete"
    label: "Paquete Completo"
    price: 4500
    stripePriceId: "price_package"
    type: "presencial"
enrollmentFlow: "inline"
```

### Waitlist Program

```yaml
status: "waitlist"
# No paymentOptions or enrollmentFlow needed
# Shows "Request Info" form instead
title: "Programa en Desarrollo"
description: "..."
# ... rest of fields (curriculum, instructor, etc.) are displayed normally
```

### Disabled Program

```yaml
status: "disabled"
# Program is completely hidden from catalog
# No page is generated
```

## Migration Checklist for Existing Programs

To migrate an existing program from legacy format to new format:

1. **Add `status` field**
   ```yaml
   status: "active"  # or "waitlist" or "disabled"
   ```

2. **Convert `price` object to `paymentOptions` array**
   
   **Before:**
   ```yaml
   price:
     Presencial: "$5,000 MXN"
     "En línea": "$4,000 MXN"
   stripePriceIds:
     presencial: "price_abc123"
     online: "price_def456"
   ```
   
   **After:**
   ```yaml
   paymentOptions:
     - id: "presencial"
       label: "Presencial"
       price: 5000
       stripePriceId: "price_abc123"
       type: "presencial"
     - id: "online"
       label: "En línea"
       price: 4000
       stripePriceId: "price_def456"
       type: "online"
   ```

3. **Add `enrollmentFlow` if not present**
   ```yaml
   enrollmentFlow: "inline"  # or "application"
   ```

4. **Remove or comment out deprecated fields** (optional)
   ```yaml
   # Legacy fields (can be removed after migration):
   # price: ...
   # stripePriceIds: ...
   # disabled: ...
   ```

## Backward Compatibility

✅ **All existing program files continue to work without modification**

The system automatically:
- Maps `disabled: true` → `status: "disabled"`
- Converts old `price` object to display format
- Uses old `stripePriceIds` for Stripe integration
- Defaults to `status: "active"` if not specified

## Testing Checklist

- [x] Schema validates correctly with new fields
- [x] Conditional validation works (active programs require paymentOptions)
- [x] Legacy programs still display correctly
- [x] New format programs display correctly
- [x] Waitlist programs show ContactForm instead of payment
- [x] Disabled programs don't appear in catalog
- [x] Investment section displays prices identically
- [x] No visual changes to UI (zero visual impact)
- [x] No linter errors

## Files Modified

1. ✅ `src/content.config.ts` - Schema with status and paymentOptions
2. ✅ `src/lib/programPayments.ts` - NEW helper module
3. ✅ `src/lib/programPublished.ts` - Updated filtering logic
4. ✅ `src/pages/oferta-academica/[slug].astro` - UI updates for all three states
5. ✅ `src/content-templates/programas/TEMPLATE.md` - Updated template and examples
6. ✅ `src/content/programas/juridica/curso-nuevas-facultades.md` - Example migration

## Next Steps for Content Team

1. **Immediate**: All existing programs continue working - no action required
2. **Gradual Migration**: Convert programs to new format as they're updated
3. **New Programs**: Use new format from template (required for active programs)
4. **Waitlist Programs**: Set `status: "waitlist"` for programs not yet scheduled

## Support

- See `TEMPLATE.md` for complete examples
- Check `curso-nuevas-facultades.md` for migrated example
- All helper functions are in `src/lib/programPayments.ts`
- Schema validation errors will be clear about what's missing

---

**Implementation completed successfully** ✅  
Zero visual impact · Full backward compatibility · Ready for production
