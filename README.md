# TaskForge

Gestor minimalista de **proyectos y tareas**. Desde **V3.x** incorpora **adjuntos por tarea con S3 (presigned URLs)** y eliminación segura de archivos.

> Tecnologías: **React + Vite + TS**, **Node + Express + TS**, **Prisma + SQLite** (migrable a Postgres).  
> Próximas versiones: SNS (eventos), Lambda + API Gateway, RDS Postgres + RDS Proxy.

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
  ├─ S3 (presigned PUT/GET para adjuntos)   ← V3.0/3.1
  ▼
DB (SQLite en V2–V3; Postgres/RDS en V8)

[A futuro]
- SNS (eventos TaskCreated/Updated → emails / workers)
- Lambda + API Gateway (endpoints serverless)
- RDS Postgres + RDS Proxy (pooling)
```

---

## Estado de versiones

- **V1**: CRUD de tareas para un único “proyecto” implícito.
- **V2**: **Projects** (crear/listar) + **Tasks por proyecto** con **búsqueda** (`q`), **filtro** (`all|pending|done`) y **paginación** (`page`, `limit`). Índices en DB.
- **V3.0**: Adjuntos por tarea con **S3 (presigned)**: subir directo, registrar metadatos, listar y descargar.
- **V3.1 (actual)**: **Eliminar** adjuntos individuales y **limpieza S3 en cascada** al borrar una Task.

---

## Requisitos

- **Node** ≥ 20
- **npm** ≥ 10
- **Git**
- (Para V3.x) **Cuenta AWS** con permisos S3 sobre un bucket privado

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
npm run dev    # http://localhost:3000/health

# 4) Frontend
cd ../frontend
npm run dev    # http://localhost:5173/
```

> Script combinado (raíz): `npm run dev` levanta front y back en paralelo.

---

## Estructura del repo

```
taskforge/
├─ backend/              # Express + TS + Prisma
│  ├─ src/
│  │  ├─ index.ts        # rutas /health, /projects, /tasks, /attachments...
│  │  ├─ prisma.ts       # PrismaClient
│  │  └─ s3.ts           # helpers S3: getUploadUrl/getDownloadUrl/delete/deleteBulk
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ migrations/
│  └─ .env               # DATABASE_URL, AWS_REGION, S3_BUCKET, etc.
├─ frontend/             # Vite + React + TS + React Query
│  └─ src/
│     ├─ App.tsx
│     └─ api.ts
└─ infra/                # (placeholder) IaC: SAM/Serverless/CDK en V5+
```

---

## Configuración

**Variables de entorno (backend/.env):**

```env
# DB (SQLite por ahora)
DATABASE_URL="file:./dev.db"

# AWS S3 (V3.x)
AWS_REGION=xxxxxxxx
AWS_ACCESS_KEY_ID=xxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxx
S3_BUCKET=xxxxxxxx
S3_UPLOAD_MAX_BYTES=5242880
S3_ALLOWED_MIME=image/png,image/jpeg,application/pdf
```

**CORS (backend/src/index.ts):**

- Origen permitido por defecto: `http://localhost:5173` (ajusta si el front cambia).
- Métodos usados: `GET, POST, PATCH, DELETE`.

