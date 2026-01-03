(function(global){
  const U = global.U;
  const {deg2rad, rad2deg, clamp, convexHull2D, polygonArea2D, bboxOf, G} = U;

  function normAngleRad(a){
    while (a > Math.PI) a -= Math.PI*2;
    while (a < -Math.PI) a += Math.PI*2;
    return a;
  }

  function stationCenterAzRad(scene, st){
    if ((scene.meta && scene.meta.discipline) === "trap") return 0;
    // Skeet：以场地中心（0,0）方向为中心方位
    const dx = -st.gun[0];
    const dy = -st.gun[1];
    return Math.atan2(dx, dy);
  }

  function inSector(scene, cfg, st, azRad, elRad){
    const azHalf = deg2rad(cfg.azHalf);
    const center = stationCenterAzRad(scene, st);
    const dAz = Math.abs(normAngleRad(azRad - center));
    const elDeg = rad2deg(elRad);
    return (dAz <= azHalf + 1e-9) && (elDeg >= cfg.elMin - 1e-9) && (elDeg <= cfg.elMax + 1e-9);
  }

  function targetPosAt(tr, t){
    const p0 = tr.points[0];
    const az = deg2rad(tr.params.azDeg);
    const el = deg2rad(tr.params.elDeg);
    const v0 = tr.params.v0;
    const vxy = v0 * Math.cos(el);
    const x = p0[0] + Math.sin(az) * vxy * t;
    const y = p0[1] + Math.cos(az) * vxy * t;
    const z = p0[2] + (v0 * Math.sin(el)) * t - 0.5 * G * t * t;
    return [x,y,z];
  }

  function aimFromGunToPoint(gun, p){
    const dx = p[0] - gun[0];
    const dy = p[1] - gun[1];
    const dz = p[2] - gun[2];
    const az = Math.atan2(dx, dy);
    const dh = Math.sqrt(dx*dx + dy*dy);
    const el = Math.atan2(dz, dh);
    return {az, el, dh, dz};
  }

  // ---- RNG (deterministic) ----
  function lcg(seed){
    let s = (seed >>> 0) || 1;
    return function(){
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function randN(rnd){
    // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function windVector(speed, dirDeg){
    // 吹向角：0° = +Y，90° = +X（与本页方位角一致）
    const th = deg2rad(dirDeg || 0);
    return [Math.sin(th) * speed, Math.cos(th) * speed, 0];
  }

  function derivedDragK(rho, cd, pelletDiaMM, pelletDensity){
    const dia = (pelletDiaMM || 0) / 1000.0;
    const dens = pelletDensity || 0;
    if (!(dia > 0) || !(rho > 0) || !(cd > 0) || !(dens > 0)) return NaN;
    const r = dia * 0.5;
    const area = Math.PI * r * r;
    const mass = (4.0/3.0) * Math.PI * r * r * r * dens;
    return 0.5 * rho * cd * area / mass;
  }

  function rk4Step(state, dt, env){
    const k = env.k;
    const wx = env.wind[0], wy = env.wind[1], wz = env.wind[2];

    function deriv(s){
      const x=s[0], y=s[1], z=s[2], vx=s[3], vy=s[4], vz=s[5];
      const rvx=vx-wx, rvy=vy-wy, rvz=vz-wz;
      const sp = Math.sqrt(rvx*rvx + rvy*rvy + rvz*rvz);
      const ax = -k * sp * rvx;
      const ay = -k * sp * rvy;
      const az = -G - k * sp * rvz;
      return [vx, vy, vz, ax, ay, az];
    }

    const k1 = deriv(state);
    const s2 = state.map((v,i)=> v + 0.5*dt*k1[i]);
    const k2 = deriv(s2);
    const s3 = state.map((v,i)=> v + 0.5*dt*k2[i]);
    const k3 = deriv(s3);
    const s4 = state.map((v,i)=> v + dt*k3[i]);
    const k4 = deriv(s4);
    const out = state.map((v,i)=> v + (dt/6.0)*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));
    return out;
  }

  function integrateImpactPhysical(gun, az, el, v0, env, dt, maxT, maxDist){
    const cEl = Math.cos(el);
    const vx0 = Math.sin(az) * cEl * v0;
    const vy0 = Math.cos(az) * cEl * v0;
    const vz0 = Math.sin(el) * v0;

    let state = [gun[0], gun[1], gun[2], vx0, vy0, vz0];
    let t = 0;
    const n = Math.ceil(maxT / dt);
    let prev = state.slice();
    let prevT = 0;

    for (let i=0;i<n;i++){
      prev = state.slice();
      prevT = t;
      state = rk4Step(state, dt, env);
      t += dt;

      const x=state[0], y=state[1], z=state[2];
      const dx = x - gun[0];
      const dy = y - gun[1];
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (maxDist && dist > maxDist){
        return {impact:[x,y,Math.max(0,z)], tImpact:t, clipped:true};
      }

      if (z <= 0 && t > 0){
        const z0 = prev[2], z1 = z;
        const alpha = z0 / (z0 - z1 + 1e-12);
        const xi = prev[0] + (x - prev[0]) * alpha;
        const yi = prev[1] + (y - prev[1]) * alpha;
        const ti = prevT + (t - prevT) * alpha;
        return {impact:[xi, yi, 0], tImpact:ti, clipped:false};
      }

      // 速度过低则提前结束（对远距离贡献很小）
      const vx=state[3], vy=state[4], vz=state[5];
      const spAbs = Math.sqrt(vx*vx + vy*vy + vz*vz);
      if (spAbs < 8) break;
    }
    return null;
  }

  function integrateTrajectoryPhysical(gun, az, el, v0, env, dt, maxT, maxDist){
    const pts = [];
    const cEl = Math.cos(el);
    const vx0 = Math.sin(az) * cEl * v0;
    const vy0 = Math.cos(az) * cEl * v0;
    const vz0 = Math.sin(el) * v0;
    let state = [gun[0], gun[1], gun[2], vx0, vy0, vz0];
    let t = 0;

    // store [x,y,z,speed] for richer hover info; downstream code reads x/y/z only
    const vAbs0 = Math.sqrt(vx0*vx0 + vy0*vy0 + vz0*vz0);
    pts.push([state[0], state[1], state[2], vAbs0]);

    const n = Math.ceil(maxT / dt);
    let prev = state.slice();
    let prevSpeed = vAbs0;

    for (let i=0;i<n;i++){
      prev = state.slice();
      state = rk4Step(state, dt, env);
      t += dt;

      const x = state[0], y = state[1], z = state[2];
      const vx = state[3], vy = state[4], vz = state[5];
      const spAbs = Math.sqrt(vx*vx + vy*vy + vz*vz);

      // downsample stored points (keeps rendering fast) but keep speed aligned
      if (i % 3 === 0) pts.push([x, y, z, spAbs]);

      // clip by horizontal distance
      const dx = x - gun[0];
      const dy = y - gun[1];
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (maxDist && dist > maxDist){
        pts.push([x, y, Math.max(0, z), spAbs]);
        return {points:pts, clipped:true};
      }

      // intersect ground (z=0)
      if (z <= 0 && t > 0){
        const zPrev = prev[2];
        const alpha = zPrev / (zPrev - z + 1e-12);
        const xi = prev[0] + (x - prev[0]) * alpha;
        const yi = prev[1] + (y - prev[1]) * alpha;
        // speed at intersection: linear blend is fine for display
        const vi = prevSpeed + (spAbs - prevSpeed) * alpha;
        pts.push([xi, yi, 0, vi]);
        return {points:pts, clipped:false};
      }

      prevSpeed = spAbs;
      if (spAbs < 8) break;
    }
    return {points:pts, clipped:true};
  }

  function pickStations(scene, stationSel){
    // Skeet 场景里站位类型可能是 "station8" 等；统一按前缀 station* 选择。
    const stations = scene.stations.filter(s=>String(s.type||"").startsWith("station"));
    if (!stationSel || stationSel === "all") return stations;
    const id = Number(stationSel);
    return stations.filter(s=>s.id === id);
  }

  function filterTrajectories(scene, enabled, active){
    const trs = scene.targets.trajectories || [];
    return trs.filter(tr=>{
      const gk = String(tr.groupId);
      const sk = String(tr.sourceId);
      if (active && active.groups && !active.groups.has(gk)) return false;
      if (active && active.sources && !active.sources.has(sk)) return false;
      if (enabled && enabled.groups && enabled.groups[gk] === false) return false;
      if (enabled && enabled.sources && enabled.sources[sk] === false) return false;
      return true;
    });
  }

  function mkCandidate(kind, st, tr, t, aim, imp, range){
    return {
      kind,
      stationId: st.id,
      stationLabel: `S${st.id}`,
      trajId: tr.id,
      sourceId: tr.sourceId,
      groupId: tr.groupId,
      table: tr.params && tr.params.table ? tr.params.table : null,
      t,
      aimAzDeg: rad2deg(aim.az),
      aimElDeg: rad2deg(aim.el),
      targetPos: aim.targetPos,
      impact: imp,
      range
    };
  }

  function makeShotKey(kind, stationId, trajId, t){
    const tt = (Number.isFinite(t) ? Number(t) : 0);
    return `${String(kind||"shot")}|S${stationId}|${String(trajId)}|t${tt.toFixed(3)}`;
  }

  function dedupeCandidates(cands){
    const out = [];
    const seen = new Set();
    for (const c of cands){
      const key = `${c.kind}|${c.stationId}|${c.trajId}|${Math.round(c.t*1000)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }

  async function computeAsync(scene, cfg, enabled, active, progressCb, cancelToken){
    const cplCfg = {
      station: cfg.cplStation || "all",
      t0: Number(cfg.cplT0 ?? 0.20),
      t1: Number(cfg.cplT1 ?? 2.20),
      dt: Number(cfg.cplDt ?? 0.05),
      adaptive: !!cfg.cplAdaptive,
      dtFine: Number(cfg.cplDtFine ?? 0.01),
      band: Number(cfg.cplBand ?? 0.20),

      // 时间采样模式：window=按射击窗口采样；manual=按手动时间点列表
      timeMode: (String(cfg.cplTimeMode || "window") === "manual") ? "manual" : "window",
      timesText: String(cfg.cplTimes || ""),

      preset: String(cfg.cplPreset || "default"),
      v0Mean: Number(cfg.cplShotV0 ?? 370),
      v0Sigma: Number(cfg.cplV0Sigma ?? 6),
      spreadElevSigmaDeg: Number(cfg.cplSpreadElevSigma ?? 1.2),
      spreadAzimSigmaDeg: Number(cfg.cplSpreadAzimSigma ?? 1.2),

      shotMassG: Number(cfg.cplShotMassG ?? 24),
      pelletDiaMM: Number(cfg.cplPelletDiaMM ?? 2.40),
      pelletDensity: Number(cfg.cplPelletDensity ?? 11340),

      rho: Number(cfg.cplRho ?? 1.225),
      cd: Number(cfg.cplCd ?? 0.47),
      windSpeed: Number(cfg.cplWindSpeed ?? 0),
      windDirDeg: Number(cfg.cplWindDirDeg ?? 90),

      ballDt: Number(cfg.cplBallDt ?? 0.01),
      maxT: Number(cfg.cplMaxTime ?? 8.0),
      nSamples: Number(cfg.cplNSamples ?? 3000),
      seed: Number(cfg.cplSeed ?? 12345),

      clipSector: !!cfg.cplClipSector,
      maxDist: 350.0
    };

    function parseTimeList(txt){
      if (!txt) return [];
      const raw = String(txt).split(/[\s,;]+/).map(s=>Number(s)).filter(n=>Number.isFinite(n));
      raw.sort((a,b)=>a-b);
      const out = [];
      for (const t of raw){
        if (!out.length || Math.abs(t - out[out.length-1]) > 1e-6) out.push(t);
      }
      return out;
    }

    const manualTimes = parseTimeList(cplCfg.timesText);
    cplCfg.timePoints = manualTimes;
    // 手动时间点模式：不做自适应加密，严格在这些时间点上评估
    if (cplCfg.timeMode === "manual") cplCfg.adaptive = false;

    const stations = pickStations(scene, cplCfg.station);
    const trajs = filterTrajectories(scene, enabled, active);

    // Trap 规则：对每个射击位，仅计算正对该射击位的 3 台靶机（同组 groupId==stationId）。
    // 说明：页面上仍可显示/开关所有靶轨，但“耦合/弹道计算”按比赛逻辑做站位过滤。
    function trajsForStation(st){
      if ((scene.meta && scene.meta.discipline) === "trap"){
        const sid = Number(st && st.id);
        return trajs.filter(tr => Number(tr.groupId) === sid);
      }
      return trajs;
    }

    if (!stations.length || !trajs.length) {
      return {ok:false, reason:"no stations or trajectories", cfg:cplCfg, impacts:[], hull:[], controls:[], critical:[], coneRays:[]};
    }

    if (cplCfg.timeMode === "manual" && (!manualTimes || manualTimes.length === 0)){
      return {ok:false, reason:"manual time points empty", cfg:cplCfg, impacts:[], hull:[], controls:[], critical:[], coneRays:[]};
    }

    const checkCancel = () => { if (cancelToken && cancelToken.cancelled) throw new Error("cancelled"); };
    const yieldEveryMs = 20;
    let lastYield = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const maybeYield = async () => {
      const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
      if (now - lastYield >= yieldEveryMs){
        await new Promise(r=>setTimeout(r, 0));
        lastYield = (typeof performance !== "undefined" ? performance.now() : Date.now());
      }
    };

    // Clamp window (manual 模式下仅用于展示/边界，不参与采样)
    const t0 = Math.max(0, Math.min(cplCfg.t0, cplCfg.t1));
    const t1 = Math.max(t0, cplCfg.t1);
    const dt = Math.max(0.005, cplCfg.dt);

    const env = {
      k: derivedDragK(cplCfg.rho, cplCfg.cd, cplCfg.pelletDiaMM, cplCfg.pelletDensity),
      wind: windVector(cplCfg.windSpeed, cplCfg.windDirDeg)
    };
    cplCfg.dragK = env.k;

    const padAz = deg2rad(Math.max(0, cplCfg.spreadAzimSigmaDeg)) * 3;
    const padEl = deg2rad(Math.max(0, cplCfg.spreadElevSigmaDeg)) * 3;

    // Monte Carlo impacts used for hull + visualization.
    // impacts: [[x,y,z], ...]
    // impactsMeta: [[stationId, azDeg, elDeg, v0], ...] aligned with impacts.
    const impacts = [];
    const impactsMeta = [];
    const byStation = new Map(); // stationId -> station state

    function ensureStation(st){
      if (!byStation.has(st.id)){
        byStation.set(st.id, {
          impacts2d: [],
          aims: [],
          best: { maxRange:null, maxDownrange:null, maxAbsX:null },
          aimExt: {has:false, minDAz:0, maxDAz:0, minEl:0, maxEl:0},
          rawAimCount: 0,
          usedTraj: new Set()
        });
      }
      return byStation.get(st.id);
    }

    // ----- Stage 1: build aim list + deterministic critical candidates -----
    if (progressCb) progressCb(0.02, "耦合：收集射击窗口内的可行瞄准方向…");

    let aimProcessed = 0;
    for (const st of stations){
      checkCancel();
      const S = ensureStation(st);
      const gun = st.gun;
      for (const tr of trajsForStation(st)){
        S.usedTraj.add(tr.id);
        const azTr = deg2rad(tr.params.azDeg);
        const elTr = deg2rad(tr.params.elDeg);
        const v0t = tr.params.v0;
        const vxy = v0t * Math.cos(elTr);
        const tMax = (tr.params.carry || 0) / (vxy + 1e-12);
        let times = [];
        if (cplCfg.timeMode === "manual"){
          // 只取轨迹有效时长内的时间点
          times = manualTimes.filter(t => t >= 0 && t <= tMax);
        } else {
          const tA = clamp(t0, 0, tMax);
          const tB = clamp(t1, 0, tMax);
          if (tB <= tA + 1e-9) continue;
          const nSteps = Math.max(1, Math.floor((tB - tA) / dt));
          for (let i=0;i<=nSteps;i++){
            times.push(tA + (tB - tA) * (i / nSteps));
          }
        }
        if (!times.length) continue;

        for (const t of times){
          checkCancel();
          const tp = targetPosAt(tr, t);
          if (tp[2] <= 0) continue;
          const aim = aimFromGunToPoint(gun, tp);
          if (cplCfg.clipSector && !inSector(scene, cfg, st, aim.az, aim.el)) continue;

          // record aim (store targetPos for manual-shot visualization)
          S.aims.push({az: aim.az, el: aim.el, t, trajId: tr.id, targetPos: tp});
          S.rawAimCount += 1;
          aimProcessed += 1;

          // shooting cone extents (include ~3σ dispersion padding)
          const ext = S.aimExt;
          const centerAz = stationCenterAzRad(scene, st);
          const dAz = normAngleRad(aim.az - centerAz);
          if (!ext.has){
            ext.minDAz = dAz - padAz; ext.maxDAz = dAz + padAz;
            ext.minEl = aim.el - padEl; ext.maxEl = aim.el + padEl;
            ext.has = true;
          } else {
            ext.minDAz = Math.min(ext.minDAz, dAz - padAz);
            ext.maxDAz = Math.max(ext.maxDAz, dAz + padAz);
            ext.minEl = Math.min(ext.minEl, aim.el - padEl);
            ext.maxEl = Math.max(ext.maxEl, aim.el + padEl);
          }

          // deterministic impact for control candidates (window mode only)
          if (cplCfg.timeMode !== "manual"){
            const impRes = integrateImpactPhysical(gun, aim.az, aim.el, cplCfg.v0Mean, env, cplCfg.ballDt, cplCfg.maxT, cplCfg.maxDist);
            if (impRes && impRes.impact){
              const imp = impRes.impact;
              const dx = imp[0] - gun[0];
              const dy = imp[1] - gun[1];
              const r = Math.sqrt(dx*dx + dy*dy);
              const absX = Math.abs(imp[0]);

              if (!S.best.maxRange || r > S.best.maxRange.range){
                S.best.maxRange = mkCandidate("maxRange", st, tr, t, {az:aim.az, el:aim.el, targetPos:tp}, imp, r);
              }
              if (!S.best.maxDownrange || imp[1] > S.best.maxDownrange.impact[1]){
                S.best.maxDownrange = mkCandidate("maxDownrange", st, tr, t, {az:aim.az, el:aim.el, targetPos:tp}, imp, r);
              }
              if (!S.best.maxAbsX || absX > Math.abs(S.best.maxAbsX.impact[0])){
                S.best.maxAbsX = mkCandidate("maxAbsX", st, tr, t, {az:aim.az, el:aim.el, targetPos:tp}, imp, r);
              }
            }
          }

          if ((aimProcessed % 150) === 0){
            if (progressCb){
              const p = Math.min(0.15, 0.02 + 0.13 * (aimProcessed / Math.max(1, (stations.length*trajs.length*40))));
              progressCb(p, `耦合：收集窗口瞄准方向…（${aimProcessed}）`);
            }
            await maybeYield();
          }
        }
      }
    }

    // 若所有站位均无可用 aim，直接返回（常见于手动时间点超出轨迹有效范围）
    let totalAims = 0;
    for (const [, S] of byStation) totalAims += (S.aims ? S.aims.length : 0);
    if (totalAims === 0){
      const reason = (cplCfg.timeMode === "manual") ? "no aims: manual time points out of trajectory range" : "no aims in window";
      return {ok:false, reason, cfg:cplCfg, impacts:[], hull:[], controls:[], critical:[], coneRays:[]};
    }

    // ----- Stage 1b: adaptive refine around critical times -----
    function refineCandidate(st, cand){
      if (!cand) return cand;
      const tr = trajs.find(t=>t.id === cand.trajId);
      if (!tr) return cand;
      const gun = st.gun;

      const azTr = deg2rad(tr.params.azDeg);
      const elTr = deg2rad(tr.params.elDeg);
      const v0t = tr.params.v0;
      const vxy = v0t * Math.cos(elTr);
      const tMax = (tr.params.carry || 0) / (vxy + 1e-12);

      const band = Math.max(0.05, cplCfg.band);
      const dtFine = Math.max(0.002, cplCfg.dtFine);

      const tA = clamp(cand.t - band, 0, tMax);
      const tB = clamp(cand.t + band, 0, tMax);
      if (tB <= tA + 1e-9) return cand;

      let best = cand;
      const nSteps = Math.max(2, Math.floor((tB - tA) / dtFine));
      for (let i=0;i<=nSteps;i++){
        const t = tA + (tB - tA) * (i / nSteps);
        const tp = targetPosAt(tr, t);
        if (tp[2] <= 0) continue;
        const aim = aimFromGunToPoint(gun, tp);
        if (cplCfg.clipSector && !inSector(scene, cfg, st, aim.az, aim.el)) continue;

        const impRes = integrateImpactPhysical(gun, aim.az, aim.el, cplCfg.v0Mean, env, cplCfg.ballDt, cplCfg.maxT, cplCfg.maxDist);
        if (!impRes || !impRes.impact) continue;
        const imp = impRes.impact;

        const dx = imp[0] - gun[0];
        const dy = imp[1] - gun[1];
        const r = Math.sqrt(dx*dx + dy*dy);
        const absX = Math.abs(imp[0]);

        if (best.kind === "maxRange" && r > best.range){
          best = mkCandidate(best.kind, st, tr, t, {az:aim.az, el:aim.el, targetPos:tp}, imp, r);
        }
        if (best.kind === "maxDownrange" && imp[1] > best.impact[1]){
          best = mkCandidate(best.kind, st, tr, t, {az:aim.az, el:aim.el, targetPos:tp}, imp, r);
        }
        if (best.kind === "maxAbsX" && absX > Math.abs(best.impact[0])){
          best = mkCandidate(best.kind, st, tr, t, {az:aim.az, el:aim.el, targetPos:tp}, imp, r);
        }
      }
      return best;
    }

    const controls = [];
    for (const st of stations){
      const S = byStation.get(st.id);
      if (!S) continue;
      let {maxRange, maxDownrange, maxAbsX} = S.best;
      if (cplCfg.adaptive){
        maxRange = refineCandidate(st, maxRange);
        maxDownrange = refineCandidate(st, maxDownrange);
        maxAbsX = refineCandidate(st, maxAbsX);
      }
      if (maxRange) controls.push(maxRange);
      if (maxDownrange) controls.push(maxDownrange);
      if (maxAbsX) controls.push(maxAbsX);
    }

    const controls2 = dedupeCandidates(controls);

    // ----- Stage 2: Monte Carlo sampling (dispersion + v0 sigma) -----
    const totalSamples = stations.reduce((acc, st)=>{
      const S = byStation.get(st.id);
      if (!S || !S.aims.length) return acc;
      return acc + Math.max(0, Math.round(cplCfg.nSamples));
    }, 0);

    let doneSamples = 0;
    if (progressCb) progressCb(0.16, totalSamples ? "耦合：蒙特卡洛采样弹道…" : "耦合：跳过采样（样本数为 0）");

    for (const st of stations){
      checkCancel();
      const S = byStation.get(st.id);
      if (!S || !S.aims.length) continue;

      const aims = S.aims;
      const nTotal = Math.max(0, Math.round(cplCfg.nSamples));
      if (nTotal <= 0) continue;

      const base = Math.floor(nTotal / aims.length);
      let rem = nTotal - base * aims.length;

      const rng = lcg((cplCfg.seed >>> 0) + (st.id * 1000003 >>> 0));
      const gun = st.gun;
      const centerAz = stationCenterAzRad(scene, st);
      const azHalf = deg2rad(Number(cfg.azHalf || 45));
      const elMin = deg2rad(Number(cfg.elMin || 10));
      const elMax = deg2rad(Number(cfg.elMax || 60));

      for (let i=0;i<aims.length;i++){
        checkCancel();
        const a = aims[i];
        let m = base;
        if (rem > 0){ m += 1; rem -= 1; }
        if (m <= 0) continue;

        for (let j=0;j<m;j++){
          // sample v0 and dispersion
          const v0 = Math.max(1, cplCfg.v0Mean + randN(rng) * cplCfg.v0Sigma);
          let az = a.az + deg2rad(randN(rng) * cplCfg.spreadAzimSigmaDeg);
          let el = a.el + deg2rad(randN(rng) * cplCfg.spreadElevSigmaDeg);

          if (cplCfg.clipSector){
            let dAz = normAngleRad(az - centerAz);
            dAz = clamp(dAz, -azHalf, azHalf);
            az = centerAz + dAz;
            el = clamp(el, elMin, elMax);
          }

          const impRes = integrateImpactPhysical(gun, az, el, v0, env, cplCfg.ballDt, cplCfg.maxT, cplCfg.maxDist);
          if (impRes && impRes.impact){
            const imp = impRes.impact;
            impacts.push(imp);
            impactsMeta.push([st.id, rad2deg(az), rad2deg(el), v0]);
            S.impacts2d.push([imp[0], imp[1]]);
          }

          doneSamples += 1;
          if ((doneSamples % 200) === 0){
            if (progressCb && totalSamples){
              const p = 0.16 + 0.80 * (doneSamples / totalSamples);
              progressCb(Math.min(0.96, p), `耦合：采样 ${doneSamples}/${totalSamples}`);
            }
            await maybeYield();
          }
        }
      }
    }

    // ----- Stage 3: trajectories for visualization -----
    if (progressCb) progressCb(0.97, "耦合：生成关键轨迹与包络…");

    const critical = [];
    if (cplCfg.timeMode === "manual"){
      // Manual mode: visualize ONLY the explicitly selected time points.
      // Build one deterministic shot for each (station, traj, time) aim.
      const seen = new Set();
      const maxShots = 240; // safety cap (rendering + compute)

      for (const st of stations){
        const S = byStation.get(st.id);
        if (!S || !S.aims || !S.aims.length) continue;
        const gun = st.gun;

        for (const a of S.aims){
          const key = `${st.id}|${String(a.trajId)}|${Number(a.t).toFixed(3)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const tr = trajs.find(t=>t.id === a.trajId);
          if (!tr) continue;
          const tp = a.targetPos || targetPosAt(tr, a.t);
          if (!tp || tp[2] <= 0) continue;

          const res = integrateTrajectoryPhysical(gun, a.az, a.el, cplCfg.v0Mean, env, cplCfg.ballDt, cplCfg.maxT, cplCfg.maxDist);
          const last = (res && res.points && res.points.length) ? res.points[res.points.length-1] : null;
          const imp = last ? [last[0], last[1], Math.max(0, last[2])] : null;
          if (!imp) continue;

          const dx = imp[0] - gun[0];
          const dy = imp[1] - gun[1];
          const r = Math.sqrt(dx*dx + dy*dy);

          critical.push({
            kind: "manual",
            shotKey: makeShotKey("manual", st.id, tr.id, a.t),
            stationId: st.id,
            trajId: tr.id,
            sourceId: tr.sourceId,
            groupId: tr.groupId,
            t: a.t,
            aimAzDeg: rad2deg(a.az),
            aimElDeg: rad2deg(a.el),
            gun: gun,
            targetPos: tp,
            impact: imp,
            range: r,
            clipped: !!res.clipped,
            points: res.points
          });

          if (critical.length >= maxShots) break;
        }
        if (critical.length >= maxShots) break;
      }
    }else{
      // Window mode: visualize control candidates.
      for (const c of controls2){
        const st = stations.find(s=>s.id===c.stationId);
        const tr = trajs.find(t=>t.id===c.trajId);
        if (!st || !tr) continue;
        const gun = st.gun;
        const aim = aimFromGunToPoint(gun, c.targetPos);
        const res = integrateTrajectoryPhysical(gun, aim.az, aim.el, cplCfg.v0Mean, env, cplCfg.ballDt, cplCfg.maxT, cplCfg.maxDist);
        critical.push({
          kind: c.kind,
          shotKey: makeShotKey(c.kind, c.stationId, c.trajId, c.t),
          stationId: c.stationId,
          trajId: c.trajId,
          sourceId: c.sourceId,
          groupId: c.groupId,
          t: c.t,
          aimAzDeg: c.aimAzDeg,
          aimElDeg: c.aimElDeg,
          gun: gun,
          targetPos: c.targetPos,
          impact: c.impact,
          range: c.range,
          clipped: !!res.clipped,
          points: res.points
        });
      }
    }

    // Hull
    const hullInput = impacts.length ? impacts : controls2.map(c=>c.impact).filter(Boolean);
    const pts2d = hullInput.map(p=>[p[0], p[1]]);
    const hull2d = convexHull2D(pts2d);
    const hullArea = polygonArea2D(hull2d);
    const hull3d = hull2d.map(p=>[p[0], p[1], 0]);
    const bb = bboxOf(hullInput.length ? hullInput : [[0,0,0],[1,1,0]]);

    // Limit exported impact points
    const maxImp = 5000;
    let impactsOut = impacts;
    let impactsMetaOut = impactsMeta;
    if (impacts.length > maxImp){
      const stride = Math.ceil(impacts.length / maxImp);
      impactsOut = impacts.filter((_,i)=> i % stride === 0);
      impactsMetaOut = impactsMeta.filter((_,i)=> i % stride === 0);
    }

    // Shooting cone boundary rays
    const coneRays = [];
    const rayLen = 60.0;
    for (const st of stations){
      const S = byStation.get(st.id);
      if (!S || !S.aimExt || !S.aimExt.has) continue;
      const ext = S.aimExt;
      const centerAz = stationCenterAzRad(scene, st);
      const azs = [centerAz + ext.minDAz, centerAz + ext.maxDAz];
      const els = [ext.minEl, ext.maxEl];

      for (const az of azs){
        for (const el of els){
          const dir = [Math.sin(az)*Math.cos(el), Math.cos(az)*Math.cos(el), Math.sin(el)];
          const end = [st.gun[0] + dir[0]*rayLen, st.gun[1] + dir[1]*rayLen, st.gun[2] + dir[2]*rayLen];
          coneRays.push({stationId: st.id, azDeg: rad2deg(az), elDeg: rad2deg(el), points:[st.gun, end]});
        }
      }

      const elc = (ext.minEl + ext.maxEl) * 0.5;
      const dirc = [Math.sin(centerAz)*Math.cos(elc), Math.cos(centerAz)*Math.cos(elc), Math.sin(elc)];
      const endc = [st.gun[0] + dirc[0]*rayLen, st.gun[1] + dirc[1]*rayLen, st.gun[2] + dirc[2]*rayLen];
      coneRays.push({stationId: st.id, azDeg: rad2deg(centerAz), elDeg: rad2deg(elc), points:[st.gun, endc], center:true});
    }

    if (progressCb) progressCb(1.0, "耦合：完成");

    return {
      ok:true,
      cfg:cplCfg,
      stationCount: stations.length,
      trajCount: trajs.length,
      sampleCount: impacts.length,
      impacts: impactsOut,
      impactsMeta: impactsMetaOut,
      hull: hull3d,
      hullArea,
      bbox: bb,
      controls: controls2,
      critical,
      coneRays
    };
  }

  function compute(scene, cfg, enabled, active){
    return computeAsync(scene, cfg, enabled, active);
  }

  // Utility for visualization: given gun position and shot angles/speed, recompute a single
  // ballistic trajectory using the same physical model as coupling.
  // Used for hover-to-trajectory when hovering a Monte Carlo impact point.
  function traceShot(gun, azDeg, elDeg, v0, cfg){
    if (!gun || gun.length < 3) return null;
    const c = cfg || {};
    const rho = Number(c.rho);
    const cd = Number(c.cd);
    const dia = Number(c.pelletDiaMM);
    const den = Number(c.pelletDensity);
    const env = {
      k: derivedDragK(Number.isFinite(rho)?rho:1.225, Number.isFinite(cd)?cd:0.45, Number.isFinite(dia)?dia:2.4, Number.isFinite(den)?den:11340),
      wind: windVector(Number(c.windSpeed||0), Number(c.windDirDeg||0))
    };
    const dt = Number(c.ballDt || 0.01);
    const maxT = Number(c.maxT || 8.0);
    const maxDist = Number(c.maxDist || 350.0);
    const az = deg2rad(Number(azDeg||0));
    const el = deg2rad(Number(elDeg||0));
    const vv0 = Number(v0);
    if (!Number.isFinite(vv0) || vv0 <= 0) return null;
    const res = integrateTrajectoryPhysical(gun, az, el, vv0, env, dt, maxT, maxDist);
    return (res && res.points) ? res.points : null;
  }

  global.Coupling = {computeAsync, compute, traceShot};
})(window);
