(function(global){
  const G = 9.80665;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const deg2rad = (d) => d * Math.PI / 180.0;
  const rad2deg = (r) => r * 180.0 / Math.PI;
  const lerp = (a,b,t) => a + (b-a)*t;

  function sampleRange(minV, maxV, n, includeExtremes){
    if (n <= 1) return [includeExtremes ? minV : (minV+maxV)/2];
    const out = [];
    if (includeExtremes){
      out.push(minV);
      for (let i=0;i<n-2;i++) out.push(lerp(minV, maxV, Math.random()));
      out.push(maxV);
    }else{
      for (let i=0;i<n;i++) out.push(lerp(minV, maxV, Math.random()));
    }
    return out;
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:"application/json;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function bboxOf(points){
    let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
    for (const p of points){
      minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); minZ = Math.min(minZ, p[2]);
      maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); maxZ = Math.max(maxZ, p[2]);
    }
    return {minX,minY,minZ,maxX,maxY,maxZ};
  }


  // ---- 2D geometry helpers (impact envelope) ----
  function convexHull2D(points){
    // Monotonic chain. Input: array of [x,y]. Output: hull points CCW, no repeat last.
    if (!points || points.length <= 1) return (points || []).slice();
    const pts = points
      .map(p => [Number(p[0]), Number(p[1])])
      .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (pts.length <= 1) return pts;

    pts.sort((a,b)=> (a[0]===b[0]) ? (a[1]-b[1]) : (a[0]-b[0]));
    const cross = (o,a,b)=> (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);

    const lower = [];
    for (const p of pts){
      while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i=pts.length-1;i>=0;i--){
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  function polygonArea2D(poly){
    if (!poly || poly.length < 3) return 0;
    let a = 0;
    for (let i=0;i<poly.length;i++){
      const p = poly[i];
      const q = poly[(i+1)%poly.length];
      a += p[0]*q[1] - q[0]*p[1];
    }
    return Math.abs(a) / 2;
  }

  global.U = {G, clamp, deg2rad, rad2deg, sampleRange, downloadText, bboxOf, convexHull2D, polygonArea2D};
})(window);