**IAM mínima sugerida (para el backend):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "VisualEditor0",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<TU_BUCKET>/*"
    }
  ]
}
```

Reemplaza `<TU_BUCKET>`.

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
}

Attachment {
  id Int PK
  taskId Int FK -> Task.id  (onDelete: Cascade)
  key String        // clave en S3
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

Base URL: `http://localhost:3000`

### Health

`GET /health` → `200 { ok: true, service, ts }`

### Projects

- `GET /projects` → `200 Project[]`
- `POST /projects`
  - **Body:** `{ "name": "Mi proyecto" }`
  - **Res:** `201 Project`

### Tasks

- `POST /tasks`
  - **Body:** `{ "title":"Tarea A", "projectId": 1 }` → `201 Task`
- `PATCH /tasks/:id/toggle` → `200 Task` (done ↔ not done)
- `DELETE /tasks/:id` → `204`
  - **Comportamiento (V3.1):** antes de eliminar la Task en DB, se borran en **S3 (bulk)** todas las `key` de sus adjuntos (los registros `Attachment` caen por `onDelete: Cascade`).

- `GET /projects/:id/tasks?status=all|pending|done&q=texto&page=1&limit=10`
  - **Res:** `200 { items: Task[], page, limit, total, pages }`

### Attachments (V3.x)

- **Presign de subida**
  - `POST /attachments/presign`
  - **Body:** `{ taskId, originalName, contentType, size }`
  - **Res:** `{ bucket, key, uploadUrl, headers }`
  - **Uso:** el front hace **PUT** a `uploadUrl` con `headers` (incluye `Content-Type`), y el archivo como `body`.
- **Registrar metadatos (post-subida)**
  - `POST /attachments/register`
  - **Body:** `{ taskId, key, originalName, contentType, size }`
  - **Res:** `201 Attachment`
- **Listar adjuntos de una tarea**
  - `GET /tasks/:id/attachments` → `200 Attachment[]`
- **Presign de descarga**
  - `GET /attachments/download?key=...` → `200 { url }`
- **Eliminar adjunto (V3.1)**
  - `DELETE /attachments/:id` → `204`
  - **Comportamiento:** borra primero el objeto en **S3** y luego el registro en DB.

**Errores comunes:**

- `400` validación (Zod).
- `404` recurso inexistente (p. ej., proyecto/tarea/adjunto no encontrado, página fuera de rango).
- `502` fallo al eliminar objeto en S3 (al borrar attachment/task).
- `500` error no controlado (registrado en logs).

---

## UX / Frontend

- **React Query** para fetching y **optimistic updates** en create/toggle/delete de tareas.
- **Selector de proyecto**, **búsqueda** por título, **filtro de estado**, **paginación** (10 ítems por página).
- **Adjuntos por tarea (V3.x):**
  - Subir archivo: presign → PUT a S3 → registrar → refrescar lista.
  - Descargar: presign de descarga → abrir URL temporal.
  - Eliminar: `DELETE /attachments/:id` con confirmación.
- Estilos simples inline; se prioriza claridad del flujo.

---

## Rendimiento y seguridad

- **Índices** en `Task` para consultas por proyecto/estado/fecha/título.
- **Paginación** `offset/limit` (en V7 se evaluará **keyset** si crece el dataset).
- **Validación** con Zod y códigos HTTP correctos.
- **CORS** restringido al front local.
- **S3** (V3.x):
  - Bucket **privado** y presigned URLs de corta duración.
  - Validación de **MIME** (`S3_ALLOWED_MIME`) y **tamaño** (`S3_UPLOAD_MAX_BYTES`).
  - `key` generada en backend (evita colisiones y path traversal).
  - **Orden de borrado**: primero S3, luego DB (evita huérfanos).
  - (Futuro) Borrado masivo por proyecto antes de permitir `DELETE /projects/:id`.

---

## Roadmap

- **V4**: Eventos con **SNS** (email suscriptor).
- **V5**: **Lambda + API Gateway** (2 endpoints críticos) + observabilidad.
- **V6**: Auth JWT (roles mínimos).
- **V7**: Performance (keyset pagination, cache) + rate limiting.
- **V8**: **RDS Postgres + RDS Proxy** (pooling), Secrets Manager, IaC.

---

## Changelog

- **v3.1.0**: Eliminación de adjuntos + limpieza S3 al borrar Task (bulk), nuevos códigos de error (`502` para fallo S3).
- **v3.0.0**: Adjuntos: presigned upload/download, registro y listado.
- **v2.0.0**: Proyectos, listado de tareas por proyecto con búsqueda/filtros/paginación; índices DB; UI con selector de proyecto.
- **v1.0.0**: CRUD mínimo de tareas, optimistic UI.

---

## Licencia

ISCL (Internet Systems Consortium License).
