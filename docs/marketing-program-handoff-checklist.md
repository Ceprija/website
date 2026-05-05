# Checklist — entrega de información de programas (marketing → sitio)

Documento para **revisar antes** de publicar o actualizar una ficha en `src/content/programas/`. Evita inconsistencias entre copy, calendario, precios y lo que vive en Stripe.

## 1. Coherencia interna del programa

- **Un solo criterio de “Módulo 1 / Módulo 2”** (o cuatrimestre): el mismo orden en **nombre del módulo**, **fechas**, **temario**, **precios** y **correos**. Si en un borrador el módulo 1 es “selección” y en otro es “pruebas”, hay que **definir la versión oficial** y corregir el resto.
- **Temario sin duplicar periodos**: si dos cuatrimestres o módulos repiten **exactamente** las mismas materias, o es un **error de copia** o falta el **temario real** de ese periodo; enviar la versión oficial por bloque (ej. maestría: cuatrimestres 5 y 6 no deben repetir materias de cuatrimestres anteriores salvo que sea intencional y explícito).

## 2. Precios y promociones

- **Lista vs promoción**: el precio publicado en la ficha debe coincidir con el **Price** de Stripe que se cobra por defecto. Si la promo es solo por **cupón / código en redes**, suele bastar con **no** duplicar el monto promocional en el frontmatter: se anuncia el cupón en social y en el sitio se deja una línea tipo “promociones con cupón al pagar” (ver `includes` en programas que lo usen).
- **Descuentos porcentuales**: si el descuento lo da Stripe (cupón), evitar fijar porcentajes o montos promocionales en el `.md` que no estén atados al mismo cupón/precio en Stripe.
- **IDs de Stripe**: cuando haya cobro en línea, enviar los `price_…` (presencial / en línea u opciones por módulo) y confirmar que están dados de alta en **`STRIPE_ALLOWED_PRICE_IDS`** en el servidor.

## 3. Fechas y calendario

- **Año explícito** en inicio, duración y sesiones (evita confusiones entre cohortes).
- **Sesiones vs horas**: total de horas, número de sesiones y fechas concretas deben **sumar**; revisar fines de semana / días inhábiles.

## 4. Identidad visual

- **Imagen del programa**: un archivo en `public/images/programs/` (ideal **WebP**, nombre claro). No dejar indefinido un placeholder genérico en producción.

## 5. Legal y credenciales

- **RVOE / registro académico** cuando aplique; si no aplica, el texto del programa debe dejar claro que es **actualización / seminario** según corresponda.
- **Títulos de docentes** (“Mtro.”, “Lic.”, “exfiscal”, etc.): verificar **ortografía** y que el uso esté **autorizado** para publicidad.

## 6. Tras la entrega

- Quien integre el `.md` marca en el PR o ticket: **slug final**, **URL** (`/oferta-academica/<slug>`) y si el programa va **destacado** (`featured`).

## 7. Confirmaciones de cohorte y calendario (preguntas para marketing)

Evita que un texto de “inicio” y el calendario detallado **se contradigan** (día de la semana, mes o año). Antes de campaña o prensa, **confirmar por escrito**:

- **Año de la cohorte** (p. ej. todo el calendario ¿es **2026**?).
- **Primera sesión oficial**: ¿coincide `startDate` / copy con el **primer bloque** del calendario por módulo?
- **Módulos con fechas ambiguas o “por definir”**: fecha definitiva (ej. **módulo de Medios alternos** si en borrador se solapaba con otro módulo; **masterclass** si decía “por definir”).
- **Texto comercial vs legal**: si el sitio dice una fecha y el PDF/plan académico otra, ¿cuál es la versión autorizada?

*(Ejemplo reciente: **Diplomado Civil y Familiar** — había mención de “inicio” en mayo mientras el calendario módulo a módulo arrancaba en marzo; y el fin de semana del módulo 5 se infería entre otros dos módulos hasta tener confirmación de control escolar.)*

## 8. Admisión, precondiciones y validación de documentos

En el sitio, la “validación fuerte” se acerca al campo **`requiresVerification`** (formulario con revisión) y al **`enrollmentFlow`** (`inline` = registro en la ficha; `application` = flujo tipo solicitud). **Marketing debe confirmar** qué aplica a cada programa:

- ¿Exige **cédula profesional**, **CURP**, **comprobante de estudios**, **carta laboral** u otros documentos **antes** de permitir pago o cohorte?
- ¿Hay **requisitos de perfil** (solo licenciatura en derecho, solo sector público, etc.) que deban ir en **descripción**, **prerrequisitos** o correo de bienvenida?
- Si el programa usa **`enrollmentFlow: application`**, ¿la coordinación ya tiene el checklist de documentos y tiempos de respuesta?
- Programas de **posgrado / titulación** (`maestria`, `doctorado`, `especialidad`): alinear copy de “admisión” con lo que realmente pide el proceso (y con `requiresVerification` si debe activarse revisión explícita).

## 9. Inventario `src/content/programas/` — brechas y decisiones

Tabla para **revisión con marketing**: qué sigue incompleto en contenido, si debe **mostrarse arriba** en listados/página de oferta (`featured: true` muestra el programa como destacado; conviene **reconfirmar** con negocio), y aspectos de admisión. Actualizar filas cuando se cierre cada pendiente.

