# TaskForge

Gestor minimalista de **proyectos y tareas** desarrollado con enfoque iterativo.

> Tecnologías: **React + Vite + TS**, **Tailwind v4**, **React Query** · **Node + Express + TS**, **Zod**, **Prisma** (SQLite; migrable a Postgres) · **AWS S3** (presigned) · **AWS SNS** (eventos).  
> Próximas versiones: **Lambda + API Gateway** (V5), **RDS Postgres + RDS Proxy** (V8).

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
- [Eventos (SNS)](#eventos-sns)
- [UX / Frontend](#ux--frontend)
- [Rendimiento y seguridad](#rendimiento-y-seguridad)
- [Roadmap](#roadmap)
- [Changelog](#changelog)
- [Licencia](#licencia)

---

## Arquitectura

```
frontend (Vite, React, Tailwind v4, React Query)
    │ fetch
    ▼
backend (Express, Zod, Prisma) ← V3.2 modularizado en capas (routes/controllers/services/schemas)
    │
    ├─ S3 (presigned PUT/GET/DELETE para adjuntos) ← V3.0–V3.1
    └─ SNS (publish de eventos: TaskCreated/Updated/Deleted, AttachmentAdded/Deleted) ← V4.0

[Próximas]
- API Gateway + Lambda (V5) para endpoints stateless (health/presign...)
- RDS Postgres + RDS Proxy (V8)
```

---

## Estado de versiones

- **V1**: CRUD de tareas para un único “proyecto” implícito.
- **V2**: **Projects** (crear/listar) + **Tasks por proyecto** con **búsqueda** (`q`), **filtro** (`all|pending|done`) y **paginación** (`page`, `limit`).
- **V3.0**: Adjuntos con **S3 (presigned)**: subir, registrar, listar, descargar.
- **V3.1**: **Eliminar adjuntos** individuales + **limpieza S3 en cascada** al borrar una Task.
- **V3.2**: **Backend modularizado** (app/server, routes, controllers, services, schemas, middlewares).
- **V3.3**: **Tailwind v4** + **refactor UI** a **componentes** y **hooks**.
- **V4.0**: **Eventos con SNS** en creación/actualización/borrado de tareas y adjuntos (fire‑and‑forget, tolerante a fallos).

---

## Requisitos

- **Node** ≥ 20
- **npm** ≥ 10
- **Git**
- **Cuenta AWS** (S3 para V3.x; SNS para V4.0)
- (opcional para V5) Permisos para **CloudFormation/Lambda/API Gateway** si despliegas con Serverless Framework

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
npm run dev        # http://localhost:3000/health

# 4) Frontend (Vite + Tailwind v4)
cd ../frontend
npm run dev        # http://localhost:5173/
```

> Script combinado (raíz): `npm run dev` levanta front y back en paralelo.

---

## Estructura del repo

```
taskforge/
├─ backend/                # Express + TS + Prisma (V3.2 modular)
│  ├─ src/
│  │  ├─ app.ts            # crea app, CORS/JSON, monta rutas
│  │  ├─ server.ts         # levanta el servidor
│  │  ├─ routes/           # health, projects, tasks, attachments
│  │  ├─ controllers/      # orquestación + validaciones
│  │  ├─ services/         # Prisma/S3/SNS "puro"
│  │  ├─ schemas/          # Zod schemas (CreateTask, ListTasksQuery, etc.)
│  │  ├─ middlewares/      # error handler, correlation id (opcional)
│  │  └─ lib/
│  │     ├─ prisma.ts      # PrismaClient
│  │     ├─ s3.ts          # helpers S3: presigned, delete, deleteBulk
│  │     └─ sns.ts         # publishEvent(_Safe) a SNS (V4.0)
│  └─ prisma/
│     ├─ schema.prisma
│     └─ migrations/
│
├─ frontend/               # Vite + React + TS + Tailwind v4 + React Query (V3.3)
│  └─ src/
│     ├─ pages/TasksPage.tsx
│     ├─ components/ (ProjectSelect, FiltersBar, TaskList, TaskItem, AttachmentWidget)
│     ├─ hooks/ (useProjects, useTasks, useAttachments)
│     ├─ api/ (client, projects, tasks, attachments)
│     ├─ types/
│     ├─ App.tsx
│     └─ index.css         # `@import "tailwindcss";` + utilidades
│
└─ infra/                  # (placeholder) IaC para V5+
```

---

## Configuración

**Variables de entorno (backend/.env):**

```env
# DB (SQLite por ahora)
DATABASE_URL="file:./dev.db"
PORT=3000
CORS_ORIGIN=http://localhost:5173

# AWS S3 & SNS
AWS_REGION=xxxxxxxx
AWS_ACCESS_KEY_ID=xxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxx
S3_BUCKET=xxxxxxxx
S3_UPLOAD_MAX_BYTES=5242880
S3_ALLOWED_MIME=image/png,image/jpeg,application/pdf
SNS_TOPIC_ARN=arn:aws:sns:<your_region>:<your_account_id>:<your_topic_name>
```

**CORS**

- Origen por defecto: `http://localhost:5173`
- Métodos: `GET, POST, PATCH, DELETE`

**IAM mínima sugerida (backend):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ObjectOps",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::<S3_BUCKET>/*"
    },
    {
      "Sid": "AllowPublishToTaskforgeTopic",
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "arn:aws:sns:<your_region>:<your_account_id>:<your_topic_name>"
    }
  ]
}
```

---

## Modelo de datos

**ERD (simplificado):**

```
Project (1) ───< (N) Task (1) ───< (N) Attachment

Project {
  id Int PK
  name String
  createdAt DateTime
}

Task {
  id Int PK
  title String
  done Boolean (default: false)
  createdAt DateTime
  projectId Int FK -> Project.id

  Indexes:
  - (projectId, createdAt)
  - (projectId, done)
  - (projectId, title)

  attachments Attachment[]
}

Attachment {
  id Int PK
  taskId Int FK -> Task.id (onDelete: Cascade)
  key String   // clave en S3
  originalName String
  contentType String
  size Int
  createdAt DateTime

  Indexes:
  - (taskId, createdAt)
}
```

**Provider Prisma actual:** `sqlite` (migrable a `postgresql` en V8).

---

## API (contratos)

Base URL local (Express): `http://localhost:3000`

### Health

- `GET /health` → `200 { ok: true, service, ts }`

### Projects

- `GET /projects` → `200 Project[]`
- `POST /projects` → **Body** `{ "name": "Mi proyecto" }` → **201** `Project`

### Tasks

- `POST /tasks` → **Body** `{ "title":"Tarea A", "projectId": 1 }` → **201** `Task`
- `PATCH /tasks/:id/toggle` → **200** `Task` (done ↔ not done)
- `DELETE /tasks/:id` → **204`**  
  **Comportamiento (V3.1):** antes de eliminar en DB, se borran en **S3 (bulk)** las `key` de adjuntos; los registros `Attachment` caen por `onDelete: Cascade`.
- `GET /projects/:id/tasks?status=all|pending|done&q=texto&page=1&limit=10` → **200** `{ items, page, limit, total, pages }`

### Attachments (V3.x)

- **Presign de subida**  
  `POST /attachments/presign` → **Body** `{ taskId, originalName, contentType, size }` → **Res** `{ bucket, key, uploadUrl, headers }`  
  _Uso:_ el front hace **PUT** a `uploadUrl` con `headers` (incluye `Content-Type`), y el archivo como cuerpo.
- **Registrar metadatos (post‑subida)**  
  `POST /attachments/register` → **201** `Attachment`
- **Listar adjuntos de una tarea**  
  `GET /tasks/:id/attachments` → **200** `Attachment[]`
- **Presign de descarga**  
  `GET /attachments/download?key=...` → **200** `{ url }`
- **Eliminar adjunto (V3.1)**  
  `DELETE /attachments/:id` → **204**  
  _Orden:_ primero S3, luego DB.

**Errores comunes:**  
`400` validación (Zod) · `404` recurso/página inexistente · `502` fallo al borrar objeto en S3 · `500` error no controlado (logeado).

---

## Eventos (SNS)

En **V4.0** el backend publica **eventos** de forma **no bloqueante** (fire‑and‑forget). Si `SNS_TOPIC_ARN` no está configurado, el publish se omite y se **loguea**.

- **TaskCreated** `{ id, title, projectId, done, createdAt, cid? }`
- **TaskUpdated** `{ id, done, projectId, updatedAt, cid? }`
- **TaskDeleted** `{ id, deletedAt, cid? }`
- **AttachmentAdded** `{ id, taskId, key, originalName, size, createdAt, cid? }`
- **AttachmentDeleted** `{ id, deletedAt, cid? }`

> **Correlation ID (`cid`)**: middleware opcional añade `cid` a `req` y se propaga en `MessageAttributes` y payload para trazabilidad en logs/consumidores.

---

## UX / Frontend

- **React Query** para fetching y **optimistic updates** (create/toggle/delete).
- **Tailwind v4** integrado con Vite (plugin `@tailwindcss/vite`, `@import "tailwindcss";`).
- Componentización (V3.3): `ProjectSelect`, `FiltersBar`, `TaskList`, `TaskItem`, `AttachmentWidget`.
- **Flujos de adjuntos**: presign → PUT a S3 → registrar → refrescar lista; descarga con presign; delete con confirmación.

---

## Rendimiento y seguridad

- **Índices** en `Task` para consultas por proyecto/estado/fecha/título.
- **Paginación** `offset/limit` (en V7 se evaluará **keyset** si crece el dataset).
- **Validación** con Zod y códigos HTTP correctos.
- **CORS** restringido al front local.
- **S3**: bucket **privado**, presigned URLs de caducidad corta; whitelist de **MIME** (`S3_ALLOWED_MIME`) y **tamaño** (`S3_UPLOAD_MAX_BYTES`); `key` generada en backend; **orden de borrado**: primero S3, luego DB.
- **SNS**: publicación **tolerante a fallos** (publish seguro), `MessageAttributes` para `event` y `cid`.

---

## Roadmap

- **V5**: **Lambda + API Gateway** (2 endpoints stateless) + observabilidad.
- **V6**: Auth JWT (roles mínimos).
- **V7**: Performance (keyset pagination, cache) + rate limiting.
- **V8**: **RDS Postgres + RDS Proxy**, Secrets Manager, IaC.

---

## Changelog

- **v4.0.0**: **SNS events** (TaskCreated/Updated/Deleted, AttachmentAdded/Deleted), publish seguro, soporte `cid`.
- **v3.3.0**: **Tailwind v4** + **UI refactor** (componentes y hooks).
- **v3.2.0**: **Backend modularizado** (app/server, routes, controllers, services, schemas).
- **v3.1.0**: Eliminar adjuntos + limpieza S3 al borrar Task (bulk), códigos `502` en fallo S3.
- **v3.0.0**: Adjuntos: presigned upload/download, registro y listado.
- **v2.0.0**: Proyectos, listado de tareas por proyecto con búsqueda/filtros/paginación; índices DB; UI con selector de proyecto.
- **v1.0.0**: CRUD mínimo de tareas, optimistic UI.

---

## Licencia

ISCL (Internet Systems Consortium License).
