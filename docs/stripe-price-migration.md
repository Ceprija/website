# Stripe Price Migration Checklist

Use this checklist when switching from Stripe test mode to live mode.

## Current Price References

Run:

```sh
npm run validate:stripe
```

The validator scans `src/content/programas/**.md` and fails when it finds:

- Placeholder IDs (`price_REPLACE_...`)
- Example IDs (`price_1Cfg...`)
- IDs missing from `STRIPE_ALLOWED_PRICE_IDS`

## Migration Table

Fill this table before deployment.

| Program file | Current/test price | Live price | Notes |
| --- | --- | --- | --- |
| `src/content/programas/economica/curso-actualizacionJurisprudencia.md` | `price_1CfgActJurFiscalPres` | `TODO` | Presencial |
| `src/content/programas/economica/curso-actualizacionJurisprudencia.md` | `price_1CfgActJurFiscalOnln` | `TODO` | En línea |
| `src/content/programas/economica/curso-patrimonio.md` | `price_1CfgCurPatrimPres` | `TODO` | Presencial |
| `src/content/programas/economica/curso-patrimonio.md` | `price_1CfgCurPatrimOnln` | `TODO` | En línea |
| `src/content/programas/economica/curso-penalFiscal.md` | `price_1CfgCurPenalFisPres` | `TODO` | Presencial |
| `src/content/programas/economica/curso-penalFiscal.md` | `price_1CfgCurPenalFisOnln` | `TODO` | En línea |
| `src/content/programas/juridica/maestria-derechoCivil.md` | `price_REPLACE_mae_civil_inscripcion` | `TODO` | Inscripción |
| `src/content/programas/juridica/maestria-derechoCivil.md` | `price_REPLACE_mae_civil_reinscripcion` | `TODO` | Reinscripción |
| `src/content/programas/juridica/maestria-derechoCivil.md` | `price_1CfgMaeCivilOnln` | `TODO` | En línea |
| `src/content/programas/juridica/maestria-derechoCivil.md` | `price_1CfgMaeCivilPres` | `TODO` | Presencial |

The remaining `price_1T...` IDs must also be verified against the target Stripe account and mode. If they are test-mode prices, replace them with live-mode prices before setting `STRIPE_SECRET_KEY=sk_live_...`.

## Deployment Gate

Production is ready only when:

1. Every active payable option has a live `price_...` ID.
2. `STRIPE_ALLOWED_PRICE_IDS` contains the exact same live IDs.
3. `NODE_ENV=production npm run validate:stripe` passes.
4. A live webhook endpoint is registered and healthy.
