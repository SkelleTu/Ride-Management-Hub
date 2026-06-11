import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import {
  usersTable,
  driverProfilesTable,
  ridesTable,
  offersTable,
  messagesTable,
  activityLogTable,
} from "@workspace/db";
import { logger } from "./logger";

const BACKUP_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../backups",
);

const MAX_BACKUPS = 10;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

async function runBackup() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);

    const [users, driverProfiles, rides, offers, messages, activityLog] =
      await Promise.all([
        db.select().from(usersTable),
        db.select().from(driverProfilesTable),
        db.select().from(ridesTable),
        db.select().from(offersTable),
        db.select().from(messagesTable),
        db.select().from(activityLogTable),
      ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      counts: {
        users: users.length,
        driverProfiles: driverProfiles.length,
        rides: rides.length,
        offers: offers.length,
        messages: messages.length,
        activityLog: activityLog.length,
      },
      tables: {
        users,
        driverProfiles,
        rides,
        offers,
        messages,
        activityLog,
      },
    };

    const filePath = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

    // Manter apenas os últimos MAX_BACKUPS backups
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("backup_") && f.endsWith(".json"))
      .sort()
      .reverse();

    for (const old of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }

    logger.info(
      { counts: backup.counts, file: `backup_${timestamp}.json` },
      "✅ Backup automático concluído",
    );
  } catch (err) {
    logger.error({ err }, "⚠️  Falha no backup automático (dados estão seguros no banco)");
  }
}

export function startAutoBackup() {
  // Roda imediatamente ao ligar o servidor
  runBackup();

  // Roda a cada 24 horas enquanto o servidor estiver ligado
  setInterval(runBackup, INTERVAL_MS);

  logger.info("🗄️  Backup automático ativado (a cada 24h)");
}
