import { findAcrossCollections } from "@/lib/permissionQuery";
import { todayKey } from "@/lib/date";
import StudentPage from "./StudentPage";

export const dynamic = "force-dynamic";

const FIELDS = [
  "_id",
  "adSoyad",
  "sinif",
  "sube",
  "baslangicDersi",
  "bitisDersi",
  "neden",
  "status",
  "createdAt",
];

function serialize(items) {
  return items.map((i) => {
    const out = {};
    for (const k of FIELDS) {
      const v = i[k];
      if (v == null) continue;
      if (k === "_id") out[k] = String(v);
      else if (v instanceof Date) out[k] = v.toISOString();
      else out[k] = v;
    }
    return out;
  });
}

export default async function Page() {
  const gun = todayKey();
  let initialItems = [];
  try {
    const items = await findAcrossCollections({
      filter: { gun },
      projection: "adSoyad sinif sube baslangicDersi bitisDersi neden status createdAt",
      sort: { createdAt: 1 },
      limit: 500,
    });
    initialItems = serialize(items);
  } catch (e) {
    console.error("SSR / initial list failed", e?.message);
  }
  return <StudentPage initialItems={initialItems} initialGun={gun} />;
}
