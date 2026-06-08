import { buildApp } from './app';
import { getServerConfig } from './config';

const start = async () => {
  const config = getServerConfig();
  const app = await buildApp(config);

  try {
    await app.listen({
      port: config.SERVER_PORT,
      host: '0.0.0.0',
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();

