// lib/permissionQuery.js
import { dbConnect } from "@/lib/mongodb";
import Permission from "@/models/Permission";
import PermissionArchive from "@/models/PermissionArchive";

export async function findAcrossCollections({
  filter,
  sort = { createdAt: -1 },
  limit = 50,
  projection = null,
}) {
  await dbConnect();
  const [active, archived] = await Promise.all([
    Permission.find(filter, projection).sort(sort).limit(limit).lean(),
    PermissionArchive.find(filter, projection).sort(sort).limit(limit).lean(),
  ]);
  const merged = [...active, ...archived];
  const sortKey = Object.keys(sort)[0];
  const sortDir = sort[sortKey] === 1 ? 1 : -1;
  merged.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) return 0;
    return av > bv ? sortDir : -sortDir;
  });
  return merged.slice(0, limit);
}

export async function countByDayAcrossCollections({ monthKey }) {
  await dbConnect();
  const match = { $match: { gun: { $regex: `^${monthKey}-` } } };
  const group = {
    $group: {
      _id: "$gun",
      count: { $sum: 1 },
      approved: {
        $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
      },
    },
  };
  const project = {
    $project: { _id: 0, gun: "$_id", count: 1, approved: 1 },
  };
  const pipeline = [match, group, project];
  const [active, archived] = await Promise.all([
    Permission.aggregate(pipeline),
    PermissionArchive.aggregate(pipeline),
  ]);
  const map = new Map();
  for (const d of [...active, ...archived]) {
    const prev = map.get(d.gun) || { gun: d.gun, count: 0, approved: 0 };
    prev.count += d.count;
    prev.approved += d.approved;
    map.set(d.gun, prev);
  }
  return [...map.values()].sort((a, b) => (a.gun > b.gun ? 1 : -1));
}
