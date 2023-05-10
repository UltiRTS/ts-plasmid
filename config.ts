export const selfIP = '127.0.0.1';
export const dbType = 'mysql';
export const dbconf = {
  host: process.env.PLASMID_DB_HOST ?? '127.0.0.1',
  user: process.env.PLASMID_DB_USER ?? 'chan',
  password: process.env.PLASMID_DB_PASSWORD ?? 'Diy.2002',
  database: process.env.PLASMID_DB_NAME ?? 'plasmid',
  port: parseInt(process.env.PLASMID_DB_PORT ?? '3306'),
};

export const redisConf = {
  host: process.env.PLASMID_REDIS_HOST ?? '127.0.0.1',
  port: process.env.PLASMID_REDIS_PORT ?? '6379',
};

export const dntpAddr = 'http://144.126.145.172:3000';
