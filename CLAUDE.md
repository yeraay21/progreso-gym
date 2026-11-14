# Diario de Hierro — instrucciones para Claude

App web instalable (PWA) para apuntar los pesos del gimnasio desde el móvil. La usa una sola persona (Yeray), **sobre todo sin internet** dentro del gimnasio. Se publica con **GitHub Pages** desde la rama `main` en https://yeraay21.github.io/progreso-gym/

Responde y escribe la interfaz en **español**.

## Reglas que no se pueden romper

1. **Sube `VERSION` en `sw.js` en cada cambio** de cualquier archivo servido (`v1` → `v2`…). Si no, el móvil sigue sirviendo la versión antigua desde la caché. Si añades un archivo nuevo (JS, CSS, imagen, fuente), añádelo también a la lista `FILES` de `sw.js`.
2. **No pierdas los datos del usuario.** Viven solo en el `localStorage` del móvil:
   - Clave `dh-local` → `{ templates, sessions, bodyLog }` (formato abajo).
   - Clave `dh-rir` → preferencia de mostrar la columna RIR (boolean).
   - Clave `dh-backup` → fecha (`YYYY-MM-DD`) de la última copia exportada.
   No renombres estas claves ni cambies el formato de forma incompatible. Si hace falta cambiar el formato, añade una **migración** que lea el formato viejo al arrancar y lo convierta, y que siga aceptando copias de seguridad antiguas en `importData`.
3. **Todo debe funcionar sin conexión.** Nada de CDNs, Google Fonts, APIs externas ni analítica: cualquier recurso nuevo va dentro del repo y en la caché del service worker. Las fuentes están en `fonts/` (Barlow y Big Shoulders Display, woff2).
4. **Móvil primero.** Pantallas de ~360–430 px, botones grandes (≥ 40 px), inputs con `inputmode` numérico, respeta las `safe-area-inset` (notch y barra inferior). Debe verse bien en modo claro y oscuro: todos los colores salen de las variables CSS de `:root` y sus dos bloques de tema oscuro.
5. **Sin paso de compilación.** HTML + CSS + JS plano, sin frameworks ni npm, para que GitHub Pages lo sirva tal cual. Si propones introducir uno, explica antes el coste.

## Estructura

```
index.html      Toda la app: estilos, marcado y script en un solo archivo
sw.js           Service worker: caché offline (cache-first) + actualizaciones
manifest.json   Manifiesto PWA (nombre, iconos, colores)
icons/          Iconos de la app (192, 512, 512 maskable, apple-touch-icon 180)
fonts/          Fuentes locales woff2
README.md       Cómo actualizar la app
```

### Dentro de `index.html` (script)
- **utilidades**: fechas como strings `YYYY-MM-DD` (`ds`, `pd`, `addDays`, `mondayOf`), formato español (`fmtDay`, `fk` usa coma decimal), `esc` para escapar HTML (úsalo siempre al pintar texto del usuario), `lsGet`/`lsSet` con try/catch.
- **estado**: `templates`, `sessions`, `bodyLog` y el objeto `ui` (pestaña, semana, día seleccionado, ejercicio abierto, confirmaciones pendientes).
- **guardado**: `save(path, getData)` con debounce (~900 ms) → `flush` → `persistLocal()`. `flushAll()` guarda al instante cuando la app pasa a segundo plano (`visibilitychange`/`pagehide`).
  - Nota: hay restos de una versión anterior que guardaba en una base de datos en la nube (`db`, `mode`, `dirty`, rutas tipo `sessions/<fecha>`). Ahora `mode` siempre es `'local'` y todo acaba en `persistLocal()`. Se puede simplificar, con cuidado de no tocar el formato guardado.
- **catálogo e historial**: `catalog()` (todos los ejercicios conocidos), `history(id)` (sesiones de gym con ese ejercicio, por fecha; **solo cuentan las series con reps**, un kg relleno sin reps no es una serie hecha), `lastBefore(id, fecha)`, `evaluate(id, antesDe)` → estado del ejercicio. Con `antesDe` (lo usa la tarjeta del día) solo mira sesiones anteriores a esa fecha; sin él (Progreso) usa todo el historial salvo la sesión de hoy si está a medias:
  - `up` "Sube peso": en la última sesión llegó a `rmax` en todas las series objetivo con el peso máximo.
  - `stall` "Estancado": dentro de la racha de sesiones seguidas con el peso actual, la mejor suma de reps se consiguió hace ≥ 14 días y no se ha superado.
  - `prog` "Progresando", `flat` "Igual/Bajó peso/1er registro", `none` "Sin datos".
