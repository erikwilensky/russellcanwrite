"use client";

import { REGIONS, type RegionId } from "@/lib/regions";
import s from "./rcw.module.css";

/** A hand-drawn, low-detail world (longitude, latitude). Good enough for a war table, not for navigation. */
const LAND: Array<Array<[number, number]>> = [
  // North America
  [[-168, 66], [-162, 70], [-140, 70], [-120, 74], [-95, 72], [-80, 73], [-65, 62], [-60, 55], [-53, 47], [-66, 44], [-70, 41], [-76, 35], [-81, 31], [-80, 25], [-82, 28], [-84, 30], [-90, 29], [-97, 26], [-97, 21], [-90, 21], [-87, 16], [-83, 10], [-79, 8], [-82, 8], [-86, 12], [-92, 15], [-105, 20], [-110, 24], [-115, 30], [-118, 34], [-124, 40], [-124, 48], [-130, 54], [-140, 60], [-150, 60], [-158, 57], [-165, 60]],
  // Greenland
  [[-50, 60], [-42, 60], [-20, 70], [-20, 78], [-60, 78], [-70, 77], [-55, 70]],
  // Cuba
  [[-85, 22], [-80, 23], [-74, 20], [-78, 20]],
  // South America
  [[-79, 8], [-72, 12], [-62, 11], [-52, 5], [-50, 0], [-35, -5], [-39, -15], [-41, -22], [-48, -26], [-53, -33], [-58, -38], [-65, -41], [-66, -47], [-69, -50], [-73, -50], [-75, -46], [-73, -37], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 0]],
  // Eurasia
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [-2, 49], [3, 51], [8, 54], [8, 57], [5, 58], [5, 62], [14, 67], [25, 71], [40, 68], [45, 68], [60, 70], [70, 73], [80, 73], [100, 77], [115, 74], [130, 72], [150, 72], [170, 70], [180, 67], [180, 65], [170, 60], [160, 55], [156, 51], [150, 59], [142, 59], [138, 54], [141, 48], [135, 43], [130, 42], [126, 38], [126, 35], [121, 37], [122, 31], [119, 25], [110, 21], [108, 16], [109, 11], [105, 9], [103, 1], [100, 6], [98, 9], [98, 16], [94, 17], [91, 22], [87, 21], [80, 15], [77, 8], [73, 16], [72, 21], [66, 25], [57, 25], [56, 27], [51, 24], [55, 18], [52, 16], [44, 12], [43, 14], [39, 21], [35, 28], [34, 31], [36, 36], [30, 36], [27, 37], [26, 40], [23, 40], [22, 37], [20, 40], [19, 42], [13, 46], [13, 44], [16, 41], [18, 40], [16, 38], [12, 38], [15, 41], [11, 43], [8, 44], [3, 43], [0, 39], [-2, 37], [-6, 36]],
  // Africa
  [[-17, 21], [-16, 28], [-9, 32], [-6, 36], [0, 36], [10, 37], [11, 33], [20, 31], [30, 31], [32, 31], [34, 28], [37, 22], [39, 16], [43, 12], [51, 12], [47, 5], [40, -3], [40, -10], [35, -18], [35, -24], [32, -28], [27, -34], [20, -35], [18, -32], [12, -18], [13, -10], [9, -1], [9, 4], [4, 6], [-4, 5], [-8, 4], [-13, 8], [-17, 15]],
  // Madagascar
  [[44, -25], [48, -25], [50, -15], [49, -12], [44, -17]],
  // Britain and Ireland
  [[-5, 50], [1, 51], [2, 53], [-1, 55], [-2, 57], [-3, 59], [-6, 58], [-5, 55], [-3, 54], [-5, 52]],
  [[-10, 52], [-6, 52], [-6, 55], [-8, 55], [-10, 54]],
  // Iceland
  [[-24, 64], [-14, 64], [-14, 66], [-22, 66]],
  // Japan
  [[130, 31], [132, 34], [135, 34], [140, 35], [141, 38], [142, 41], [141, 43], [145, 44], [142, 45], [140, 42], [139, 38], [136, 36], [132, 35], [129, 33]],
  // Philippines
  [[120, 18], [122, 18], [124, 13], [126, 7], [122, 7], [121, 13]],
  // Sumatra, Borneo, Java, New Guinea
  [[95, 5], [98, 4], [104, -2], [106, -6], [102, -4], [98, 0]],
  [[109, 1], [111, -3], [116, -4], [118, 1], [117, 7], [113, 3]],
  [[105, -6], [114, -8], [106, -7.5]],
  [[131, -1], [141, -3], [150, -10], [141, -9], [137, -5]],
  // Australia
  [[114, -22], [114, -34], [118, -35], [123, -34], [129, -31], [135, -35], [138, -34], [141, -38], [146, -39], [150, -37], [153, -31], [153, -25], [146, -19], [145, -15], [142, -11], [141, -17], [136, -12], [131, -11], [126, -14], [122, -18]],
  // New Zealand
  [[172, -35], [178, -38], [174, -41], [167, -46], [172, -41]],
];

