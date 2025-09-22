# TaskForge

Gestor minimalista de **proyectos y tareas**. Esta V2 incorpora **Proyectos**, **búsqueda/filtros** y **paginación**.

> Tecnologías: **React + Vite + TS**, **Node + Express + TS**, **Prisma + SQLite** (migrable a Postgres).  
> Próximas versiones: S3 (presigned), SNS (eventos), Lambda + API Gateway.

---

## Índice

- [Arquitectura](#arquitectura)
- [Estado de versiones](#estado-de-versiones)
- [Requisitos](#requisitos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Estructura del repo](#estructura-del-repo)
- [Configuración](#configuración)
- [Modelo de datos](#modelo-de-datos)
- [API (contratos)](#api-contratos)
- [UX / Frontend](#ux--frontend)
- [Rendimiento y seguridad](#rendimiento-y-seguridad)
- [Roadmap](#roadmap)
- [Changelog](#changelog)
- [Licencia](#licencia)

---

## Arquitectura

```
frontend (Vite, React Query)
       │  fetch
       ▼
backend (Express, Zod, Prisma)
       │
       ▼
 DB (SQLite en V2; Postgres/RDS en V8)

[A futuro]
- S3 (uploads con presigned URLs)
- SNS (eventos TaskCreated/Updated → emails / workers)
- Lambda + API Gateway (endpoints serverless)
- RDS Postgres + RDS Proxy (pooling)
```

---

## Estado de versiones

- **V1**: CRUD de tareas para un único “proyecto” implícito.
- **V2 (actual)**:
  - **Projects** (crear/listar)
  - **Tasks por proyecto** con **búsqueda** (`q`), **filtro de estado** (`all|pending|done`) y **paginación** (`page`, `limit`)
  - Índices en DB para `projectId`, `createdAt`, `done`, `title`.

---

## Requisitos

- **Node** ≥ 20
- **npm** ≥ 10
- **Git**

---

## Instalación y ejecución

```bash
# 1) Clonar
git clone https://github.com/MartaFagundez/taskforge
cd taskforge

# 2) Instalar dependencias (monorepo)
npm install

# 3) Backend: crear DB y levantar
cd backend
npx prisma migrate dev --name v2_projects_and_indexes
npm run dev
# http://localhost:3000/health

# 4) Frontend
cd ../frontend
npm run dev
# http://localhost:5173/
```

> Script combinado (raíz): `npm run dev` levanta front y back en paralelo.

---

## Estructura del repo

```
taskforge/
├─ backend/           # Express + TS + Prisma
│  ├─ src/
│  │  ├─ index.ts     # rutas /health, /projects, /tasks…
│  │  └─ prisma.ts    # PrismaClient
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ migrations/
│  └─ .env            # DATABASE_URL (sqlite)
├─ frontend/          # Vite + React + TS + React Query
│  └─ src/
│     ├─ App.tsx
│     └─ api.ts
└─ infra/             # (placeholder) IaC: SAM/Serverless/CDK en V5+
```

---

## Configuración

**Variables de entorno (backend/.env):**

```
DATABASE_URL="file:./dev.db"
PORT=3000
```

**CORS (backend/src/index.ts):**

- Permitido origen por defecto: `http://localhost:5173` (ajustar si cambia el front).
- Métodos usados: `GET, POST, PATCH, DELETE`.

---

## Modelo de datos

**ERD (simplificado):**

```
Project (1) ───< (N) Task

Project {
  id        Int  PK
  name      String
  createdAt DateTime
}

Task {
  id         Int  PK
  title      String
  done       Boolean (default: false)
  createdAt  DateTime
  projectId  Int  FK -> Project.id

  Indexes:
   - (projectId, createdAt)
   - (projectId, done)
   - (projectId, title)
}
```

**Prisma provider actual:** `sqlite` (fácil de migrar a `postgresql` en V8).

---

## API (contratos)

Base URL: `http://localhost:3000`

### Health

`GET /health` → `200 { ok: true, service, ts }`

### Projects

- `GET /projects` → `200 Project[]`
- `POST /projects`  
  **Body:** `{ "name": "Mi proyecto" }`  
  **Res:** `201 Project`

**cURL:**

```bash
curl -X POST http://localhost:3000/projects   -H "content-type: application/json"   -d '{"name":"Demo V2"}'
```

### Tasks

- `POST /tasks`  
  **Body:** `{ "title":"Tarea A", "projectId": 1 }` → `201 Task`
- `PATCH /tasks/:id/toggle` → `200 Task` (done ↔ not done)
- `DELETE /tasks/:id` → `204`

- `GET /projects/:id/tasks?status=all|pending|done&q=texto&page=1&limit=10`  
  **Res:** `200 { items: Task[], page, limit, total, pages }`

**Ejemplos:**

```bash
# Crear tarea
curl -X POST http://localhost:3000/tasks   -H "content-type: application/json"   -d '{"title":"Investigar Prisma","projectId":1}'

# Listar tareas (hechas) que contengan "pris" en el título, página 1, 10 por página
curl "http://localhost:3000/projects/1/tasks?status=done&q=pris&page=1&limit=10"
```

**Errores comunes:**

- `400` validación (Zod).
- `404` recurso inexistente (p.ej. toggle/delete de id inexistente).
- `500` error no controlado (registrado en logs).

---

## UX / Frontend

- **React Query** para data fetching y **optimistic updates** en crear/toggle/delete.
- **Selector de proyecto**, **búsqueda** por título, **filtro de estado**, **paginación** (10 ítems por página).
- Estilos simples inline; se prioriza claridad del flujo.

---

## Rendimiento y seguridad

- **Índices** en `Task` para consultas por proyecto/estado/fecha/título.
- **Paginación** `offset/limit` (en V7 se evaluará **keyset** si crece el dataset).
- **Validación** en backend (Zod) y códigos HTTP correctos.
- **CORS** restringido al front local.
- **Logs** con contexto por ruta (listos para integrar con CloudWatch en V5).

---

## Roadmap

- **V3**: S3 (uploads con **presigned URLs**) + `Attachment` model.
- **V4**: Eventos con **SNS** (email suscriptor).
- **V5**: **Lambda + API Gateway** (2 endpoints críticos) + observabilidad.
- **V6**: Auth JWT (roles mínimos).
- **V7**: Performance (keyset pagination, cache) + rate limiting.
- **V8**: **RDS Postgres + RDS Proxy** (pooling), Secrets Manager, IaC.

---

## Changelog

- **v2.0.0**: Proyectos, listado de tareas por proyecto con búsqueda/filtros/paginación; índices DB; UI con selector de proyecto.
- **v1.0.0**: CRUD mínimo de tareas, optimistic UI.

---

## Licencia

ISCL (Internet Systems Consortium License).
