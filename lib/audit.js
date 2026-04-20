// lib/audit.js
import { dbConnect } from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";

export function logAction({
  actor,
  actorRef = "",
  action,
  target = null,
  meta = {},
  ip = "",
  sid = "",
  ua = "",
}) {
  (async () => {
    try {
      await dbConnect();
      await AuditLog.create({
        actor,
        actorRef,
        action,
        target,
        meta,
        ip,
        sid,
        ua,
      });
    } catch (e) {
      console.error("audit log yazılamadı", action, e.message);
    }
  })();
}
