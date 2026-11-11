import { ImageResponse } from "next/og";
import { highlights, profile } from "@/data/resume";

export const alt = `${profile.name}, ${profile.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Heights for a row of terrain columns along the bottom; peaks match the site's results.
const COLUMNS = [3, 4, 5, 7, 10, 7, 5, 4, 6, 9, 14, 9, 6, 5, 4, 5, 8, 12, 8, 5, 4, 3, 4, 6, 4];
const PEAKS = new Set([4, 10, 17]);

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#e9eef0",
          color: "#1f2b33",
          padding: "64px 72px 0",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>{profile.name}</div>
          <div style={{ fontSize: 38, marginTop: 20, fontWeight: 600 }}>{`${profile.role}, Caterpillar`}</div>
          <div style={{ fontSize: 28, marginTop: 14, color: "#56636b", maxWidth: 900 }}>
            {highlights
              .slice(0, 3)
              .map((h) => `${h.value} ${h.label}`)
              .join("   /   ")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 220 }}>
          {COLUMNS.map((h, i) => (
            <div
              key={i}
              style={{
                width: 34,
                height: h * 15,
                background: PEAKS.has(i) ? "#e3a81b" : "#3e6f78",
                opacity: PEAKS.has(i) ? 1 : 0.3 + h / 20,
              }}
            />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
