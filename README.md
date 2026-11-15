# Nutri-bot 🥗💪

Un asistente nutricional personal en Telegram. Le contás lo que comés y entrenás (por texto, foto o audio) y él lleva la cuenta de calorías y macros, sabe lo que tenés en la alacena y tus suplementos, y te sugiere cómo cerrar el día.

**Stack:** Telegram Bot API · Gemini (tool calling) · Supabase (Postgres) · Vercel (functions + cron) · TypeScript

```
Telegram → /api/telegram (Vercel) → Gemini + tools → Supabase
                                  ← respuesta
Vercel Cron 20:30 ART → /api/cron/cierre → "te faltan 40 g de proteína, tenés whey: 1 scoop y cerrás"
```

## Qué hace

- **Registro de comidas** en lenguaje natural ("almorcé 2 empanadas y una coca zero"). Las calorías salen de la tabla `alimentos` y no las inventa el LLM. Si un alimento no está, lo crea como `estimado_ia` y te avisa.
- **Fotos de platos y audios**: Gemini los interpreta directamente.
- **Entrenamientos**, con kcal estimadas solo como referencia (no se suman a la meta).
- **Perfil y metas**: calcula TMB y TDEE con Mifflin-St Jeor, y después las metas de macros según tu objetivo.
- **Despensa y suplementos**: "tengo en la heladera pollo, huevos, arroz y tengo whey" → lo guarda. "¿Qué como para cerrar el día?" → te arma opciones con lo que tenés.
- **Cierre automático a las 20:30**: te dice cómo vas y qué te falta.
- **Comandos**: `/hoy`, `/semana`, `/despensa`.

## Setup (≈20 min)

### 1. Bot de Telegram
1. Hablale a [@BotFather](https://t.me/BotFather) → `/newbot` → copiá el **token**.

### 2. Supabase
1. Creá un proyecto nuevo (el plan free alcanza).
2. Andá a SQL Editor y corré `supabase/001_schema.sql`, y después `supabase/002_seed_alimentos.sql`.
3. En Project Settings → API, copiá la **Project URL** y la **service_role key**. Esa key es secreta y va solo en el backend.

### 3. Gemini
1. Entrá a [Google AI Studio](https://aistudio.google.com/apikey) → **Create API key**.

### 4. Probarlo local (sin deploy)
```bash
npm install
cp .env.example .env     # completá los valores
npm run dev              # long polling: el bot ya responde desde tu compu
```
Si todavía no sabés tu chat id, poné cualquier número en `ALLOWED_CHAT_IDS` y escribile al bot. Te va a responder con tu id. Ponelo en `.env` y reiniciá.

### 5. Deploy a Vercel
```bash
npx vercel                 # linkeás el proyecto
# cargá las mismas variables del .env en Vercel → Settings → Environment Variables
npx vercel --prod
npm run webhook -- https://TU-PROYECTO.vercel.app
```
Desde ahí corre 24/7 en la nube. Ojo: `npm run dev` borra el webhook, así que si volvés a probar local, después corré `npm run webhook` de nuevo.

El cron (`vercel.json`) corre a las 23:30 UTC, que son las 20:30 en Argentina. En el plan Hobby puede dispararse con algo de demora dentro de esa hora.

## Dashboard web (`web/`)

React + Vite + Tailwind v4 + Motion. Tiene cuatro pantallas: **Hoy** (el "plato" de macros, las comidas en vivo y qué comer para cerrar el día), **Semana**, **Despensa** y **Perfil**.

```bash
cd web && npm install
VITE_DEMO=1 npm run dev      # demo con datos de ejemplo, no necesita Supabase
```

Para usarlo con tus datos reales:
1. Corré `supabase/003_web.sql` en el SQL Editor. Activa el login por mail, RLS y realtime.
2. En Supabase → Authentication → URL Configuration, poné tu dominio de Vercel como Site URL.
3. Copiá `web/.env.example` a `web/.env` con la URL y la **anon key** (la pública, no la service role).
4. En Telegram mandale al bot `/web tu@mail.com`. Después entrás al dashboard con ese mail (te llega un magic link).

En Vercel, el `vercel.json` ya buildea `web/` y lo sirve junto al bot en el mismo proyecto. Solo tenés que agregar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y, si querés, `VITE_BOT_USERNAME` en las variables de entorno.

Cuando cargás algo por Telegram, el dashboard se actualiza solo: los anillos y los números se animan desde el valor anterior.

## Estructura

```
api/telegram.ts         webhook de Telegram
api/cron/cierre.ts      recordatorio diario de cierre
lib/agente.ts           system prompt + loop de tool calling con Gemini
lib/tools.ts            declaraciones y ejecución de las tools
lib/nutricion.ts        cálculo de metas y macros
lib/resumen.ts          resúmenes diario/semanal
lib/despensa.ts         alacena, heladera y suplementos
lib/bot.ts              manejo de mensajes, comandos, fotos y audios
supabase/*.sql          schema + seed de alimentos
scripts/                polling local y set-webhook
```

## Ideas para la v2
- WhatsApp (Cloud API de Meta): reemplazar `lib/telegram.ts` por un adaptador de WhatsApp. El resto no cambia.
- Dashboard web en React leyendo de Supabase (gráficos semanales, edición de registros).
- Escaneo de código de barras con Open Food Facts.
- Multiusuario con Supabase Auth: el schema ya está keyed por `chat_id`.

> Las sugerencias del bot son orientativas y no reemplazan a un nutricionista.
