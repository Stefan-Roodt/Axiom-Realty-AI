import fs from "fs";
import path from "path";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pruneBackups(backupDir, prefix, maxBackups) {
  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => {
      const fullPath = path.join(backupDir, name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const file of files.slice(maxBackups)) {
    try {
      fs.unlinkSync(file.fullPath);
    } catch {
      // Backup cleanup is best effort.
    }
  }
}

export function writeJsonFile(filePath, value, { backupDir = null, maxBackups = 10 } = {}) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  if (backupDir && fs.existsSync(filePath)) {
    ensureDir(backupDir);
    const baseName = path.basename(filePath, ".json");
    const backupPath = path.join(backupDir, `${baseName}.${timestampForFile()}.json`);
    fs.copyFileSync(filePath, backupPath);
    pruneBackups(backupDir, `${baseName}.`, maxBackups);
  }

  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

export function canWriteDirectory(dir) {
  try {
    ensureDir(dir);
    const probe = path.join(dir, `.write-test-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
