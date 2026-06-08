// models/PermissionArchive.js
import mongoose from "mongoose";
import ClientMetaSchema from "./clientMeta.js";

const PermissionArchiveSchema = new mongoose.Schema(
  {
    adSoyad: { type: String, required: true, trim: true },
    okulNo: { type: String, required: true, trim: true, index: true },
    sinif: { type: Number, required: true, min: 9, max: 12 },
    sube: {
      type: String,
      required: true,
      enum: ["A", "B", "C", "D"],
    },
    baslangicDersi: { type: Number, required: true, min: 1, max: 10 },
    bitisDersi: { type: Number, required: true, min: 1, max: 10 },
    neden: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["beklemede", "approved"],
      default: "beklemede",
    },
    gun: { type: String, required: true, index: true },
    meta: { type: ClientMetaSchema, default: undefined },
  },
  { timestamps: true }
);

export default mongoose.models.PermissionArchive ||
  mongoose.model("PermissionArchive", PermissionArchiveSchema);
