export const hasDb = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
