# Cómo contribuir

¡Gracias por sumarte! Este documento explica cómo preparar el entorno, cómo trabajar con ramas y PRs, y qué verifica el CI. Antes de contribuir, leé [CLAUDE.md](CLAUDE.md) (reglas de arquitectura y de contenido, que valen también para humanos) y, si vas a escribir escenarios, el [modelo de escenarios](docs/03-modelo-de-escenarios.md).

Al contribuir aceptás que tu aporte se publique bajo las licencias del proyecto: PolyForm Noncommercial 1.0.0 para el código y CC BY-NC-SA 4.0 para `content/` y `docs/` ([ADR-0016](docs/adr/0016-licenciamiento.md)).

## Preparar el entorno

Necesitás Git, Node.js (la versión está en [.nvmrc](.nvmrc)) y pnpm (la versión está fijada en `packageManager` de [package.json](package.json)). Recomendamos [fnm](https://github.com/Schniz/fnm) para Node y Corepack para pnpm.

### Windows (PowerShell)

```powershell
winget install Schniz.fnm
# Activar fnm en cada sesión (agregarlo al perfil de PowerShell):
Add-Content $PROFILE 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
. $PROFILE

git clone https://github.com/<tu-usuario>/<tu-fork>.git
cd <tu-fork>
fnm install      # instala la versión de .nvmrc
fnm use
corepack enable  # habilita pnpm en la versión de packageManager
pnpm i
```

### Linux / macOS

```bash
curl -fsSL https://fnm.vercel.app/install | bash   # o: brew install fnm
# Seguí las instrucciones del instalador para agregar `eval "$(fnm env --use-on-cd)"` a tu shell.

git clone https://github.com/<tu-usuario>/<tu-fork>.git
cd <tu-fork>
fnm install
fnm use
corepack enable
pnpm i
```

Para verificar el entorno, corré los mismos checks que el CI (ver [más abajo](#qué-verifica-el-ci)).

## Flujo de ramas

Usamos GitHub Flow con squash merge ([ADR-0020](docs/adr/0020-modelo-de-branching.md)):

1. Creá una rama corta desde `main` actualizado, una por tarea, con uno de estos prefijos: `feat/`, `fix/`, `content/`, `docs/`, `infra/`, `chore/`. Ejemplo: `content/escenario-colas-sqs`.
2. Hacé commits chicos con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) y sign-off (ver [DCO](#firmar-los-commits-dco)).
3. Abrí un PR contra `main`. El **título del PR** sigue Conventional Commits (`feat(game-engine): …`, `docs: …`), porque al mergear con squash se convierte en el mensaje del commit. En la descripción indicá qué RF implementa, qué ADR aplica y cómo lo probaste.
4. Un PR por tarea: no mezcles alcances.
5. Un mantenedor revisa y mergea. La rama se borra automáticamente al mergear.

`main` está protegida: no admite push directo ni force push, exige historial lineal y el check `ci` en verde.

## Firmar los commits (DCO)

Cada commit tiene que llevar la línea `Signed-off-by`, con la que certificás el [Developer Certificate of Origin](https://developercertificate.org/): que tenés derecho a enviar ese aporte bajo la licencia del proyecto. No hay CLA.

```bash
git commit -s -m "feat(catalog): add SQS service entry"
```

El nombre y el email de la firma salen de `git config user.name` y `git config user.email`. Si te olvidaste de firmar:

```bash
git commit --amend -s --no-edit        # el último commit
git rebase --signoff origin/main       # todos los commits de la rama
git push --force-with-lease
```

## Qué verifica el CI

El workflow [ci.yml](.github/workflows/ci.yml) corre en cada PR contra `main`, en Ubuntu y Windows, sin credenciales ([ADR-0015](docs/adr/0015-ci-para-prs-de-forks.md)):

| Paso | Comando |
|---|---|
| Formato | `pnpm format:check` |
| Lint | `pnpm lint` |
| Límites entre paquetes | `pnpm deps:check` |
| Tipos | `pnpm typecheck` |
| Tests | `pnpm test` |
| Build | `pnpm build` |

Además, el job `e2e` corre las pruebas de punta a punta (`pnpm e2e`) en Ubuntu. El job `ci` agrupa el resultado de ambos sistemas operativos y del `e2e`, y es el check requerido para mergear. Podés correr todo localmente antes de abrir el PR:

```bash
pnpm format:check && pnpm lint && pnpm deps:check && pnpm typecheck && pnpm test && pnpm build
```

(En PowerShell 7 `&&` funciona igual.)

## Pruebas de punta a punta (e2e)

Las pruebas de [apps/web/e2e](apps/web/e2e) manejan el juego en un navegador real con [Playwright](https://playwright.dev/) y corren [axe](https://github.com/dequelabs/axe-core) sobre las pantallas principales ([accesibilidad, §7](docs/accesibilidad.md#7-protocolo-de-pruebas)). Funcionan igual en Windows (PowerShell), Linux y macOS.

La primera vez, instalá el navegador que usa Playwright (se descarga una sola vez por versión, fuera del repo):

```bash
pnpm --filter @blueprint/web exec playwright install chromium
```

En Linux, si faltan librerías del sistema, agregá `--with-deps`.

Después, desde la raíz:

```bash
pnpm e2e                                   # toda la suite
pnpm e2e --project=fixture                 # solo los recorridos y axe sobre el escenario de prueba
pnpm e2e --project=content                 # solo el contenido real
pnpm e2e keyboard                          # solo los archivos cuyo nombre contiene "keyboard"
pnpm e2e --ui                              # modo interactivo de Playwright
```

`pnpm e2e` genera los bundles de contenido, compila el juego y levanta solo los dos servidores que necesita (no hace falta tener `pnpm dev` corriendo):

- **`fixture`**: el build de producción con un escenario de prueba fijo ([apps/web/e2e/fixtures/content](apps/web/e2e/fixtures/content), que no forma parte de `content/`). Ahí corren los recorridos del MVP, las preferencias del sistema emuladas, los tamaños de texto y axe.
- **`content`**: el servidor de desarrollo con `content/` completo, borradores incluidos. Por cada escenario coloca en cada casillero el óptimo que lee del propio contenido y verifica que queda en verde y que el resumen da el puntaje máximo. Si agregás o cambiás un escenario, esta prueba lo cubre sin tocar nada.

Si una prueba falla, `pnpm --filter @blueprint/web exec playwright show-report` abre el reporte con la traza de cada paso. En el CI el reporte se sube como artefacto (`playwright-report`) solo cuando falla.

Al escribir pruebas, buscá los elementos por rol y nombre accesible (`getByRole`, `getByLabel`), nunca por clases CSS: así la prueba también verifica lo que encuentra un lector de pantalla. Si cambiás el escenario de prueba, regenerá sus archivos con `pnpm content:gen --content apps/web/e2e/fixtures/content`.
