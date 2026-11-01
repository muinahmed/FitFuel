// Workouts & Progress component – Priyanka Pant
// Line and bar charts drawn with the HTML <canvas> API in plain JavaScript (no chart libraries).
// Markup for a chart: <div class="chart"><canvas role="img" aria-label="…"></canvas></div>
// A tooltip follows the pointer; charts redraw when the window is resized.

const CHART_STYLE = {
  mark: '#1E8B3A', // brand mid green (passes 3:1 contrast on white)
  areaFill: 'rgba(30, 139, 58, 0.10)',
  grid: '#E3EBDF',
  text: '#55625A',
  strongText: '#1F2A24',
  surface: '#FFFFFF',
  font: '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  padding: { top: 20, right: 20, bottom: 30, left: 44 },
};

const chartsOnPage = new Set();
let resizeFrame = null;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => chartsOnPage.forEach((chart) => chart.draw()));
});

// Match the canvas to its on-screen size (sharp on high-resolution screens) and clear it
function prepareCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.font = CHART_STYLE.font;
  const { padding } = CHART_STYLE;
  const area = { left: padding.left, right: width - padding.right, top: padding.top, bottom: height - padding.bottom };
  return { ctx, width, height, area };
}

// Clean axis range, e.g. 69.3–72.6 -> 69–73 in steps of 1. wholeNumbers forces steps of 1, 2, 5, …
function niceScale(minValue, maxValue, { wholeNumbers = false, ticks = 4 } = {}) {
  if (minValue === maxValue) {
    minValue -= 1;
    maxValue += 1;
  }
  const rawStep = (maxValue - minValue) / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const multipliers = wholeNumbers ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = multipliers.map((m) => m * magnitude).find((candidate) => candidate >= rawStep);
  if (wholeNumbers) step = Math.max(1, Math.round(step));
  return { min: Math.floor(minValue / step) * step, max: Math.ceil(maxValue / step) * step, step };
}

// Horizontal gridlines with value labels on the left
function drawGrid(ctx, area, scale, yFor, formatTick) {
  ctx.strokeStyle = CHART_STYLE.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = CHART_STYLE.text;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let value = scale.min; value <= scale.max + scale.step / 2; value += scale.step) {
    const y = Math.round(yFor(value)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(area.left, y);
    ctx.lineTo(area.right, y);
    ctx.stroke();
    ctx.fillText(formatTick(value), area.left - 8, y);
  }
}

// Text under the x axis, kept inside the canvas
function drawXLabel(ctx, text, x, area, width) {
  const half = ctx.measureText(text).width / 2;
  ctx.fillStyle = CHART_STYLE.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, Math.min(Math.max(x, half + 2), width - half - 2), area.bottom + 10);
}

