import fs from "node:fs";
import { Readable } from "node:stream";

function parseRange(range: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

export function streamFileWithRange(req: Request, filePath: string, mime: string): Response {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  const rangeHeader = req.headers.get("range");

  const headers = new Headers({
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  });

  if (!rangeHeader) {
    headers.set("Content-Length", String(size));
    return new Response(Readable.toWeb(fs.createReadStream(filePath)) as BodyInit, { headers });
  }

  const range = parseRange(rangeHeader, size);
  if (!range) {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }

  const length = range.end - range.start + 1;
  headers.set("Content-Length", String(length));
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);

  return new Response(Readable.toWeb(fs.createReadStream(filePath, range)) as BodyInit, {
    status: 206,
    headers,
  });
}
