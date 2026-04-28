# Shared Week Planner

Каркас сервиса совместного планирования недели. Календарь с редактируемыми событиями, страница входа, индикатор пользователя в шапке.

## Стек

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript**, ESLint
- **Tailwind CSS v4** (через `@tailwindcss/postcss`) + `tw-animate-css`
- **shadcn/ui** в стиле `base-lyra` поверх **Base UI** (`@base-ui/react`)
- **FullCalendar v6** (`@fullcalendar/react` + плагины `daygrid`, `timegrid`, `interaction`), локаль `ru`
- **Phosphor Icons**, шрифт **JetBrains Mono**

## Структура

```
app/
  (app)/              # авторизованная зона: шапка + контент
    layout.tsx        # AppHeader + <main>
    page.tsx          # главная — CalendarView
  login/              # без шапки
    page.tsx
    login-form.tsx
  layout.tsx          # root: <html lang="ru" class="dark">
  globals.css         # tailwind + shadcn neutral theme tokens

components/
  app-header.tsx      # серверная шапка (название + UserMenu)
  user-menu.tsx       # client: Avatar + DropdownMenu
  calendar-view.tsx   # client: FullCalendar (timeGridWeek по умолчанию)
  ui/                 # shadcn: button, avatar, dropdown-menu, input, label, card, separator

lib/
  mock-user.ts        # моковый пользователь + initials()
  utils.ts            # cn() (clsx + tailwind-merge)
```

## Запуск

```bash
npm install
npm run dev
```

Открыть [http://localhost:3000](http://localhost:3000). Страница входа — [/login](http://localhost:3000/login) (мок: любой submit ведёт на `/`).

## Скрипты

- `npm run dev` — dev-сервер (Turbopack)
- `npm run build` — продакшн-сборка
- `npm run start` — запуск собранного приложения
- `npm run lint` — ESLint

## Что ещё не сделано

- Реальная авторизация — сейчас моки в [lib/mock-user.ts](lib/mock-user.ts) и форма в [app/login/login-form.tsx](app/login/login-form.tsx) просто редиректит. Нужны: middleware с защитой `/`, замена `mockUser` на сессионного пользователя, server action на login.
- События календаря захардкожены в [components/calendar-view.tsx](components/calendar-view.tsx). Следующий шаг — API/server actions для CRUD и хендлеры `select` / `eventDrop` / `eventResize`.
- Шеринг календаря между пользователями (название проекта обязывает).
