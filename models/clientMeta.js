import mongoose from "mongoose";

// Shared forensic request metadata captured on a permission request.
// Embedded by both Permission and PermissionArchive.
const ClientMetaSchema = new mongoose.Schema(
  {
    ip: String,
    ua: String,
    sid: String,
    acceptLanguage: String,
    referer: String,
    origin: String,
    forwardedFor: String,
    realIp: String,
    cfIp: String,
    cfCountry: String,
    secChUa: String,
    secChUaPlatform: String,
    secChUaMobile: String,
    dnt: String,
  },
  { _id: false }
);

export default ClientMetaSchema;
