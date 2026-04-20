// models/AuditLog.js
import mongoose from "mongoose";

const AUDIT_TTL_SECONDS = 365 * 24 * 60 * 60;

const AuditLogSchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
      index: { expires: AUDIT_TTL_SECONDS },
    },
    actor: {
      type: String,
      enum: ["ogrenci", "ogretmen", "sistem"],
      required: true,
      index: true,
    },
    actorRef: { type: String, default: "" },
    action: { type: String, required: true, index: true },
    target: { type: mongoose.Schema.Types.ObjectId, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
    sid: { type: String, default: "", index: true },
    ua: { type: String, default: "" },
  },
  { timestamps: false }
);

AuditLogSchema.index({ at: -1 });
AuditLogSchema.index({ actor: 1, action: 1, at: -1 });

export default mongoose.models.AuditLog ||
  mongoose.model("AuditLog", AuditLogSchema);
