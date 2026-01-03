(function(global){
  const {clamp, deg2rad, rad2deg, sampleRange} = global.U;
  const {solveTrap2Point, genTrajectory} = global.Phys;

  function buildTrapScene(cfg){
    const stationSpacing = 3.15;
    const pitFrontY = 15.0;
    const gunH = cfg.gunH;

    const stations = [];
    for (let i=1;i<=5;i++){
      const x = (i-3) * stationSpacing;
      stations.push({ id:i, type:"station", pos:[x, 0, 0], gun:[x, 0, gunH] });
    }

    const groupSpacing = 3.15;
    const within = 1.05;
    const groupCenters = [-2,-1,0,1,2].map(k => k*groupSpacing);
    const machines = [];
    let idx = 1;
    for (let g=0; g<5; g++){
      const cx = groupCenters[g];
      const xs = [cx-within, cx, cx+within];
      for (const mx of xs){
        machines.push({ id: idx, type:"trap_machine", group: g+1, pos: [mx, pitFrontY + 0.5, 0] });
        idx++;
      }
    }

    const h10Min = cfg.trapH10Min, h10Max = cfg.trapH10Max;
    const azMaxDeg = cfg.trapAzMax;
    const dEnd = cfg.trapCarry;

    const onlyEnvelope = cfg.onlyEnvelope;
    const nSamp = clamp(cfg.samplesPerSource, 1, 60);
    const stepM = cfg.stepM;

    // ISSF Trap Setting Tables (I-IX): each of 15 machines has fixed direction + height at 10m.
    const tableKey = (cfg.trapTable || "I");
    const table = (global.TrapTables && global.TrapTables.get) ? global.TrapTables.get(tableKey) : null;
    const useSettingTable = (cfg.profile !== "envelope") && !!table;

    const trajectories = [];
    for (const m of machines){
      if (useSettingTable){
        const rec = table[m.id-1];
        const az = deg2rad(rec.azDeg);
        const h10 = rec.h10;
        const {v0, el} = solveTrap2Point(10.0, h10, dEnd);
        const pts = genTrajectory(m.pos, az, v0, el, dEnd, stepM);
        trajectories.push({
          id:`trap_${tableKey}_m${m.id}`,
          sourceId: m.id,
          groupId: m.group,
          kind:"trap_target",
          params:{table:tableKey, azDeg:rec.azDeg, h10, v0, elDeg:rad2deg(el), carry:dEnd},
          points: pts
        });
      }else{
        const azs = sampleRange(-deg2rad(azMaxDeg), deg2rad(azMaxDeg), onlyEnvelope ? 2 : nSamp, true);
        const hs  = sampleRange(h10Min, h10Max, onlyEnvelope ? 2 : nSamp, true);
        const take = onlyEnvelope ? [[azs[0], hs[0]],[azs[azs.length-1], hs[hs.length-1]]] :
                                    azs.map((az,i)=> [az, hs[i % hs.length]]);
        for (let k=0;k<take.length;k++){
          const [az, h10] = take[k];
          const {v0, el} = solveTrap2Point(10.0, h10, dEnd);
          const pts = genTrajectory(m.pos, az, v0, el, dEnd, stepM);
          trajectories.push({
            id:`trap_m${m.id}_${k+1}`,
            sourceId: m.id,
            groupId: m.group,
            kind:"trap_target",
            params:{azDeg:rad2deg(az), h10, v0, elDeg:rad2deg(el), carry:dEnd},
            points: pts
          });
        }
      }
    }


    const sector = { azHalfDeg: cfg.azHalf, elMinDeg: cfg.elMin, elMaxDeg: cfg.elMax, centerAzDeg: 0 };

    return {
      meta:{ discipline:"trap", units:"m", axes:{x:"lateral", y:"downrange", z:"up"},
            notes:"Trap：Station3 为原点；靶轨由设定窗口反算生成（无阻力抛体）。" },
      stations, machines, sector, targets:{trajectories}
    };
  }

  global.SceneTrap = {buildTrapScene};
})(window);
