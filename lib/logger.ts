import pino from 'pino';
import os from 'os';
import path from 'path';

const level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

const mainTransport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      options: { destination: path.join(os.tmpdir(), 'plasmid.log'), append: true },
      level,
    },
    {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: "yyyy-mm-dd'T'HH:MM:sso" },
      level,
    },
  ],
})

const workerTransport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      options: { destination: path.join(os.tmpdir(), 'timer.log'), append: true },
      level,
    },
    {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: "yyyy-mm-dd'T'HH:MM:sso" },
      level,
    },
  ],
})

const businessTransport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      options: { destination: path.join(os.tmpdir(), 'business.log'), append: true },
      level,
    },
    {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: "yyyy-mm-dd'T'HH:MM:sso" },
      level,
    },
  ],
})

export const mainLogger = pino({
  name: 'plasmid-main',
}, mainTransport);

export const workerLogger = pino({
  name: 'plasmid-worker',
}, workerTransport);

export const businessLogger = pino({
  name: 'plasmid-business',
}, businessTransport);
