import { scoreColors } from "../design";

export const PIN_ZOOM_START = 14;
export const PIN_ZOOM_FULL = 16;
// 31 surveyed points: nearest-neighbour median 222 m, Q1 59 m.
// MapLibre uses 512 px tiles: at latitude -7.75, zoom 14 = 4.73 m/px,
// zoom 16 = 1.18 m/px. A 30 px pin needs ~36 m at full visibility.
export function scoreColor(score, thresholds) {
  if (!Number.isFinite(score) || !thresholds) return "#769087";
  return scoreColors[thresholds.filter((t) => score >= t).length];
}
const rgb = (color) => color.match(/[a-f0-9]{2}/gi).map((v) => parseInt(v, 16));
export function iconContrast(color) {
  const luminance = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722 >
    0.32
    ? "#192b27"
    : "#ffffff";
}

// One symbol layer; image pixels respond to feature-state because MapLibre
// does not support feature-state for icon-image or icon-size layout properties.
export function createPinImage(map, id, missingPrice, initialColor) {
  const size = 112;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let previous = "",
    start = 0,
    fromColor = rgb(initialColor),
    toColor = fromColor,
    currentColor = fromColor;
  let fromScale = 1,
    targetScale = 1,
    currentScale = 1;
  return {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),
    render() {
      const state = map.getFeatureState({ source: "titik-kos", id });
      const color = state.color || initialColor;
      const scale = state.hover || state.selected ? 1.1 : 1;
      const signature = `${color}|${scale}`;
      const now = performance.now();
      if (signature !== previous) {
        previous = signature;
        fromColor = [...currentColor];
        toColor = rgb(color);
        fromScale = currentScale;
        targetScale = scale;
        start = now;
      } else if (now - start > 220) return false;
      const progress = reduced.matches ? 1 : Math.min(1, (now - start) / 200);
      const eased = 1 - (1 - progress) ** 3;
      currentScale = fromScale + (targetScale - fromScale) * eased;
      currentColor = fromColor.map((v, i) => v + (toColor[i] - v) * eased);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(56, 106);
      ctx.scale(currentScale, currentScale);
      ctx.shadowColor = `rgba(0,0,0,${missingPrice ? 0.2 : 0.45})`;
      ctx.shadowBlur = scale > 1 ? 12 : missingPrice ? 2 : 6;
      ctx.shadowOffsetY = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-8, -18, -29, -34, -29, -54);
      ctx.bezierCurveTo(-29, -91, 29, -91, 29, -54);
      ctx.bezierCurveTo(29, -34, 8, -18, 0, 0);
      ctx.closePath();
      ctx.fillStyle = `rgb(${currentColor.map(Math.round).join(",")})`;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = "#eef8eb";
      ctx.lineWidth = missingPrice ? 2.4 : 1.5;
      ctx.setLineDash(missingPrice ? [5, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = iconContrast(color);
      ctx.beginPath();
      ctx.moveTo(-14, -54);
      ctx.lineTo(0, -67);
      ctx.lineTo(14, -54);
      ctx.lineTo(10, -54);
      ctx.lineTo(10, -40);
      ctx.lineTo(3, -40);
      ctx.lineTo(3, -49);
      ctx.lineTo(-3, -49);
      ctx.lineTo(-3, -40);
      ctx.lineTo(-10, -40);
      ctx.lineTo(-10, -54);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      this.data = ctx.getImageData(0, 0, size, size).data;
      if (progress < 1) map.triggerRepaint();
      return true;
    },
  };
}