// Tooltip <div> inside the chart box; show(html, x, y) / hide()
function chartTooltip(container) {
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  container.appendChild(tooltip);
  return {
    show(html, x, y) {
      tooltip.innerHTML = html;
      tooltip.hidden = false;
      const left = Math.min(Math.max(x - tooltip.offsetWidth / 2, 0), container.clientWidth - tooltip.offsetWidth);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${Math.max(y - tooltip.offsetHeight - 12, 0)}px`;
    },
    hide() {
      tooltip.hidden = true;
    },
  };
}

// Get the chart box ready for a new chart: forget the old chart, remove its tooltip and
// swap in a clean copy of the canvas so old pointer listeners go away
function freshCanvas(container) {
  if (container.chart) chartsOnPage.delete(container.chart);
  container.querySelectorAll('.chart-tooltip').forEach((element) => element.remove());
  const oldCanvas = container.querySelector('canvas');
  const canvas = oldCanvas.cloneNode(false);
  oldCanvas.replaceWith(canvas);
  return canvas;
}

// Remember a chart so it redraws on resize (and is replaced cleanly next time)
function registerChart(container, chart) {
  container.chart = chart;
  chartsOnPage.add(chart);
  chart.draw();
}

// Calls onHover(x) with the pointer's x position inside the canvas, or onHover(null) when it leaves
function trackPointer(canvas, onHover) {
  canvas.addEventListener('pointermove', (event) => onHover(event.clientX - canvas.getBoundingClientRect().left));
  canvas.addEventListener('pointerleave', () => onHover(null));
}

// Line chart of values over time.
// points: [{ date: 'YYYY-MM-DD', value }] oldest first; formatValue(value) -> text, e.g. "70.6 kg"
function renderLineChart(container, points, { formatValue }) {
  const canvas = freshCanvas(container);
  const tooltip = chartTooltip(container);
  let hoverIndex = null;
  let positions = [];

  const chart = {
    draw() {
      const { ctx, width, area } = prepareCanvas(canvas);
      const times = points.map((point) => new Date(`${point.date}T00:00:00`).getTime());
      const values = points.map((point) => point.value);
      const firstTime = Math.min(...times);
      const lastTime = Math.max(...times);
      // Headroom above and below so points and the end label never sit on the edge
      const lowest = Math.min(...values);
      const highest = Math.max(...values);
      const headroom = Math.max((highest - lowest) * 0.2, 0.5);
      const scale = niceScale(lowest - headroom, highest + headroom);
      const xFor = (time) => (lastTime === firstTime
        ? (area.left + area.right) / 2
        : area.left + ((time - firstTime) / (lastTime - firstTime)) * (area.right - area.left));
      const yFor = (value) => area.bottom - ((value - scale.min) / (scale.max - scale.min)) * (area.bottom - area.top);
      positions = points.map((point, i) => ({ x: xFor(times[i]), y: yFor(point.value) }));

      drawGrid(ctx, area, scale, yFor, (value) => String(Math.round(value * 10) / 10));

      // Up to 4 date labels, spread over the points
      const labelCount = Math.min(points.length, width < 480 ? 3 : 4);
      const labelIndexes = new Set(Array.from({ length: labelCount }, (_, i) => (
        labelCount === 1 ? 0 : Math.round((i * (points.length - 1)) / (labelCount - 1)))));
      labelIndexes.forEach((i) => drawXLabel(ctx, formatDate(points[i].date, { day: 'numeric', month: 'short' }), positions[i].x, area, width));

      // Soft area wash under the line
      if (positions.length > 1) {
        ctx.beginPath();
        positions.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.lineTo(positions[positions.length - 1].x, area.bottom);
        ctx.lineTo(positions[0].x, area.bottom);
        ctx.closePath();
        ctx.fillStyle = CHART_STYLE.areaFill;
        ctx.fill();

        ctx.beginPath();
        positions.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.strokeStyle = CHART_STYLE.mark;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Crosshair on the hovered point
      if (hoverIndex !== null) {
        ctx.strokeStyle = CHART_STYLE.text;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(positions[hoverIndex].x) + 0.5, area.top);
        ctx.lineTo(Math.round(positions[hoverIndex].x) + 0.5, area.bottom);
        ctx.stroke();
      }

      // Markers with a white ring (larger when hovered); fewer than 30 points so all are drawn
      positions.forEach((p, i) => {
        const radius = i === hoverIndex ? 6 : 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = CHART_STYLE.surface;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = CHART_STYLE.mark;
        ctx.fill();
      });

      // Direct label on the latest value only, on the side away from the incoming line
      const last = positions[positions.length - 1];
      const previous = positions[positions.length - 2];
      const lineComesFromAbove = previous && previous.y < last.y;
      ctx.fillStyle = CHART_STYLE.strongText;
      ctx.font = `600 ${CHART_STYLE.font}`;
      ctx.textAlign = last.x > width - 70 ? 'right' : 'left';
      ctx.textBaseline = lineComesFromAbove ? 'top' : 'bottom';
      ctx.fillText(formatValue(values[values.length - 1]), last.x + (ctx.textAlign === 'right' ? -4 : 8), last.y + (lineComesFromAbove ? 8 : -8));
    },
  };

  trackPointer(canvas, (x) => {
    if (x === null) {
      hoverIndex = null;
      tooltip.hide();
    } else {
      // Nearest point to the pointer
      hoverIndex = positions.reduce((best, p, i) => (Math.abs(p.x - x) < Math.abs(positions[best].x - x) ? i : best), 0);
      const point = points[hoverIndex];
      tooltip.show(`<strong>${formatValue(point.value)}</strong><br>${formatDate(point.date)}`, positions[hoverIndex].x, positions[hoverIndex].y);
    }
    chart.draw();
  });

  registerChart(container, chart);
}

// Bar (column) chart. bars: [{ label, value, tooltip }]; the last bar's value is labelled on its cap.
function renderBarChart(container, bars) {
  const canvas = freshCanvas(container);
  const tooltip = chartTooltip(container);
  let hoverIndex = null;
  let slots = [];

  const chart = {
    draw() {
      const { ctx, width, area } = prepareCanvas(canvas);
      const scale = niceScale(0, Math.max(4, ...bars.map((bar) => bar.value)), { wholeNumbers: true });
      const yFor = (value) => area.bottom - ((value - scale.min) / (scale.max - scale.min)) * (area.bottom - area.top);
      drawGrid(ctx, area, scale, yFor, String);

      const slotWidth = (area.right - area.left) / bars.length;
      const barWidth = Math.min(24, slotWidth * 0.6);
      const labelEvery = slotWidth < 48 ? 2 : 1;
      slots = bars.map((bar, i) => ({ left: area.left + i * slotWidth, center: area.left + (i + 0.5) * slotWidth, top: yFor(bar.value) }));

      bars.forEach((bar, i) => {
        const { center, top } = slots[i];
        if (i === hoverIndex) {
          ctx.fillStyle = 'rgba(30, 139, 58, 0.06)';
          ctx.fillRect(slots[i].left, area.top, slotWidth, area.bottom - area.top);
        }
        if (bar.value > 0) {
          ctx.beginPath();
          ctx.roundRect(center - barWidth / 2, top, barWidth, area.bottom - top, [4, 4, 0, 0]);
          ctx.fillStyle = CHART_STYLE.mark;
          ctx.fill();
        }
        // Label every bar from the newest backwards, so the current week is always labelled
        if ((bars.length - 1 - i) % labelEvery === 0) drawXLabel(ctx, bar.label, center, area, width);
      });

      // Value on the latest bar's cap
      const last = slots[slots.length - 1];
      ctx.fillStyle = CHART_STYLE.strongText;
      ctx.font = `600 ${CHART_STYLE.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(bars[bars.length - 1].value), last.center, last.top - 4);
    },
  };

  trackPointer(canvas, (x) => {
    const index = x === null ? -1 : slots.findIndex((slot, i) => x >= slot.left && (i === slots.length - 1 || x < slots[i + 1].left));
    hoverIndex = index >= 0 ? index : null;
    if (hoverIndex === null) tooltip.hide();
    else tooltip.show(bars[hoverIndex].tooltip, slots[hoverIndex].center, slots[hoverIndex].top);
    chart.draw();
  });

  registerChart(container, chart);
}