const W = 1000;
const LON0 = -170;
const LAT0 = 78;
const SCALE = W / 350;
const H = Math.round(128 * SCALE);

export const px = (lon: number) => (lon - LON0) * SCALE;
export const py = (lat: number) => (LAT0 - lat) * SCALE;

export type MarkerState = { open: boolean; won: number; conquered: boolean };

export function WorldMap({
  states,
  onPick,
  selected,
}: {
  states: Record<RegionId, MarkerState>;
  onPick: (id: RegionId) => void;
  selected: RegionId | null;
}) {
  return (
    <div className={s.mapBox}>
      <svg className={s.mapSvg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Campaign map of the world">
        <defs>
          <pattern id="rcw-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#1d3a55" strokeWidth="1" />
          </pattern>
          <radialGradient id="rcw-fog">
            <stop offset="0%" stopColor="#c9d3dd" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#c9d3dd" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="#0e2236" />
        <rect width={W} height={H} fill="url(#rcw-grid)" />
        {LAND.map((poly, i) => (
          <polygon
            key={i}
            points={poly.map(([lon, lat]) => `${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join(" ")}
            fill="#2f4a3a"
            stroke="#58775f"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        ))}
        {REGIONS.map((r) => {
          const st = states[r.id];
          const x = px(r.lon);
          const y = py(r.lat);
          const pct = st.won / 7;
          const ring = 2 * Math.PI * 17;
          return (
            <g
              key={r.id}
              className={s.marker}
              role="button"
              tabIndex={0}
              aria-label={`${r.name}${st.open ? "" : " (locked)"}`}
              onClick={() => onPick(r.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onPick(r.id)}
            >
              {!st.open && <circle cx={x} cy={y} r={46} fill="url(#rcw-fog)" />}
              <circle cx={x} cy={y} r={22} fill="#0b1320" opacity={0.75} />
              <circle
                className={s.markerRing}
                cx={x}
                cy={y}
                r={17}
                fill="none"
                stroke={st.open ? r.colour : "#566b80"}
                strokeWidth={selected === r.id ? 4 : 2}
              />
              {st.open && pct > 0 && (
                <circle
                  cx={x}
                  cy={y}
                  r={17}
                  fill="none"
                  stroke="#f2c14e"
                  strokeWidth={4}
                  strokeDasharray={`${ring * pct} ${ring}`}
                  transform={`rotate(-90 ${x} ${y})`}
                />
              )}
              <text x={x} y={y + 6} textAnchor="middle" fontSize="17" fill={st.open ? "#ece8dc" : "#7d8fa1"}>
                {st.conquered ? "⚑" : st.open ? "⚔" : "?"}
              </text>
              <text
                x={x}
                y={y + 38}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill={st.open ? "#ece8dc" : "#7d8fa1"}
                stroke="#0b1320"
                strokeWidth="4"
                paintOrder="stroke"
              >
                {r.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
