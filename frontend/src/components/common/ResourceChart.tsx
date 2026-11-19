import React, { useMemo } from 'react';

interface ResourceChartProps {
  data: number[];
  max?: number;
  unit?: string;
  height?: number;
  color?: string;
  autoColor?: boolean;
  thresholdWarning?: number;
  thresholdDanger?: number;
  title?: string;
}

export const ResourceChart: React.FC<ResourceChartProps> = ({
  data = [],
  max,
  unit = '%',
  height = 36,
  color,
  autoColor = true,
  thresholdWarning = 70,
  thresholdDanger = 85,
}) => {
  // Determine color based on latest value and max
  const latestValue = data.length > 0 ? data[data.length - 1] : 0;
  const effectiveMax = max && max > 0 ? max : Math.max(...data, 1);
  const percentage = max ? (latestValue / max) * 100 : latestValue;

  const resolvedColor = useMemo(() => {
    if (color) return color;
    if (!autoColor) return 'var(--color-primary-light)';
    if (percentage >= thresholdDanger) return '#EF4444'; // Red
    if (percentage >= thresholdWarning) return '#F59E0B'; // Orange/Yellow
    return '#10B981'; // Green
  }, [color, autoColor, percentage, thresholdDanger, thresholdWarning]);

  // Compute SVG Points
  const { pathD, areaD } = useMemo(() => {
    if (!data || data.length < 2) {
      return { pathD: '', areaD: '' };
    }

    const svgWidth = 100;
    const svgHeight = height;
    const points: [number, number][] = [];

    const ceiling = effectiveMax > 0 ? effectiveMax : 100;
    const step = svgWidth / (data.length - 1);

    data.forEach((val, idx) => {
      const x = idx * step;
      const normalized = Math.min(Math.max(val / ceiling, 0), 1);
      // Invert Y because SVG 0 is top
      const y = svgHeight - normalized * (svgHeight - 4) - 2;
      points.push([x, y]);
    });

    // Create smooth SVG curve
    let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cur = points[i];
      const cx = (prev[0] + cur[0]) / 2;
      d += ` Q ${prev[0].toFixed(1)} ${prev[1].toFixed(1)}, ${cx.toFixed(1)} ${((prev[1] + cur[1]) / 2).toFixed(1)}`;
      d += ` T ${cur[0].toFixed(1)} ${cur[1].toFixed(1)}`;
    }

    const area = `${d} L 100 ${svgHeight} L 0 ${svgHeight} Z`;

    return { pathD: d, areaD: area };
  }, [data, effectiveMax, height]);

  const gradientId = useMemo(() => `chart-grad-${Math.random().toString(36).substring(2, 9)}`, []);

  return (
    <div style={{ width: '100%', height: `${height}px`, position: 'relative', overflow: 'hidden' }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={resolvedColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Gradient fill under curve */}
        {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}

        {/* Stroke line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={resolvedColor}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
};
