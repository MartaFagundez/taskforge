import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🔄 Clearing existing data...');
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();

  console.log('📦 Creating projects...');
  const [general, webApp] = await Promise.all([
    prisma.project.create({ data: { name: 'General' } }),
    prisma.project.create({ data: { name: 'Web App' } }),
  ]);

  const projects = [general, webApp];

  console.log('📝 Creating tasks...');
  const titles = [
    'Configurar entorno',
    'Diseñar UI inicial',
    'Escribir endpoints básicos',
    'Configurar CORS',
    'Agregar validación con Zod',
    'Crear paginación',
    'Implementar búsqueda',
    'Optimistic updates en front',
    'Escribir README',
    'Preparar demo',
  ];

  const tasksData = [];
  for (const p of projects) {
    for (let i = 0; i < 20; i++) {
      const t = titles[i % titles.length];
      tasksData.push({
        title: `${t} #${i + 1} (${p.name})`,
        done: i % 2 === 0,
        createdAt: new Date(Date.now() - randInt(0, 1000 * 60 * 60 * 24 * 7)), // últimos 7 días
        projectId: p.id,
      });
    }
  }

  await prisma.task.createMany({ data: tasksData });
  const count = await prisma.task.count();

  console.log(`✅ Seed listo: ${projects.length} proyectos, ${count} tareas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
