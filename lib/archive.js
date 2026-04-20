// lib/archive.js
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import PermissionArchive from "@/models/PermissionArchive";
import { logAction } from "@/lib/audit";

const ARCHIVE_DAYS = 180;
const BATCH_SIZE = 1000;

function cutoffKey(daysAgo = ARCHIVE_DAYS) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function runArchive() {
  const started = Date.now();
  await dbConnect();
  const cutoff = cutoffKey();

  let moved = 0;
  let lastBatch = BATCH_SIZE;

  while (lastBatch === BATCH_SIZE) {
    const batch = await Permission.find({ gun: { $lt: cutoff } })
      .sort({ gun: 1 })
      .limit(BATCH_SIZE)
      .lean();
    lastBatch = batch.length;
    if (batch.length === 0) break;

    try {
      await PermissionArchive.insertMany(batch, { ordered: false });
    } catch (e) {
      if (!e || e.code !== 11000) {
        throw e;
      }
    }

    const ids = batch.map((d) => d._id);
    const del = await Permission.deleteMany({ _id: { $in: ids } });
    moved += del.deletedCount;
  }

  const durationMs = Date.now() - started;
  logAction({
    actor: "sistem", actorRef: "cron", action: "archive_run",
    meta: { moved, cutoffDate: cutoff, durationMs },
  });

  return { moved, cutoffDate: cutoff, durationMs };
}
