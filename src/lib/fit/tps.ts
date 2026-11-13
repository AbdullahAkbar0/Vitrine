// Thin-plate spline: a smooth "rubber sheet" bend that moves chosen points exactly onto new places.
export type Pt = [number, number]

const U = (r2: number) => (r2 < 1e-12 ? 0 : r2 * Math.log(r2))

/** Returns a function that maps points from `from` space to `to` space. */
export function thinPlateSpline(from: Pt[], to: Pt[], smoothing = 1e-4): (x: number, y: number) => Pt {
  const n = from.length
  // normalise for numerical stability
  let sx = 0
  let sy = 0
  for (const [x, y] of from) {
    sx += x
    sy += y
  }
  const cx = sx / n
  const cy = sy / n
  let scale = 0
  for (const [x, y] of from) scale = Math.max(scale, Math.abs(x - cx), Math.abs(y - cy))
  scale = scale || 1
  const P = from.map(([x, y]) => [(x - cx) / scale, (y - cy) / scale] as Pt)

  const size = n + 3
  const A: number[][] = Array.from({ length: size }, () => new Array(size + 2).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = P[i][0] - P[j][0]
      const dy = P[i][1] - P[j][1]
      A[i][j] = U(dx * dx + dy * dy) + (i === j ? smoothing : 0)
    }
    A[i][n] = 1
    A[i][n + 1] = P[i][0]
    A[i][n + 2] = P[i][1]
    A[n][i] = 1
    A[n + 1][i] = P[i][0]
    A[n + 2][i] = P[i][1]
    A[i][size] = to[i][0]
    A[i][size + 1] = to[i][1]
  }
  // Gaussian elimination with partial pivoting, two right-hand sides
  for (let c = 0; c < size; c++) {
    let piv = c
    for (let r = c + 1; r < size; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r
    ;[A[c], A[piv]] = [A[piv], A[c]]
    const d = A[c][c] || 1e-12
    for (let r = 0; r < size; r++) {
      if (r === c) continue
      const f = A[r][c] / d
      if (f === 0) continue
      for (let k = c; k < size + 2; k++) A[r][k] -= f * A[c][k]
    }
  }
  const wx = new Float64Array(size)
  const wy = new Float64Array(size)
  for (let i = 0; i < size; i++) {
    wx[i] = A[i][size] / A[i][i]
    wy[i] = A[i][size + 1] / A[i][i]
  }

  return (x: number, y: number): Pt => {
    const px = (x - cx) / scale
    const py = (y - cy) / scale
    let rx = wx[n] + wx[n + 1] * px + wx[n + 2] * py
    let ry = wy[n] + wy[n + 1] * px + wy[n + 2] * py
    for (let i = 0; i < n; i++) {
      const dx = px - P[i][0]
      const dy = py - P[i][1]
      const u = U(dx * dx + dy * dy)
      rx += wx[i] * u
      ry += wy[i] * u
    }
    return [rx, ry]
  }
}
