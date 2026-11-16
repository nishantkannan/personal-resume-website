import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/data/resume";

/** The picture at the top of a project card: a screenshot or a small chart. Both sit in a 2:1 frame. */
export function ProjectVisual({ project }: { project: Project }) {
  const frame = "relative mb-5 block aspect-[2/1] overflow-hidden rounded-xl border border-line bg-surface";

  if (project.image) {
    const img = (
      <Image
        src={project.image.src}
        alt={project.image.alt}
        width={project.image.width}
        height={project.image.height}
        sizes="(min-width: 42rem) 36rem, 100vw"
        className="size-full object-cover"
      />
    );
    if (!project.href) return <div className={frame}>{img}</div>;
    // The card's button is the accessible link; the picture is a bigger click target for the same place.
    return (
      <Link
        href={project.href}
        tabIndex={-1}
        aria-hidden="true"
        {...(project.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`${frame} transition-opacity hover:opacity-90`}
      >
        {img}
      </Link>
    );
  }

  // The chart needs more height than a 2:1 frame gives it on a phone.
  if (project.gains) return <GainsChart points={project.gains} className={frame.replace("aspect-[2/1]", "aspect-[3/2] sm:aspect-[2/1]")} />;
  return null;
}

/** Plot area inside the frame, as percentages, so HTML labels and the SVG line up at any width. */
const PLOT = { left: 13, right: 4, top: 16, bottom: 20 };

function GainsChart({ points, className }: { points: [number, number][]; className: string }) {
  const toX = (v: number) => v * 100;
  const toY = (v: number) => (1 - v) * 100;
  const line = points.map(([x, y]) => `${toX(x)},${toY(y)}`).join(" ");
  const gap = `${line} ${points
    .slice()
    .reverse()
    .map(([x]) => `${toX(x)},${toY(x)}`)
    .join(" ")}`;
  const mark = points.find(([x]) => Math.abs(x - 0.2) < 1e-9) ?? points[2];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const at = (x: number, y: number) => ({
    left: `${PLOT.left + x * (100 - PLOT.left - PLOT.right)}%`,
    top: `${PLOT.top + (1 - y) * (100 - PLOT.top - PLOT.bottom)}%`,
  });

  return (
    <figure
      className={className}
      role="img"
      aria-label={`Cumulative gains chart. Calling the riskiest ${pct(mark[0])} of customers reaches ${pct(mark[1])} of churners, against ${pct(mark[0])} for random calling.`}
    >
      <div aria-hidden="true" className="absolute inset-0 text-[0.72rem] leading-none text-ink-soft">
        <div
          className="absolute"
          style={{ left: `${PLOT.left}%`, right: `${PLOT.right}%`, top: `${PLOT.top}%`, bottom: `${PLOT.bottom}%` }}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {[0.25, 0.5, 0.75, 1].map((v) => (
              <line key={v} x1="0" x2="100" y1={toY(v)} y2={toY(v)} stroke="var(--viz-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <line x1="0" x2="100" y1="100" y2="100" stroke="var(--viz-axis)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <polygon points={gap} fill="var(--viz-model)" opacity="0.14" />
            <line x1="0" y1="100" x2="100" y2="0" stroke="var(--viz-ref)" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            <polyline points={line} fill="none" stroke="var(--viz-model)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>

        {/* marker at the 20% cut-off */}
        <span
          className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-viz-model"
          style={at(mark[0], mark[1])}
        />
        <span className="absolute translate-y-3 pl-2.5 font-semibold whitespace-nowrap text-ink sm:translate-y-1.5" style={at(mark[0], mark[1])}>
          {pct(mark[1])} of churners<span className="hidden sm:inline"> from {pct(mark[0])} of calls</span>
        </span>

        {[0, 0.5, 1].map((v) => (
          <span key={`y${v}`} className="absolute -translate-x-[115%] -translate-y-1/2" style={at(0, v)}>
            {pct(v)}
          </span>
        ))}
        {[0, 0.5, 1].map((v) => (
          <span key={`x${v}`} className="absolute -translate-x-1/2 translate-y-2" style={at(v, 0)}>
            {pct(v)}
          </span>
        ))}

        <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">Customers called, riskiest first</span>
        <span className="absolute top-3 right-[4%] flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full bg-viz-model" />
            Model
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-[1.5px] border-dashed border-viz-ref" />
            Random calls
          </span>
        </span>
        <span className="absolute top-3 left-3 font-semibold text-ink">Churners reached</span>
      </div>
    </figure>
  );
}
