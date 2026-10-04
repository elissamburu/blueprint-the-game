# Especificación de movimiento

> Viene del prototipo de Lovable (2026-10-03). Es **referencia, no código** ([ADR-0021](../adr/0021-ui-shadcn-tailwind-y-referencia-visual.md)): la implementación vive en `packages/ui`, `packages/diagram` y `apps/web`.

| Momento | Elemento | Propiedad | Duración | Delay | Curva | Movimiento reducido |
|---|---|---|---|---|---|---|
| Colocar servicio | `.placed-service` | opacity, transform (translateY −6px, scale .96→1) | 200 ms | 0 | cubic-bezier(0.22, 1, 0.36, 1) | Fundido 150 ms lineal |
| Resultado óptimo | ícono de `.slot-status` | opacity, transform (scale .6→1, overshoot ≈4 %) | 360 ms | 0 | cubic-bezier(0.34, 1.2, 0.64, 1) | Fundido 150 ms |
| Resultado aceptable | ícono de `.slot-status` | opacity, transform (scale .92→1) | 260 ms | 0 | cubic-bezier(0.22, 1, 0.36, 1) | Fundido 150 ms |
| Resultado incorrecto | `.slot-status` | opacity | 260 ms | 0 | cubic-bezier(0.22, 1, 0.36, 1) | Fundido 150 ms |
| Solución vista | `.slot-status` (`revealed`) | opacity, transform (translateY 12px) | 260 ms | 0 | cubic-bezier(0.22, 1, 0.36, 1) | Fundido 150 ms |
| Feedback: entrada | `.floating-feedback` | opacity, transform (translateY 12px→0) | 260 ms | 0 | cubic-bezier(0.22, 1, 0.36, 1) | Fundido 150 ms |
| Feedback: salida | `.floating-feedback.is-leaving` | opacity, transform (0→12px) | 200 ms | 0 | cubic-bezier(0.55, 0, 1, 0.45) | Fundido 150 ms |
| Resumen: trofeo | `.burst` | opacity, transform (scale .7→1.04→1) | 700 ms | 0 | cubic-bezier(0.22, 1, 0.36, 1) | Fundido 150 ms |
| Resumen: nueva insignia | `.badge-medal` | opacity, transform (scale .7→1.04→1) | 700 ms | 400 ms (total 1,1 s) | cubic-bezier(0.22, 1, 0.36, 1) | Fundido 150 ms |
| Resumen: confeti (10 piezas, colores suaves) | `.motion-confetti i` | opacity, transform (translate + rotate) | 1300 ms, 1 vez (prototipo: 1400 ms; ver nota) | 0–180 ms escalonado (20 ms por pieza) | cubic-bezier(0.22, 1, 0.36, 1) | No aparece |
| Barra de progreso | indicador de la barra | transform (translateX) | 400 ms | 0 | cubic-bezier(0.22, 1, 0.36, 1) | Cambio instantáneo |

El resultado (ícono + texto) está presente desde el primer cuadro: la animación nunca es la única señal. El incorrecto no usa sacudidas ni destellos.

**Ajuste respecto del prototipo**: el confeti dura 1300 ms por pieza en lugar de 1400 ms. Con el escalonado de 20 ms, la última pieza arranca a los 180 ms y termina a los 1,48 s, así el conjunto queda dentro del límite de 1,5 s. `motion.css.txt` conserva el valor original del prototipo.
