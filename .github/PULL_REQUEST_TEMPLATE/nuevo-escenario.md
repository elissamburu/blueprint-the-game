<!--
Plantilla para PR de escenarios (RF-CNT-05). Título del PR en Conventional Commits, por ejemplo:
feat(content): add scenario <id>
Reglas completas en docs/03-modelo-de-escenarios.md y en CLAUDE.md (reglas de contenido).
-->

## Resumen

- **id**:
- **Título**:
- **Nivel**: <!-- 0, 100, 200, 300 o 400 -->
- **Áreas**:
- **Estado**: <!-- draft, beta o published -->

## Checklist

- [ ] Los objetivos son claros, cada uno es `hard` o `soft`, y cada `optimal`/`acceptable` está vinculado a 1 objetivo o más.
- [ ] Ningún rol, contexto ni pista nombra un servicio oculto (L005 sin errores).
- [ ] Todo dato de AWS tiene su referencia oficial; lo que no pude verificar quedó como `TODO(verificar)` y el escenario no pasa de `beta`.
- [ ] `pnpm content:validate` corre sin errores y `pnpm content:gen --check` está al día.
- [ ] Lo jugué de punta a punta en el preview del Studio.
- [ ] Si cambian respuestas o grados de un escenario `published`, subí `version` (L014). <!-- Si no aplica, tachalo: ~~ítem~~ -->
- [ ] No hay credenciales, account IDs, ARNs reales ni datos personales en el YAML ni en `notes.md`.

## Solo nivel 0

<!-- Borrá esta sección si el escenario no es de nivel 0. -->

- [ ] Revisé cada analogía y su "dónde se rompe" contra la referencia oficial (RF-CNT-09).

## Notas para revisión

<!-- Dudas, decisiones de calibración, datos marcados como TODO(verificar), lo que quieras que mire quien revisa. -->
