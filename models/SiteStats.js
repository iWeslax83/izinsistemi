import mongoose from "mongoose";

const SiteStatsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.SiteStats ||
  mongoose.model("SiteStats", SiteStatsSchema);
