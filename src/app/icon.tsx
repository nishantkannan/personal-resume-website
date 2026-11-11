import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Three terrain columns, the tallest one marked as a result.
export default function Icon() {
  const bar = (h: number, color: string) => (
    <div style={{ width: 13, height: h, background: color, borderRadius: 2 }} />
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 5,
          paddingBottom: 12,
          background: "#1f2b33",
          borderRadius: 14,
        }}
      >
        {bar(18, "#7fb3bc")}
        {bar(40, "#e3a81b")}
        {bar(28, "#7fb3bc")}
      </div>
    ),
    size,
  );
}