- **grupos musculares**: `GROUPS` (orden en Progreso, bíceps y tríceps primero) y `muscle(e)`: usa el campo opcional `muscle` del ejercicio (se elige en Rutina) o, si no existe, lo deduce del nombre.
- **tarjeta del día**: los kg salen rellenos con los de la última vez (`mkItem(e, fecha)`); el botón ✓ (`okset`) apunta la misma serie que la última vez; al cambiar los kg, las series siguientes sin hacer lo heredan. `goalHtml` pinta el objetivo de hoy, `better` marca la serie que supera a la de la última vez y `cmpHtml` el balance al terminar. Mientras se escribe **no se llama a `render()`**: `refreshItem(i)` actualiza esas marcas tocando el DOM directamente.
- **cambio de día**: `today` es un `let`; `syncToday()` lo actualiza al volver a la app.
- **gráfica**: `chart(points, unit)` dibuja un SVG a mano (sin librerías).
- **vistas**: `viewCalendar` + `viewDay` + `itemCard` (pestaña Calendario), `viewProgress` + `viewExercise` (Progreso), `viewRoutine` (Rutina + copia de seguridad), `viewBody` (Cuerpo). `render()` repinta todo con `innerHTML` y restaura el foco y la posición del cursor del input activo (importante para no cortar lo que el usuario escribe).
- **acciones**: un único listener de `click` por `data-act` y otro de `input`/`change` por `data-f`. Para añadir un botón nuevo: ponle `data-act="..."` y añade un `case` en el `switch`.
- **arranque**: `startLocal()` carga `dh-local`; si no existe, usa `SEED` (rutina inicial). Después registra `sw.js` y muestra el aviso "Hay una versión nueva" cuando hay un service worker esperando.

## Formato de datos (`dh-local`)

```js
{
  templates: [               // plantillas de sesión ("Pecho, tríceps y hombro", "Brazo"…)
    { id, name, exercises: [ { id, name, type: 'w' | 'cardio', sets, rmin, rmax,
                               muscle } ] }   // muscle es opcional: clave de GROUPS ('biceps', 'triceps'…)
  ],
  sessions: {                // una por día, clave = 'YYYY-MM-DD'
    '2026-11-14': {
      date, kind: 'gym' | 'cali' | 'rest', note,
      // solo si kind === 'gym':
      tplId, title,
      items: [ { id, name, type, tSets, rmin, rmax, note,
                 sets: [ { kg, reps, rir } ],           // type 'w' (valores number o null)
                 cardio: { min, incl, kmh } } ]         // type 'cardio'
    }
  },
  bodyLog: { 'YYYY-MM-DD': { date, weight, waist } }    // kg y cm
}
```

El `id` de un ejercicio es un slug del nombre y es lo que une el historial entre sesiones y plantillas: si se renombra un ejercicio, conserva su `id`.

## Cómo entrena el usuario (contexto para proponer mejoras)

- Objetivo: **hipertrofia**. Series de 8–15 reps con RIR 1–2; progresión doble (sube peso al llegar al tope de reps en todas las series).
- 5 días por semana con sesiones fijas que cambian de día según su horario: Pecho-tríceps-hombro, Espalda-bíceps, Pierna, Brazo (su prioridad), Espalda-pecho. Crunch en polea 3 días/semana y caminata inclinada en cinta al final.
- Algunos días hace **calistenia** en vez de gimnasio (solo deja una nota).
- Usa la app con el móvil en una mano entre series: lo importante es apuntar rápido y ver qué hizo la última vez.

## Antes de dar un cambio por terminado

- Comprueba que el script no tiene errores de sintaxis (por ejemplo, extrae el `<script>` y pásalo por `node --check`).
- Prueba el flujo básico: elegir una sesión en un día, apuntar kg y reps, cambiar de pestaña, recargar y ver que los datos siguen ahí.
- Sube `VERSION` en `sw.js`.
- Commits pequeños y con mensaje en español que diga qué cambia para el usuario.
