# 02 · Requerimientos no funcionales

| ID | Categoría | Requisito | Cómo se verifica |
|---|---|---|---|
| RNF-01 | Usabilidad / dispositivos | Desktop-first en v1 (≥ 1024 px). La capa de interacción y los componentes se diseñan para funcionar en mobile sin reescritura ([ADR-0008](adr/0008-interaccion-desacoplada.md)). En < 768 px, v1 muestra el juego en modo selección por toque (sin drag). | Test e2e en viewport 1280 y 390 |
| RNF-02 | Accesibilidad | WCAG 2.1 AA. El color **nunca** es el único indicador: verde/naranja/rojo llevan además ícono y texto (✓ / ~ / ✗). Todo operable por teclado. | axe en CI + auditoría manual en F6 |
| RNF-03 | Performance | LCP < 2,5 s en 4G simulado para la home y la pantalla de juego. Bundle JS inicial < 250 KB gzip (React Flow y editor YAML con carga diferida). | Lighthouse CI |
| RNF-04 | Performance | Evaluar una colocación < 50 ms en el cliente (motor puro, sin red). | Test unitario con benchmark |
| RNF-05 | Costo | **Sin recursos con costo fijo por hora** en la arquitectura base (sin NAT Gateway, ALB, RDS ni instancias). Todo pago por uso. Alarma de presupuesto AWS Budgets configurada por Terraform. | Revisión de `infra/` + checkov |
| RNF-06 | Seguridad | Cero credenciales de larga vida: CI usa OIDC; no hay IAM users con access keys. Secrets fuera del repo (gitleaks en CI). | CI |
| RNF-07 | Seguridad | Mínimo privilegio: roles separados para `plan`, `apply` y `deploy-content`; permissions boundary en el rol `apply` que impide escalar privilegios IAM. | Revisión de `infra/bootstrap` |
| RNF-08 | Seguridad | PRs desde forks se ejecutan **sin acceso a AWS ni secrets**. Prohibido `pull_request_target` con checkout del código del PR. | Revisión de workflows + zizmor/actionlint |
| RNF-09 | Seguridad | Acciones de GitHub **fijadas por SHA** y actualizadas por Dependabot. | Lint de workflows |
| RNF-10 | Seguridad web | Headers de seguridad en CloudFront (CSP estricta, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors none). S3 privado con OAC. | Test de headers post-deploy |
| RNF-11 | Seguridad API | JWT de Cognito validado en API Gateway (authorizer JWT). Validación de input con Zod en cada handler. Throttling por ruta. | Tests de contrato |
| RNF-12 | Privacidad | Datos personales mínimos: email (solo en Cognito), alias. Borrado y exportación de datos (RF-AUTH-06/07). Métricas de calibración anónimas y agregadas. Cumplir la legislación de protección de datos aplicable (p. ej. Ley 25.326 en Argentina); revisar con asesoría legal antes de abrir registros. | Revisión |
| RNF-13 | Observabilidad | Logs estructurados JSON (Powertools for AWS Lambda TypeScript), métricas de negocio (intentos, escenarios completados), trazas. Retención de logs acotada (14 días por defecto). | Revisión de `infra/` |
| RNF-14 | Mantenibilidad | TypeScript `strict` en todo el monorepo. Sin `any` explícito (lint). Zod en todas las fronteras (archivos de contenido, API, respuestas de IA). | CI |
| RNF-15 | Testeabilidad | `packages/game-engine` y `packages/content-lint` con cobertura ≥ 90 % de líneas. Tests e2e (Playwright) del flujo "jugar escenario completo". | CI |
| RNF-16 | Contribuibilidad | Setup local en < 10 minutos: `pnpm i && pnpm dev` levanta juego (modo invitado) + Studio **sin cuenta de AWS**. La IA del Studio es opcional. | Doc CONTRIBUTING + prueba en devcontainer |
| RNF-17 | Portabilidad del fork | Desplegar un fork requiere solo: bootstrap manual + variables del repo. Ningún valor de cuenta/región/dominio hardcodeado. | Guía de forks probada end-to-end |
| RNF-18 | Disponibilidad | Objetivo 99,5 % mensual (aceptable para un juego comunitario). Sin multi-región. | CloudWatch |
| RNF-19 | Escalabilidad | Soportar 10k jugadores activos mensuales sin cambios de arquitectura (DynamoDB on-demand, Lambda, CloudFront). | Prueba de carga básica en F4 |
| RNF-20 | Contenido | El juego soporta ≥ 500 escenarios sin degradar la home (índice liviano + carga de cada escenario bajo demanda). | Test con contenido sintético |
| RNF-21 | Integridad del contenido | Un escenario publicado nunca cambia de respuestas sin incrementar `version`; el progreso guarda la versión jugada. | CI (RF-CNT-07) |
| RNF-22 | Licencia | Cada archivo de código con encabezado SPDX; contenido con licencia propia ([ADR-0016](adr/0016-licenciamiento.md)). | Lint de licencias (reuse) |
