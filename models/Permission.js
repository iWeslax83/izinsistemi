import mongoose from "mongoose";

const PermissionSchema = new mongoose.Schema(
  {
    adSoyad: { type: String, required: true, trim: true },
    okulNo: { type: String, required: true, trim: true },
    sinif: {
      type: Number,
      required: true,
      min: 9,
      max: 12,
    },
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
      index: true,
    },
    gun: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.Permission ||
  mongoose.model("Permission", PermissionSchema);
