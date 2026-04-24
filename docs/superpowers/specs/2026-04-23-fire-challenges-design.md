# FIRE Challenges — Design Spec
**Date:** 2026-04-23  
**Status:** Approved

## Objetivo

Agregar un sistema de retos diarios y semanales al FIRE Planner para motivar al usuario a tomar acciones concretas que aceleren su fecha de independencia financiera. El sistema combina gamificación (puntos, niveles, insignias) con impacto real en el simulador.

---

## Layout

Panel completo debajo del simulador FIRE existente. No modifica la estructura actual del planner (sliders + gráfico). El usuario llega al panel al hacer scroll hacia abajo.

---

## Tipos de reto

### Diarios (se renuevan a medianoche cada día)
| ID | Tipo | Descripción | Puntos |
|----|------|-------------|--------|
| `daily_visit` | AUTO | Visitaste el FIRE Planner hoy | +10 |
| `daily_ahorro_up` | AUTO | Subiste el ahorro mensual $100+ (detectado por slider) | +25 |
| `daily_no_impulse` | MANUAL | Evitaste una compra impulsiva | +15 |
| `daily_cocina` | MANUAL | Cocinaste en casa hoy | +10 |
| `daily_gastos` | MANUAL | Revisaste tus gastos del día | +10 |

### Semanales (lunes a domingo)
| ID | Tipo | Descripción | Puntos |
|----|------|-------------|--------|
| `week_ahorro_5pct` | AUTO | Subiste la tasa de ahorro 5%+ (slider) | +50 |
| `week_gasto_down` | AUTO | Redujiste el gasto mensual FIRE (slider) | +40 |
| `week_cancelar_sub` | MANUAL | Cancelaste una suscripción | +60 |
| `week_transferencia` | MANUAL | Transferiste dinero a inversiones | +75 |
| `week_leer_fire` | MANUAL | Leíste sobre FIRE 15 minutos | +30 |

**Auto-detección:** Los retos tipo `AUTO` se marcan solos cuando el usuario mueve los sliders durante la sesión. Se guarda el valor inicial de cada slider al montar el componente (`useRef`) y se compara con el valor actual en cada cambio. Si el delta supera el umbral (ej: ahorro +$100), el reto se dispara una sola vez por sesión.

**Impacto en simulador:** Al completar un reto AUTO de slider, se muestra un mensaje "Tu fecha FIRE se adelantó N meses 🎯" calculado en tiempo real.

---

## Sistema de puntos y niveles

| Nivel | Rango | Ícono |
|-------|-------|-------|
| STARTER | 0 – 99 pts | 🌱 |
| SILVER | 100 – 499 pts | 🥈 |
| GOLD | 500 – 999 pts | 🥇 |
| DIAMOND | 1000+ pts | 💎 |

---

## Badges desbloqueables

| Badge | Condición |
|-------|-----------|
| ⚡ Primer paso | Completar el primer reto |
| 🔥 On Fire | 7 días seguidos con al menos 1 reto diario |
| 💰 Centenario | Acumular 100 puntos |
| ✂️ Recortador | Completar `week_cancelar_sub` 3 veces |
| 🎯 FIRE Ready | Completar todos los retos de una semana |
| 🥈 Silver Trader | Alcanzar nivel SILVER |
| 🥇 Gold Trader | Alcanzar nivel GOLD |
| 💎 Diamond Trader | Alcanzar nivel DIAMOND |
| 🔥🔥 Imparable | 30 días seguidos |
| 📅 Consistente | Completar retos semanales 4 semanas seguidas |
| 💸 Ahorrador Elite | Completar `daily_ahorro_up` 10 veces |
| 🚀 FIRE Accelerator | Adelantar fecha FIRE 1 año via retos |

---

## Base de datos (Supabase)

### `fire_progress`
```sql
CREATE TABLE fire_progress (
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  points        int DEFAULT 0,
  level         text DEFAULT 'STARTER',
  streak_days   int DEFAULT 0,
  streak_weeks  int DEFAULT 0,
  last_daily_at date,
  last_weekly_at date,
  updated_at    timestamptz DEFAULT now()
);
```
RLS: usuario solo ve y modifica su propio registro.

### `fire_completions`
```sql
CREATE TABLE fire_completions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge_id   text NOT NULL,
  challenge_type text NOT NULL CHECK (challenge_type IN ('daily','weekly')),
  completed_at   timestamptz DEFAULT now(),
  points_earned  int NOT NULL,
  day_date       date,     -- para diarios: la fecha del día
  week_number    int,      -- para semanales: ISO week number
  week_year      int       -- año de la semana ISO
);
```
RLS: usuario solo ve sus propias completions.

### `fire_badges`
```sql
CREATE TABLE fire_badges (
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id  text NOT NULL,
  earned_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);
```
RLS: usuario solo ve sus propios badges.

---

## Componentes a crear

### `app/(dashboard)/fire/FireChallenges.tsx`
Componente principal del panel. Recibe los parámetros actuales del simulador (capital, ahorro, gasto, retorno) como props para detectar cambios de slider.

**Secciones internas:**
- `ChallengeStats` — fila superior con puntos, racha, progreso semanal, próximo badge
- `ChallengeTabs` — tabs: Diarios / Semanales / Insignias
- `ChallengeCard` — card individual de reto (estado: pendiente / completado / expirado)
- `BadgeGrid` — grid de insignias desbloqueadas y bloqueadas

### `app/api/fire-challenges/route.ts`
- `GET` — devuelve progress + completions del día/semana actual + badges del usuario
- `POST` — marca un reto como completado, actualiza puntos, verifica y otorga badges, recalcula nivel

---

## Flujo de datos

1. Usuario entra a `/fire` → se carga `FireChallenges` → llama `GET /api/fire-challenges`
2. API devuelve: `{ progress, todayCompletions, weekCompletions, badges }`
3. Reto `daily_visit` se marca automáticamente si no está completado hoy
4. Usuario mueve slider de ahorro → componente detecta delta ≥ $100 → llama `POST /api/fire-challenges` con `challenge_id: 'daily_ahorro_up'`
5. Usuario clickea "MARCAR ✓" en reto manual → llama `POST /api/fire-challenges`
6. API: inserta en `fire_completions`, suma puntos en `fire_progress`, evalúa badges, devuelve estado actualizado
7. UI actualiza en tiempo real sin reload

---

## Decisiones de diseño

- **Catálogo hardcodeado en código**: más fácil de mantener que en DB; cambios de retos se hacen con un deploy.
- **Auto-detección por slider**: se usa `useRef` para capturar el valor de los sliders al montar el componente. En cada cambio se calcula el delta. Si supera el umbral, se llama a la API una sola vez por sesión (flag en estado local).
- **No se puede completar el mismo reto dos veces el mismo día/semana**: la API verifica existencia en `fire_completions` antes de insertar.
- **Racha**: se rompe si no hay ningún reto diario completado en un día calendario. Se calcula en el GET comparando `last_daily_at` con `today`.
