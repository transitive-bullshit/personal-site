// Small float-plane image operations shared by the portrait prep scripts.

export function gaussianBlur(src, width, height, sigma) {
  if (sigma <= 0) return Float32Array.from(src)
  const r = Math.ceil(sigma * 3)
  const k = new Float32Array(r * 2 + 1)
  let sum = 0
  for (let i = -r; i <= r; i++)
    sum += k[i + r] = Math.exp((-i * i) / (2 * sigma * sigma))
  for (let i = 0; i < k.length; i++) k[i] /= sum
  const tmp = new Float32Array(width * height)
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0
      for (let i = -r; i <= r; i++)
        acc +=
          k[i + r] * src[y * width + Math.min(width - 1, Math.max(0, x + i))]
      tmp[y * width + x] = acc
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0
      for (let i = -r; i <= r; i++)
        acc +=
          k[i + r] * tmp[Math.min(height - 1, Math.max(0, y + i)) * width + x]
      out[y * width + x] = acc
    }
  }
  return out
}

function morph(src, width, height, radius, pick) {
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = src[y * width + x]
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy))
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius + radius) continue
          const xx = Math.min(width - 1, Math.max(0, x + dx))
          v = pick(v, src[yy * width + xx])
        }
      }
      out[y * width + x] = v
    }
  }
  return out
}
export function erode(src, width, height, radius) {
  return morph(src, width, height, radius, Math.min)
}

export function dilate(src, width, height, radius) {
  return morph(src, width, height, radius, Math.max)
}

export function resizeBilinear(src, sw, sh, dw, dh) {
  const out = new Float32Array(dw * dh)
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, Math.max(0, ((y + 0.5) * sh) / dh - 0.5))
    const y0 = Math.floor(fy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, Math.max(0, ((x + 0.5) * sw) / dw - 0.5))
      const x0 = Math.floor(fx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const tx = fx - x0
      const a = src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx
      const b = src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx
      out[y * dw + x] = a * (1 - ty) + b * ty
    }
  }
  return out
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
