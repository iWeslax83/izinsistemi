import mongoose from "mongoose";

const RosterSchema = new mongoose.Schema(
  {
    adSoyad: { type: String, required: true, trim: true, maxlength: 100 },
    okulNo: { type: String, required: true, trim: true, unique: true },
    sinif: { type: Number, required: true, min: 9, max: 12 },
    sube: { type: String, required: true, enum: ["A", "B", "C", "D"] },
    okulYili: { type: Number, required: true },
  },
  { timestamps: true }
);

RosterSchema.index(
  { adSoyad: 1 },
  { collation: { locale: "tr", strength: 2 } }
);

export default mongoose.models.Roster || mongoose.model("Roster", RosterSchema);
