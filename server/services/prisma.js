const { PrismaClient } = require('@prisma/client/edge');
const { withAccelerate } = require('@prisma/extension-accelerate');

let prisma;

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  }).$extends(withAccelerate());
}

function getPrismaClient() {
  if (!prisma) {
    prisma = createPrismaClient();
  }
  return prisma;
}

function getPrismaClientOrNull() {
  try {
    return getPrismaClient();
  } catch (error) {
    console.error('❌ [Prisma] PrismaClient 초기화 실패:', error.message);
    return null;
  }
}

module.exports = { getPrismaClient, getPrismaClientOrNull };
