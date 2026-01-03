(function(global){
  const {G} = global.U;

  function solveTrap2Point(d10, h10, dEnd){
    const denom = (d10 - (d10*d10)/dEnd);
    const T = h10 / denom;
    const el = Math.atan(T);
    const v0 = Math.sqrt(0.5 * G * dEnd * (1 + T*T) / T);
    return {v0, el};
  }

  function solveGeneric2Point(z0, d1, z1, d2, z2){
    const A = (d1 - (d1*d1)/d2);
    const B = (1 - (d1*d1)/(d2*d2));
    const T = (z1 - z0*B - z2*(d1*d1)/(d2*d2)) / A;
    const K = (z0 + d2*T - z2) / (d2*d2);
    const v0 = Math.sqrt(G * (1 + T*T) / (2*K));
    const el = Math.atan(T);
    return {v0, el};
  }

  function genTrajectory(p0, az, v0, el, dEnd, stepM){
    const c = Math.cos(el), s = Math.sin(el);
    const u = [Math.sin(az), Math.cos(az), 0];
    const vxy = v0 * c;
    const vz  = v0 * s;
    const pts = [];
    const n = Math.max(2, Math.floor(dEnd / stepM) + 1);
    for (let i=0;i<n;i++){
      const d = (i===n-1) ? dEnd : i*stepM;
      const t = d / vxy;
      const x = p0[0] + u[0]*d;
      const y = p0[1] + u[1]*d;
      const z = p0[2] + vz*t - 0.5*G*t*t;
      pts.push([x,y,z]);
    }
    return pts;
  }

  global.Phys = {solveTrap2Point, solveGeneric2Point, genTrajectory};
})(window);
