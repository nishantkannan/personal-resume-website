"use client";

import { useEffect, useMemo, useRef } from "react";
import { profile } from "@/data/resume";
import { getUi, goToStop, live, setPlain, setTod, useUi, type Tod } from "@/lib/drive-store";
import { STOP_LABELS, STOP_U, pointAt, routePolyline, tangentAt } from "@/lib/route";

const glass =
  "border border-white/10 bg-[#141c22]/78 text-[#e9eef0] shadow-[0_18px_50px_-24px_rgba(0,0,0,0.6)] backdrop-blur-md";

const TODS: { id: Tod; label: string; icon: React.ReactNode }[] = [
  {
    id: "day",
    label: "Day",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "dusk",
    label: "Dusk",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 17a7 7 0 0 1 14 0M2.5 17h19M12 4.5v3M5.6 8.6l1.8 1.8M18.4 8.6l-1.8 1.8M7 20.5h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "night",
    label: "Night",
    icon: (
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function Hud({ canDrive }: { canDrive: boolean }) {
  const tod = useUi((s) => s.tod);
  const plain = useUi((s) => s.plain);
  const stop = useUi((s) => s.stop);
  const driving = canDrive && !plain;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
        <a
          href="#top"
          className={`${glass} pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5`}
        >
          <span className="grid size-8 place-items-center rounded-full bg-[#e3a81b] text-[13px] font-bold text-[#1f2b33]">
            NK
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold whitespace-nowrap">{profile.name}</span>
            <span className="hidden text-[12px] text-[#a7b3b9] sm:block">Resume</span>
          </span>
        </a>

        <div className={`${glass} pointer-events-auto flex items-center gap-1 rounded-full p-1`}>
          <div role="group" aria-label="Time of day" className="flex items-center gap-1">
            {TODS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tod === t.id}
                onClick={() => setTod(t.id)}
                className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  tod === t.id ? "bg-[#e9eef0] text-[#1f2b33]" : "text-[#c5ced2] hover:text-white"
                }`}
              >
                {t.icon}
                <span className={tod === t.id ? "sr-only sm:not-sr-only" : "sr-only"}>{t.label}</span>
              </button>
            ))}
          </div>
          {canDrive && (
            <>
              <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setPlain(!plain)}
                aria-label={plain ? "Drive mode" : "Skip the drive"}
                title={plain ? "Drive mode" : "Skip the drive"}
                className="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-[#c5ced2] transition-colors hover:text-white sm:px-3"
              >
                {plain ? (
                  <svg viewBox="0 0 24 24" className="size-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M5 17h14l-1.6-5.2A2 2 0 0 0 15.5 10.4h-7a2 2 0 0 0-1.9 1.4ZM7 17v2M17 17v2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="size-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
                  </svg>
                )}
                <span className="hidden sm:inline" aria-hidden="true">
                  {plain ? "Drive mode" : "Skip the drive"}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {driving && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-end p-3 sm:p-4">
          <div className={`${glass} pointer-events-auto w-full overflow-hidden rounded-2xl sm:max-w-[17rem]`}>
            <Minimap stop={stop} />
            <Speedometer stop={stop} />
          </div>
        </div>
      )}
    </>
  );
}

const VIEW_W = 272;
const VIEW_H = 132;

function Minimap({ stop }: { stop: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const car = useRef<SVGGElement>(null);
  const ready = useUi((s) => s.ready);
  const d = useMemo(
    () =>
      routePolyline(6)
        .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.z.toFixed(1)}`)
        .join(" "),
    [],
  );
  const stops = useMemo(() => STOP_U.map((u) => pointAt(u)), []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const u = ready ? live.pos : live.target;
      const p = pointAt(u);
      const t = tangentAt(u);
      svg.current?.setAttribute("viewBox", `${p.x - VIEW_W / 2} ${p.z - VIEW_H * 0.62} ${VIEW_W} ${VIEW_H}`);
      const deg = (Math.atan2(t.x, -t.z) * 180) / Math.PI;
      car.current?.setAttribute("transform", `translate(${p.x} ${p.z}) rotate(${deg})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  return (
    <nav aria-label="Route" className="hidden border-b border-white/10 bg-black/15 md:[@media(min-height:620px)]:block">
      <svg ref={svg} width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice" className="block" aria-hidden="true">
        <path d={d} fill="none" stroke="#3a4a54" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#56636b" strokeWidth={1} strokeDasharray="3 4" />
        {stops.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.z})`} onClick={() => goToStop(i)} className="cursor-pointer">
            <circle r={4} fill={i === stop ? "#e3a81b" : "#e9eef0"} stroke="#141c22" strokeWidth={1.5} />
            <text x={8} y={3.5} fontSize={9} fill="#c5ced2" fontWeight={500}>
              {STOP_LABELS[i]}
            </text>
          </g>
        ))}
        <g ref={car}>
          <path d="M0 -6 L4.5 5 L0 2.6 L-4.5 5 Z" fill="#e3a81b" stroke="#141c22" strokeWidth={1} />
        </g>
      </svg>
      <ol className="sr-only">
        {STOP_LABELS.map((l, i) => (
          <li key={l}>
            <button type="button" onClick={() => goToStop(i)}>
              Drive to {l}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Speedometer({ stop }: { stop: number }) {
  const mph = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const ready = useUi((s) => s.ready);

  useEffect(() => {
    let raf = 0;
    let shown = -1;
    const tick = () => {
      const value = ready ? Math.min(160, Math.round(live.speed * 1.1)) : 0;
      if (value !== shown && mph.current) {
        mph.current.textContent = String(value);
        shown = value;
      }
      const u = ready ? live.pos : live.target;
      const f = (u - STOP_U[0]) / (STOP_U[STOP_U.length - 1] - STOP_U[0]);
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, Math.max(0, f))})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  const last = STOP_LABELS.length - 1;

  return (
    // Phones: one compact row. Larger screens: a stacked dashboard.
    <div className="flex items-center gap-2 px-2 py-2 sm:grid sm:grid-cols-[auto_1fr_auto] sm:gap-x-2 sm:p-4">
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 sm:col-span-3 sm:row-start-1">
        <span className="hidden text-[12px] text-[#a7b3b9] sm:inline">Now passing</span>
        <span className="truncate text-[13px] font-semibold">{STOP_LABELS[stop]}</span>
      </div>
      <div className="flex items-baseline gap-1.5 sm:col-span-3 sm:row-start-2 sm:mt-1">
        <span ref={mph} className="display text-2xl leading-none font-extrabold tabular-nums sm:text-[2.6rem]" aria-hidden="true">
          0
        </span>
        <span className="text-[12px] text-[#a7b3b9]" aria-hidden="true">
          mph
        </span>
      </div>
      <span className="mt-3 hidden h-1 overflow-hidden rounded-full bg-white/12 sm:col-span-3 sm:row-start-3 sm:block" aria-hidden="true">
        <span ref={bar} className="block h-full origin-left rounded-full bg-[#e3a81b]" style={{ transform: "scaleX(0)" }} />
      </span>
      <button
        type="button"
        onClick={() => goToStop(Math.max(0, getUi().stop - 1))}
        disabled={stop === 0}
        className="order-first grid size-9 place-items-center rounded-full text-[#c5ced2] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 sm:order-none sm:col-start-1 sm:row-start-4 sm:mt-3"
        aria-label="Drive to previous stop"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="hidden self-center text-center text-[12px] text-[#a7b3b9] sm:col-start-2 sm:row-start-4 sm:mt-3 sm:block">
        Stop {stop + 1} of {last + 1}
      </span>
      <button
        type="button"
        onClick={() => goToStop(Math.min(last, getUi().stop + 1))}
        disabled={stop === last}
        className="grid size-9 place-items-center rounded-full text-[#c5ced2] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 sm:col-start-3 sm:row-start-4 sm:mt-3"
        aria-label="Drive to next stop"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
