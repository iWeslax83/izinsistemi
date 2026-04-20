// models/RateLimitBucket.js
import mongoose from "mongoose";

const RateLimitBucketSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0 },
    identifiers: { type: [String], default: [] },
    windowStart: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: false }
);

export default mongoose.models.RateLimitBucket ||
  mongoose.model("RateLimitBucket", RateLimitBucketSchema);
