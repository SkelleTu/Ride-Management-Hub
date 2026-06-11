import app from "./app";
import { logger } from "./lib/logger";
import { seedDefaultAccounts } from "@workspace/db/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedDefaultAccounts()
  .then(() => logger.info("Seed de contas padrão concluído"))
  .catch((err) => logger.warn({ err }, "Seed ignorado ou parcial"));

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