| Programa (título en sitio) | Archivo | Principales brechas / pendientes en el `.md` | `featured` actual | Confirmar: ¿destacar en oferta / home? | Admisión y validación (revisar con control escolar) |
|----------------------------|---------|---------------------------------------------|-------------------|----------------------------------------|-----------------------------------------------------|
| Actualización jurisprudencial en materia fiscal | `curso-actualizacionJurisprudencia.md` | `horario` vacío; precios “Consultar” vs **Stripe** (validar montos reales) | `true` | Sí / No | `requiresVerification: false` — ¿algún requisito no reflejado? |
| Curso: Nuevas facultades (SSPC · UIF · PFF · GN) | `curso-nuevas-facultades.md` | Imagen genérica (criminalística); **sin** `stripePriceIds` — definir si cobro en línea y precios permitidos | `true` | Sí / No | Sin verificación en YAML; perfil amplio — ¿restricciones? |
| Mi futuro, mi patrimonio | `curso-patrimonio.md` | Fechas, duración y horario por definir; precios “Consultar” | `true` | Sí / No | Sin verificación |
| Curso penal fiscal 2026 | `curso-penalFiscal.md` | Calendario y duración por definir | `true` | Sí / No | Sin verificación |
| Cancelación de sellos digitales | `curso-sellosDigitales.md` | Calendario/duración por definir; precios “Consultar” | `true` | Sí / No | Sin verificación |
| Diplomado Civil y Familiar | `diplomado-derechoCivilFamiliarOralidad.md` | Imagen placeholder (mercantil); **módulo 5** (fechas confirmadas por escuela); **10% pronto pago** alineado con cupón/Stripe si aplica; `stripePriceIds` opcional | `true` | Sí / No | Sin verificación en YAML; **restricciones de pagos diferidos / pronto pago** en texto — ¿requisitos extra? |
| Diplomado en derecho laboral | `diplomado-derechoLaboral.md` | Borrador (copy, temario, precios, fechas) | `false` | Sí / No | — |
| Diplomado en derecho mercantil oral | `diplomado-derechoMercantil.md` | Temario resumido; horario/fechas vacíos; precios “Consultar” | `true` | Sí / No | Sin verificación |
| Diplomado en derecho penal y procesal penal | `diplomado-derechoPenalProcesalPenal.md` | Borrador | `false` | Sí / No | — |
| Diplomado en metodología de la investigación | `diplomado-metodologiaInvestigacion.md` | Borrador | `false` | Sí / No | — |
| Diplomado en perspectiva de género | `diplomado-perspectivaGenero.md` | Borrador | `false` | Sí / No | — |
| Doctorado en derecho procesal y sistemas contemporáneos | `doctorado-derecho.md` | Horario/fechas vacíos; precios “Consultar”; revisar si **`requiresVerification`** debe ser `true` frente a “admisión documentada” | `true` | Sí / No | Admisión documentada (copy en `includes`) — **confirmar** documentos y si el formulario debe pedir revisión |
| Especialidad en criminalística y ciencias forenses | `especialidad-criminilastica.md` | Horario/fechas vacíos; precios “Consultar” | `true` | Sí / No | Sin verificación en YAML — ¿expediente para ingreso? |
| Maestría en derecho civil y familiar | `maestria-derechoCivil.md` | Cuatrimestres **5 y 6**: temario duplicado vs cuatrimestres anteriores — sustituir por plan oficial | `true` | Sí / No | **`requiresVerification: true`** — documentos de admisión |
| Maestría en derecho internacional, DDHH y litigio estratégico | `maestria-derechoInternacional.md` | Precios “Consultar”; campos de calendario vacíos | `true` | Sí / No | Sin verificación en YAML — alinear con proceso de admisión real |
| Maestría en derecho penal y litigación oral avanzada | `maestria-derechoPenal.md` | Precios “Consultar”; calendario vacío | `true` | Sí / No | Igual que internacional |
| Seminario selección de personal y pruebas psicométricas | `seminario-seleccion-personal-psicometricas.md` | Imagen placeholder (patrimonio); precios módulo/paquete vs **Stripe** si hay checkout | `true` | Sí / No | Sin verificación; ¿cupón/promo solo redes? |
| Taller práctico de redacción de contratos | `taller-redaccion-contratos.md` | Imagen placeholder; **`enrollmentFlow: application`** — confirmar solicitud/documentos; variantes de precio en Stripe | `true` | Sí / No | Flujo **solicitud**; confirmar si piden **documentos** antes de inscribir |

### Nota sobre “programas principales” de la tanda reciente

Los briefings **prioritarios** que se integraron con texto largo (calendario, precios o temario detallado) incluyen, entre otros: **Nuevas facultades**, **Seminario de selección y psicométricas**, **Taller de redacción de contratos** y **Diplomado Civil y Familiar**. Siguen con trabajo **paralelo** no cerrado en esta misma línea: **imágenes dedicadas**, **IDs Stripe** donde haya cobro, **maestría civil** (temario cuatrimestres finales) y **filas de la tabla** marcadas como borrador o “Consultar”. Marketing puede tachar filas conforme envíe cada pieza.
