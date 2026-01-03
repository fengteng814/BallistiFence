(function(global){
  const {clamp, rad2deg, sampleRange} = global.U;
  const {solveGeneric2Point, genTrajectory} = global.Phys;

  function buildSkeetScene(cfg){
    const R = 19.2, chord = 36.8, h = 5.5;
    const gunH = cfg.gunH;
    const yChord = +h;

    const chordStep = 8.13;
    const dTheta = 2*Math.asin(chordStep/(2*R));
    const theta0 = Math.asin(yChord/R);
    const thetaStart = (Math.PI - theta0);
    const thetas = Array.from({length:7}, (_,i)=> thetaStart - i*dTheta);

    let rawStations = thetas.map((th,i)=> {
      const x = R*Math.cos(th);
      const y = R*Math.sin(th);
      return {id:i+1, type:"station", pos:[x,y,0], gun:[x,y,gunH]};
    });

    const p1 = rawStations[0].pos, p7 = rawStations[6].pos;
    const v = [p7[0]-p1[0], p7[1]-p1[1]];
    const lenv = Math.hypot(v[0], v[1]);
    const ang = Math.atan2(v[1]/lenv, v[0]/lenv);
    const rot = -ang;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    function rot2(x,y){ return [x*cosR - y*sinR, x*sinR + y*cosR]; }

    const p1r = rot2(p1[0], p1[1]);
    const dy = yChord - p1r[1];

    const stations = rawStations.map(s=>{
      const pr = rot2(s.pos[0], s.pos[1]);
      const gr = rot2(s.gun[0], s.gun[1]);
      return { id:s.id, type:"station", pos:[pr[0], pr[1]+dy, 0], gun:[gr[0], gr[1]+dy, gunH] };
    });

    const s8 = {id:8, type:"station8", pos:[0, yChord, 0], gun:[0, yChord, gunH]};
    stations.push(s8);

    const st1 = stations.find(s=>s.id===1).pos;
    const st7 = stations.find(s=>s.id===7).pos;
    const highRelease = [st1[0] - 0.9, st1[1], 3.05];
    const lowRelease  = [st7[0] + 0.9, st7[1] + 0.75, 1.05];

    const machines = [
      {id:"H", type:"high_house", pos:[st1[0] - 1.6, st1[1], 0], release: highRelease},
      {id:"L", type:"low_house",  pos:[st7[0] + 1.6, st7[1], 0], release: lowRelease},
      {id:"CROSS", type:"cross_point", pos:[0, 0, cfg.skeetCrossZ]}
    ];

    const zCross = cfg.skeetCrossZ;
    const dEnd = cfg.skeetCarry;
    const onlyEnvelope = cfg.onlyEnvelope;
    const nSamp = clamp(cfg.samplesPerSource, 1, 60);
    const stepM = cfg.stepM;

    function buildSkeetTraj(p0, zC){
      const dx = -p0[0], dy2 = -p0[1];
      const az = Math.atan2(dx, dy2);
      const dCross = Math.hypot(dx, dy2);
      const {v0, el} = solveGeneric2Point(p0[2], dCross, zC, dEnd, 0);
      const pts = genTrajectory(p0, az, v0, el, dEnd, stepM);
      return {az, dCross, v0, el, pts};
    }

    const trajectories = [];
    const sources = [{id:"H", release: highRelease},{id:"L", release: lowRelease}];
    const zPert = onlyEnvelope ? [0] : sampleRange(-0.25, 0.25, nSamp, false);

    for (const src of sources){
      for (let i=0;i<(onlyEnvelope?1:nSamp);i++){
        const zC = zCross + (onlyEnvelope?0:zPert[i]);
        const {az, dCross, v0, el, pts} = buildSkeetTraj(src.release, zC);
        trajectories.push({
          id:`skeet_${src.id}_${i+1}`,
          sourceId: src.id,
          groupId: src.id,
          kind:"skeet_target",
          params:{azDeg:rad2deg(az), crossDist:dCross, crossZ:zC, v0, elDeg:rad2deg(el), carry:dEnd},
          points: pts
        });
      }
    }

    const sector = { azHalfDeg: cfg.azHalf, elMinDeg: cfg.elMin, elMaxDeg: cfg.elMax, centerAzDeg: null };

    return {
      meta:{ discipline:"skeet", units:"m", axes:{x:"lateral", y:"field_forward", z:"up"},
            notes:"Skeet：几何按 R=19.2/chord=36.8/center->chord=5.5 构造；靶轨为无阻力抛体反算。靶屋出现点偏移为简化实现。" },
      stations, machines, sector, targets:{trajectories}
    };
  }

  global.SceneSkeet = {buildSkeetScene};
})(window);
