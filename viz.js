(function(global){
  const {bboxOf, deg2rad, rad2deg} = global.U;

  function squareTrace(center, size){
    const s = size/2;
    const x0=center[0], y0=center[1], z0=center[2];
    const xs = [x0-s, x0+s, x0+s, x0-s, x0-s];
    const ys = [y0-s, y0-s, y0+s, y0+s, y0-s];
    const zs = [z0, z0, z0, z0, z0];
    return {type:"scatter3d", mode:"lines", x:xs, y:ys, z:zs, hoverinfo:"skip", showlegend:false};
  }

  function sectorRays(gun, centerAzDeg, azHalfDeg, elMinDeg, elMaxDeg, len){
    const rays = [];
    const az0 = deg2rad(centerAzDeg ?? 0);
    const azs = [az0-deg2rad(azHalfDeg), az0+deg2rad(azHalfDeg)];
    const els = [deg2rad(elMinDeg), deg2rad(elMaxDeg)];
    for (const az of azs){
      for (const el of els){
        const dx = Math.sin(az)*Math.cos(el);
        const dy = Math.cos(az)*Math.cos(el);
        const dz = Math.sin(el);
        rays.push({x:[gun[0], gun[0]+dx*len], y:[gun[1], gun[1]+dy*len], z:[gun[2], gun[2]+dz*len]});
      }
    }
    return rays;
  }

  function sceneToTraces(scene, cfg, enabled, active, coupling){
    const traces = [];
    const allPts = [];

    if (cfg.showStations){
      for (const s of scene.stations){
        allPts.push(s.pos); allPts.push(s.gun);
        traces.push(squareTrace(s.pos, s.id===8?1.85:1.0));
      }
      traces.push({
        type:"scatter3d", mode:"markers+text",
        x:scene.stations.map(s=>s.pos[0]),
        y:scene.stations.map(s=>s.pos[1]),
        z:scene.stations.map(s=>s.pos[2]),
        text:scene.stations.map(s=>String(s.id)),
        textposition:"top center",
        hovertext:scene.stations.map(s=>`${s.type==="waiting"?"等待位":"Station"} ${s.id}`),
        hoverinfo:"text",
        showlegend:false
      });
      traces.push({
        type:"scatter3d", mode:"markers",
        x:scene.stations.map(s=>s.gun[0]),
        y:scene.stations.map(s=>s.gun[1]),
        z:scene.stations.map(s=>s.gun[2]),
        hoverinfo:"skip",
        showlegend:false
      });
    }

    if (cfg.showSectors){
      const len = (scene.meta.discipline==="trap") ? 35 : 30;
      for (const s of scene.stations){
        let centerAz = 0;
        if (scene.meta.discipline==="skeet"){
          const dx = -s.gun[0], dy = -s.gun[1];
          centerAz = rad2deg(Math.atan2(dx, dy));
        }
        const rays = sectorRays(s.gun, centerAz, cfg.azHalf, cfg.elMin, cfg.elMax, len);
        for (const r of rays){
          traces.push({type:"scatter3d", mode:"lines", x:r.x, y:r.y, z:r.z, hoverinfo:"skip", showlegend:false});
        }
      }
    }

    if (cfg.showMachines){
      const ms = scene.machines.filter(m => m.type !== "cross_point");
      const shown = ms.filter(m=>{
        const gKey = String(m.group ?? m.id);
        const sKey = String(m.id);
        if (active?.groups && !active.groups.has(gKey)) return false;
        if (active?.sources && !active.sources.has(sKey)) return false;
        return true;
      });
      for (const m of shown){
        allPts.push(m.pos);
        if (m.release) allPts.push(m.release);
      }

      if (shown.length){
        traces.push({
          type:"scatter3d", mode:"markers+text",
          x:shown.map(m=>m.pos[0]),
          y:shown.map(m=>m.pos[1]),
          z:shown.map(m=>m.pos[2]),
          text:shown.map(m=> m.type==="trap_machine"? String(m.id): (m.id||"")),
          textposition:"top center",
          hovertext:shown.map(m=>{
            if (m.type==="trap_machine") return `Trap Machine ${m.id} (G${m.group})`;
            if (m.type==="high_house") return "High House";
            if (m.type==="low_house") return "Low House";
            return String(m.id);
          }),
          hoverinfo:"text",
          showlegend:false
        });

        const rel = shown.filter(m=>m.release);
        if (rel.length){
          traces.push({
            type:"scatter3d", mode:"markers",
            x:rel.map(m=>m.release[0]), y:rel.map(m=>m.release[1]), z:rel.map(m=>m.release[2]),
            hovertext:rel.map(m=>`${m.id} release z=${m.release[2]}`),
            hoverinfo:"text",
            showlegend:false
          });
        }
      }
    }

    if (cfg.showTraj){
      for (const tr of scene.targets.trajectories){
        const gKey = String(tr.groupId ?? tr.sourceId);
        const sKey = String(tr.sourceId);
        if (active?.groups && !active.groups.has(gKey)) continue;
        if (active?.sources && !active.sources.has(sKey)) continue;

        if (enabled?.groups && enabled.groups[gKey] === false) continue;
        if (enabled?.sources && enabled.sources[sKey] === false) continue;

        for (const p of tr.points) allPts.push(p);
        traces.push({
          type:"scatter3d", mode:"lines",
          x:tr.points.map(p=>p[0]),
          y:tr.points.map(p=>p[1]),
          z:tr.points.map(p=>p[2]),
          hoverinfo:"text",
          hovertext: tr.points.map(()=>"靶轨"),
          // customdata schema for HUD: [kind, table, groupId, sourceId, azDeg, h10, carry, v0, elDeg]
          customdata: tr.points.map(()=>[
            tr.kind || "",
            tr.params?.table || "",
            tr.groupId ?? "",
            tr.sourceId ?? "",
            (tr.params?.azDeg ?? ""),
            (tr.params?.h10 ?? ""),
            (tr.params?.carry ?? ""),
            (tr.params?.v0 ?? ""),
            (tr.params?.elDeg ?? "")
          ]),
          hovertemplate:"<extra></extra>",
          showlegend:false
        });
      }
    }


    // ---- Coupling overlay (shooting cone -> ballistic family -> impact zone) ----
    if (coupling && coupling.ok && cfg.cplEnable){

      // Shooting cone boundary rays
      if (cfg.cplShowCone && coupling.coneRays && coupling.coneRays.length){
        for (const r of coupling.coneRays){
          const xs = r.points.map(p=>p[0]);
          const ys = r.points.map(p=>p[1]);
          const zs = r.points.map(p=>p[2]);
          for (const p of r.points) allPts.push(p);
          traces.push({
            type:"scatter3d", mode:"lines",
            x:xs, y:ys, z:zs,
            line:{width:2, dash: r.center ? "solid" : "dot"},
            name:`射击锥 S${r.stationId}`,
            hoverinfo:"none",
            hovertemplate:"<extra></extra>",
            showlegend:false
          });
        }
      }

      // Impact points (Monte Carlo samples). We attach per-point metadata so
      // hovering an impact can reconstruct its ballistic trajectory.
      if (cfg.cplShowImpacts && coupling.impacts && coupling.impacts.length){
        const xs = coupling.impacts.map(p=>p[0]);
        const ys = coupling.impacts.map(p=>p[1]);
        const zs = coupling.impacts.map(p=>p[2] ?? 0);
        for (const p of coupling.impacts) allPts.push(p);

        // customdata: [tag, stationId, azDeg, elDeg, v0]
        let cds = null;
        if (coupling.impactsMeta && Array.isArray(coupling.impactsMeta) && coupling.impactsMeta.length === coupling.impacts.length){
          cds = coupling.impactsMeta.map(m=>["mcImpact", m[0], m[1], m[2], m[3]]);
        }
        traces.push({
          type:"scatter3d", mode:"markers",
          x:xs, y:ys, z:zs,
          marker:{size:2},
          name:"落弹点（抽样）",
          customdata: cds,
          hoverinfo:"text",
          hovertext: cds ? cds.map(()=>"落弹点（抽样）") : undefined,
          hovertemplate:"<extra></extra>",
          showlegend:false
        });
      }

      // Deterministic impact points for shown shots (hover enabled; used for hover-to-trajectory)
      if (cfg.cplShowImpacts && coupling.critical && coupling.critical.length){
        const dxs = [], dys = [], dzs = [], dcd = [];
        for (const c of coupling.critical){
          if (!c || !c.impact || !c.shotKey) continue;
          dxs.push(c.impact[0]);
          dys.push(c.impact[1]);
          dzs.push(c.impact[2] ?? 0);
          dcd.push(["shotImpact", c.shotKey, c.kind, c.stationId, c.trajId, c.t, c.aimAzDeg, c.aimElDeg, c.range]);
        }
        if (dxs.length){
          traces.push({
            type:"scatter3d", mode:"markers",
            x:dxs, y:dys, z:dzs,
            marker:{size:6, symbol:"circle"},
            name:"落弹点（可追溯）",
            customdata:dcd,
            hoverinfo:"text",
            hovertext: dcd.map(()=>"落弹点"),
            hovertemplate:"<extra></extra>",
            showlegend:false
          });
        }
      }

      // Impact hull (envelope)
      if (cfg.cplShowHull && coupling.hull && coupling.hull.length >= 3){
        const hull = coupling.hull.concat([coupling.hull[0]]);
        const xs = hull.map(p=>p[0]);
        const ys = hull.map(p=>p[1]);
        const zs = hull.map(_=>0);
        for (const p of hull) allPts.push(p);
        traces.push({
          type:"scatter3d", mode:"lines",
          x:xs, y:ys, z:zs,
          line:{width:4},
          name:"落弹包络",
          hoverinfo:"none",
          hovertemplate:"<extra></extra>",
          showlegend:false
        });
      }

      // Critical ballistic trajectories
      if (cfg.cplShowCritical && coupling.critical && coupling.critical.length){
        const hitXs = [], hitYs = [], hitZs = [], hitCd = [];
        for (const c of coupling.critical){
          const xs = c.points.map(p=>p[0]);
          const ys = c.points.map(p=>p[1]);
          const zs = c.points.map(p=>p[2]);

          // Per-point customdata schema for HUD:
          // [role, shotKey, kind, stationId, trajId, t, aimAzDeg, aimElDeg, range, impactX, impactY, speed, dist]
          const cds = c.points.map(p=>{
            const sp = (p && p.length >= 4) ? p[3] : null;
            const dx = p[0] - c.gun[0];
            const dy = p[1] - c.gun[1];
            const d  = Math.sqrt(dx*dx + dy*dy);
            return ["ballistic", c.shotKey || "", c.kind, c.stationId, c.trajId, c.t, c.aimAzDeg, c.aimElDeg, c.range, c.impact[0], c.impact[1], sp, d];
          });

          for (const p of c.points) allPts.push(p);

          const kindLabel = (c.kind === "manual") ? "手动" : (c.kind === "maxRange") ? "最大射程" : (c.kind === "maxDownrange") ? "最大前向" : (c.kind === "maxAbsX") ? "最大侧向" : String(c.kind||"");
          traces.push({
            type:"scatter3d", mode:"lines",
            x:xs, y:ys, z:zs,
            line:{width:5},
            name:`弹道 ${kindLabel} S${c.stationId}`,
            customdata: cds,
            meta:{
              role:"ballistic",
              shotKey: c.shotKey || "",
              kind:c.kind,
              stationId:c.stationId,
              trajId:c.trajId,
              t:c.t,
              aimAzDeg:c.aimAzDeg,
              aimElDeg:c.aimElDeg,
              range:c.range,
              impactX:c.impact[0],
              impactY:c.impact[1]
            },
            hoverinfo:"text",
            hovertext: cds.map(()=>"弹道"),
            hovertemplate:"<extra></extra>",
            showlegend:false
          });

          // Key ray (shooting cone) from gun to target point
          if (cfg.cplShowCone){
            const rxs = [c.gun[0], c.targetPos[0]];
            const rys = [c.gun[1], c.targetPos[1]];
            const rzs = [c.gun[2], c.targetPos[2]];
            traces.push({
              type:"scatter3d", mode:"lines",
              x:rxs, y:rys, z:rzs,
              line:{width:2, dash:"dot"},
              hoverinfo:"skip",
              showlegend:false
            });
          }

          // Hit point on target track (intersection of aim ray and target trajectory at time t)
          if (c.targetPos && Array.isArray(c.targetPos) && c.targetPos.length >= 3){
            hitXs.push(c.targetPos[0]);
            hitYs.push(c.targetPos[1]);
            hitZs.push(c.targetPos[2]);
            hitCd.push(["hit", c.shotKey || "", c.kind, c.stationId, c.trajId, c.t, c.aimAzDeg, c.aimElDeg]);
            allPts.push(c.targetPos);
          }
        }

        if (hitXs.length){
          traces.push({
            type:"scatter3d",
            mode:"markers",
            x: hitXs,
            y: hitYs,
            z: hitZs,
            marker:{size:7, symbol:"circle"},
            name:"命中点",
            customdata: hitCd,
            hoverinfo:"text",
            hovertext: hitCd.map(()=>"命中点"),
            hovertemplate:"<extra></extra>",
            showlegend:false
          });
        }
      }
    }


    // hover marker (updated by plotly_hover events)
    traces.push({
      type:"scatter3d",
      mode:"markers",
      name:"__hover_marker__",
      x:[],
      y:[],
      z:[],
      marker:{size:7, symbol:"circle"},
      hoverinfo:"skip",
      showlegend:false,
      visible:false
    });

    // hover-selected ballistic trajectory (shown when hovering a deterministic impact point)
    traces.push({
      type:"scatter3d",
      mode:"lines",
      name:"__hover_shot__",
      x:[],
      y:[],
      z:[],
      line:{width:7},
      hoverinfo:"skip",
      showlegend:false,
      visible:false
    });

    const bb = bboxOf(allPts.length?allPts:[[0,0,0],[1,1,1]]);
    return {traces, bbox:bb};
  }

  

  function sceneBbox(scene, cfg, active, coupling){
    const allPts = [];
    // stations
    for (const s of scene.stations){
      allPts.push(s.pos);
      allPts.push(s.gun);
    }
    // machines (within active)
    for (const m of scene.machines.filter(m => m.type !== "cross_point")){
      const gKey = String(m.group ?? m.id);
      const sKey = String(m.id);
      if (active?.groups && !active.groups.has(gKey)) continue;
      if (active?.sources && !active.sources.has(sKey)) continue;
      allPts.push(m.pos);
      if (m.release) allPts.push(m.release);
    }
    // trajectories (within active)
    for (const tr of scene.targets.trajectories){
      const gKey = String(tr.groupId ?? tr.sourceId);
      const sKey = String(tr.sourceId);
      if (active?.groups && !active.groups.has(gKey)) continue;
      if (active?.sources && !active.sources.has(sKey)) continue;
      for (const p of tr.points) allPts.push(p);
    }
    // sector endpoints (so turning on/off "扇域" does not change axes)
    const len = (scene.meta.discipline==="trap") ? 35 : 30;
    for (const s of scene.stations){
      let centerAz = 0;
      if (scene.meta.discipline==="skeet"){
        const dx = -s.gun[0], dy = -s.gun[1];
        centerAz = rad2deg(Math.atan2(dx, dy));
      }
      const az0 = deg2rad(centerAz ?? 0);
      const azs = [az0-deg2rad(cfg.azHalf), az0+deg2rad(cfg.azHalf)];
      const els = [deg2rad(cfg.elMin), deg2rad(cfg.elMax)];
      for (const az of azs){
        for (const el of els){
          const dx = Math.sin(az)*Math.cos(el);
          const dy = Math.cos(az)*Math.cos(el);
          const dz = Math.sin(el);
          allPts.push([s.gun[0]+dx*len, s.gun[1]+dy*len, s.gun[2]+dz*len]);
        }
      }
    }
    
    // coupling impacts/hull endpoints (for stable axes when coupling enabled)
    if (coupling && coupling.ok && cfg.cplEnable){

      // 注意：sceneBbox 仅用于收集点以稳定坐标轴范围，不应创建 traces。
      // 射击锥/关键弹道/落弹包络的绘制在 sceneToTraces 中完成。

      if (coupling.impacts){
        for (const p of coupling.impacts) allPts.push(p);
      }
      if (coupling.hull){
        for (const p of coupling.hull) allPts.push(p);
      }
      if (coupling.critical){
        for (const c of coupling.critical){
          if (c.points) for (const p of c.points) allPts.push(p);
        }
      }
      if (coupling.coneRays){
        for (const r of coupling.coneRays){
          if (r.points) for (const p of r.points) allPts.push(p);
        }
      }
    }

return bboxOf(allPts.length?allPts:[[0,0,0],[1,1,1]]);
  }


  function bindHoverMarker(plotDiv){
    if (!plotDiv || plotDiv.__hoverMarkerBound) return;
    plotDiv.__hoverMarkerBound = true;

    // NOTE: HUD is implemented as a Plotly annotation (native), not an external HTML overlay.

    function getHoverTraceIndex(){
      if (!plotDiv.data) return -1;
      for (let i = plotDiv.data.length - 1; i >= 0; i--){
        const t = plotDiv.data[i];
        if (t && t.name === "__hover_marker__") return i;
      }
      return -1;
    }

    function pickPoint(evt){
      if (!evt || !evt.points || !evt.points.length) return null;
      for (const p of evt.points){
        if (p && p.data && p.data.name === "__hover_marker__") continue;
        return p;
      }
      return evt.points[0] || null;
    }

    function getHudIndex(){
      const anns = (plotDiv.layout && plotDiv.layout.annotations) ? plotDiv.layout.annotations : null;
      if (!anns || !anns.length) return -1;
      return 0; // buildLayout installs a single HUD annotation at index 0
    }

    function setHudText(htmlText){
      const i = getHudIndex();
      if (i < 0) return;
      Plotly.relayout(plotDiv, {[`annotations[${i}].text`]: htmlText});
    }

    // Plotly hover events are not always consistent about exposing per-point customdata
    // on scatter3d lines/markers across builds. Use a robust accessor.
    function getCustomdata(p){
      if (!p) return null;
      if (typeof p.customdata !== "undefined") return p.customdata;
      const pn = (typeof p.pointNumber !== "undefined") ? p.pointNumber : null;
      const d = p.data || null;
      const fd = p.fullData || null;
      const arr = (d && d.customdata) ? d.customdata : (fd && fd.customdata) ? fd.customdata : null;
      if (arr && pn !== null && typeof arr[pn] !== "undefined") return arr[pn];
      return null;
    }

    function fmt(n, d){
      if (n === null || typeof n === "undefined" || Number.isNaN(n)) return "-";
      const k = (typeof d === "number") ? d : 2;
      return Number(n).toFixed(k);
    }
    function hudTextForPoint(p){
      const cd = getCustomdata(p);
      const fd = p ? p.fullData : null;

      // defaults
      let title = (fd && fd.name) ? fd.name : "-";
      let line1 = "-";
      let line2 = "-";
      let line3 = "-";

      if (cd && Array.isArray(cd) && cd.length){
        const tag = cd[0];

        if (tag === "trap_target" || tag === "skeet_target"){
          // [kind, table, groupId, sourceId, azDeg, h10, carry, v0, elDeg]
          const table = cd[1], group = cd[2], src = cd[3];
          const az = cd[4], h10 = cd[5], carry = cd[6];
          const v0 = cd[7], el = cd[8];
          title = "靶轨";
          line1 = `${table ? ("表" + table + "  ") : ""}组${group}  源#${src}`;
          line2 = `Az=${fmt(az,1)}°  El=${fmt(el,1)}°  v0=${fmt(v0,0)} m/s`;
          line3 = `H10=${fmt(h10,2)} m  carry=${fmt(carry,1)} m`;
        } else if (tag === "hit"){
          // [hit, shotKey, kind, stationId, trajId, t, aimAzDeg, aimElDeg]
          const kind = cd[2], station = cd[3], traj = cd[4], tt = cd[5];
          const az = cd[6], el = cd[7];
          title = "命中点";
          line1 = `${String(kind||"")}  S${station}  ${traj}  t=${fmt(tt,2)} s`;
          line2 = `Az=${fmt(az,1)}°  El=${fmt(el,1)}°`;
        } else if (tag === "shotImpact"){
          // [shotImpact, shotKey, kind, stationId, trajId, t, aimAzDeg, aimElDeg, range]
          const kind = cd[2], station = cd[3], traj = cd[4], tt = cd[5];
          const az = cd[6], el = cd[7], range = cd[8];
          title = "落弹点";
          line1 = `${String(kind||"")}  S${station}  ${traj}  t=${fmt(tt,2)} s`;
          line2 = `Az=${fmt(az,1)}°  El=${fmt(el,1)}°  射程≈${fmt(range,1)} m`;
        } else if (tag === "mcImpact"){
          // [mcImpact, stationId, azDeg, elDeg, v0]
          const station = cd[1], az = cd[2], el = cd[3], v0 = cd[4];
          title = "落弹点（抽样）";
          line1 = `S${station}  Az=${fmt(az,1)}°  El=${fmt(el,1)}°  v0=${fmt(v0,0)} m/s`;

          // optional range (needs station gun position)
          try{
            const gm = plotDiv.__stationGunMap;
            if (gm && gm[station] && Number.isFinite(p.x) && Number.isFinite(p.y)){
              const g = gm[station];
              const dx = p.x - g[0];
              const dy = p.y - g[1];
              const r = Math.sqrt(dx*dx + dy*dy);
              line2 = `射程≈${fmt(r,1)} m`;
            }
          }catch(e){ /* ignore */ }
        } else if (tag === "ballistic"){
          // [ballistic, shotKey, kind, stationId, trajId, t, aimAzDeg, aimElDeg, range, impactX, impactY, speed, dist]
          const kind = cd[2], station = cd[3], traj = cd[4], tt = cd[5];
          const az = cd[6], el = cd[7], range = cd[8];
          const v = cd[11], d = cd[12];
          title = "弹道";
          line1 = `${String(kind||"")}  S${station}  ${traj}  t=${fmt(tt,2)} s`;
          line2 = `Az=${fmt(az,1)}°  El=${fmt(el,1)}°  射程≈${fmt(range,1)} m`;
          line3 = `d=${fmt(d,1)} m  v=${fmt(v,1)} m/s`;
        }
      }

      const xyz = (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))
        ? `x=${fmt(p.x,2)}  y=${fmt(p.y,2)}  z=${fmt(p.z,2)}`
        : "-";

      return `<b>${title}</b><br>${line1}<br>${line2}<br>${xyz}${(line3 && line3 !== "-") ? ("<br>" + line3) : ""}`;
    }

    function hudClear(){
      setHudText("-");
    }

    // Init HUD
    hudClear();

    function getHoverMarkerIndex(){
      if (!plotDiv.data) return -1;
      for (let i = plotDiv.data.length - 1; i >= 0; i--){
        const t = plotDiv.data[i];
        if (t && t.name === "__hover_marker__") return i;
      }
      return -1;
    }

    function getHoverShotIndex(){
      if (!plotDiv.data) return -1;
      for (let i = plotDiv.data.length - 1; i >= 0; i--){
        const t = plotDiv.data[i];
        if (t && t.name === "__hover_shot__") return i;
      }
      return -1;
    }

    function showHoverShot(shotKey){
      const idx = getHoverShotIndex();
      if (idx < 0) return;

      const map = plotDiv.__shotMap || null;
      const rec = (map && shotKey && map[shotKey]) ? map[shotKey] : null;
      if (rec && rec.x && rec.y && rec.z){
        Plotly.restyle(plotDiv, {x:[rec.x], y:[rec.y], z:[rec.z], visible:true}, [idx]);
        return;
      }

      // Fallback: if the ballistic trace is rendered, reuse its data
      let tBall = null;
      if (plotDiv.data){
        for (const t of plotDiv.data){
          if (t && t.meta && t.meta.role === "ballistic" && t.meta.shotKey === shotKey){
            tBall = t;
            break;
          }
        }
      }
      if (tBall && tBall.x && tBall.y && tBall.z){
        Plotly.restyle(plotDiv, {x:[tBall.x], y:[tBall.y], z:[tBall.z], visible:true}, [idx]);
      }
    }

    function hideHoverShot(){
      const idx = getHoverShotIndex();
      if (idx >= 0){
        Plotly.restyle(plotDiv, {visible:false}, [idx]);
      }
    }

    plotDiv.on("plotly_hover", function(evt){
      const p = pickPoint(evt);
      if (!p) return;

      // Update hover marker dot
      const idx = getHoverMarkerIndex();
      if (idx >= 0){
        const x = p.x, y = p.y, z = p.z;
        const color = (p.fullData && p.fullData.line && p.fullData.line.color) ? p.fullData.line.color : null;

        const update = {visible:true};
        if (typeof x !== "undefined") update.x = [[x]];
        if (typeof y !== "undefined") update.y = [[y]];
        if (typeof z !== "undefined") update.z = [[z]];
        if (color) update["marker.color"] = color;

        Plotly.restyle(plotDiv, update, [idx]);
      }

      // Update HUD (annotation)
      setHudText(hudTextForPoint(p));

      // Hovering a deterministic impact point -> show its trajectory
      const cd = getCustomdata(p);
      if (cd && Array.isArray(cd)){
        if (cd[0] === "shotImpact" && cd[1]){
          showHoverShot(cd[1]);
        } else if (cd[0] === "mcImpact"){
          const stationId = Number(cd[1]);
          const azDeg = Number(cd[2]);
          const elDeg = Number(cd[3]);
          const v0 = Number(cd[4]);
          const idxShot = getHoverShotIndex();
          const gm = plotDiv.__stationGunMap || null;
          const cfg = plotDiv.__couplingCfg || null;
          const gun = (gm && gm[stationId]) ? gm[stationId] : null;

          if (idxShot >= 0 && gun && cfg && window.Coupling && window.Coupling.traceShot){
            const cache = plotDiv.__mcShotCache || (plotDiv.__mcShotCache = {});
            const key = `${stationId}|${azDeg.toFixed(3)}|${elDeg.toFixed(3)}|${v0.toFixed(1)}`;
            let pts = cache[key] || null;
            if (!pts){
              pts = window.Coupling.traceShot(gun, azDeg, elDeg, v0, cfg);
              cache[key] = pts || null;
            }
            if (pts && pts.length){
              const xs = [], ys = [], zs = [];
              for (const q of pts){ xs.push(q[0]); ys.push(q[1]); zs.push(q[2]); }
              Plotly.restyle(plotDiv, {x:[xs], y:[ys], z:[zs], visible:true}, [idxShot]);
            } else {
              hideHoverShot();
            }
          } else {
            hideHoverShot();
          }
        } else {
          hideHoverShot();
        }
      } else {
        hideHoverShot();
      }
    });

    plotDiv.on("plotly_unhover", function(){
      const idx = getHoverMarkerIndex();
      if (idx >= 0){
        Plotly.restyle(plotDiv, {visible:false}, [idx]);
      }
      hudClear();
      hideHoverShot();
    });
  }


  function buildLayout(cfg, bbox, camera){
    const showAxes = cfg.showAxes;
    const pad = 5;
    const xRange = [bbox.minX-pad, bbox.maxX+pad];
    const yRange = [bbox.minY-pad, bbox.maxY+pad];
    const zRange = [Math.min(-1, bbox.minZ-1), bbox.maxZ+pad];

    const arX = cfg.arX, arY = cfg.arY, arZ = cfg.arZ;
    const is111 = (Math.abs(arX-1)<1e-9 && Math.abs(arY-1)<1e-9 && Math.abs(arZ-1)<1e-9);

    const theme = (cfg.theme === "light") ? "light" : "dark";
    const palette = (theme === "light")
      ? {bg:"#ffffff", text:"#0b1220", grid:"rgba(0,0,0,.18)", axis:"rgba(0,0,0,.55)", zero:"rgba(0,0,0,.30)"}
      : {bg:"#0f1115", text:"#e8eefc", grid:"rgba(255,255,255,.14)", axis:"rgba(255,255,255,.55)", zero:"rgba(255,255,255,.28)"};

        // camera: do NOT reset user view on re-render; only apply camera when explicitly provided.
    const proj = (cfg.projectionMode === "perspective") ? "perspective" : "orthographic";
    const cam = camera ? JSON.parse(JSON.stringify(camera)) : null;
    if (cam) cam.projection = {type: proj};

    const axCommon = {
      visible: showAxes,
      zeroline: showAxes,
      showline: showAxes,
      linewidth: 2,
      linecolor: palette.axis,
      gridcolor: palette.grid,
      zerolinecolor: palette.zero,
      tickfont: {color: palette.text},
      titlefont: {color: palette.text}
    };

    const scene = {
      xaxis:{...axCommon, title: showAxes?"X":"", range:xRange},
      yaxis:{...axCommon, title: showAxes?"Y":"", range:yRange},
      zaxis:{...axCommon, title: showAxes?"Z":"", range:zRange},
      bgcolor: palette.bg,
      ...(cam ? {camera: cam} : {})
    };

    if (is111){
      scene.aspectmode = "data";
    }else{
      scene.aspectmode = "manual";
      scene.aspectratio = {x:arX, y:arY, z:arZ};
    }

    const hudAnn = {
      xref:"paper",
      yref:"paper",
      x:1,
      y:1,
      xanchor:"right",
      yanchor:"top",
      xshift:-12,
      yshift:-60,
      align:"left",
      text:"-",
      showarrow:false,
      bgcolor: (theme === "light") ? "rgba(255,255,255,0.92)" : "rgba(15,17,21,0.75)",
      bordercolor: (theme === "light") ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.18)",
      borderwidth: 1,
      borderpad: 6,
      font:{size:12, color: palette.text}
    };

    return {
      template: theme === "light" ? "plotly_white" : "plotly_dark",
      font: {color: palette.text},
      paper_bgcolor: palette.bg,
      plot_bgcolor: palette.bg,
      margin:{l:0,r:0,t:0,b:0},
      scene,
      hovermode:"closest",
      showlegend:false,
      annotations:[hudAnn]
    };
  }

  global.Viz = {sceneToTraces, sceneBbox, buildLayout, bindHoverMarker};
})(window);
