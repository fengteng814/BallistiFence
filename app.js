(() => {
  const el = (id) => document.getElementById(id);

  const defaults = {
    discipline:"trap",
    profile:"issf",
    trapTable:"I",          // trap: issf|envelope|group|machine ; skeet: issf|envelope|high|low
    profileGroup:3,
    profileMachine:8,
    granularity:"group",     // group|machine (trap only)
    samplesPerSource: 18,
    stepM: 0.5,
    showStations:true, showSectors:true, showMachines:true, showTraj:true,
    onlyEnvelope:false, showAxes:true,
    gunH:1.50, azHalf:75, elMin:0, elMax:60,
    trapH10Min:1.5, trapH10Max:3.0, trapAzMax:45, trapCarry:76,
    skeetCrossZ:4.6, skeetCarry:68,
    arX:1.0, arY:1.0, arZ:0.6,
    // ---- Coupling (shooting window -> shooting cone -> ballistic family -> impact zone) ----
    cplEnable:false,
    cplStation:"all",
    cplTimeMode:"window",
    cplTimes:"0.20,0.40,0.60",
    cplT0:0.20, cplT1:2.20,
    cplDt:0.05,
    cplAdaptive:true, cplDtFine:0.01, cplBand:0.20,
    cplPreset:"default",
    cplShotV0:370,
    cplV0Sigma:6,
    cplSpreadElevSigma:1.2,
    cplSpreadAzimSigma:1.2,
    cplShotMassG:24,
    cplPelletDiaMM:2.40,
    cplPelletDensity:11340,
    cplRho:1.225,
    cplCd:0.47,
    cplWindSpeed:0,
    cplWindDirDeg:90,
    cplBallDt:0.01,
    cplMaxTime:8.0,
    cplNSamples:3000,
    cplSeed:12345,
    cplClipSector:true,
    cplShowCone:true,
    cplShowCritical:true,
    cplShowImpacts:true,
    cplShowHull:true,
    realtime:true,
    theme:"dark"
  };

  // user toggles within Profile-active set
  const enabled = { groups:{}, sources:{} };
  const expandedGroups = {};
  let lastKey = "";

  // ---- view state (camera) ----
  const viewState = {
    projection: "orthographic",   // orthographic | perspective
    savedCamera: null,
    lastCamera: null
  };
  let plotEventsBound = false;

  function deepClone(o){ return o ? JSON.parse(JSON.stringify(o)) : null; }

  function projectionType(){
    return (viewState.projection === "perspective") ? "perspective" : "orthographic";
  }

  function baseCamera(){
    return {center:{x:0,y:0,z:0}, eye:{x:1.6,y:-1.6,z:0.9}, up:{x:0,y:0,z:1}};
  }

  function withProjection(cam){
    const c = deepClone(cam) || {};
    if (!c.center) c.center = {x:0,y:0,z:0};
    if (!c.eye) c.eye = {x:1.6,y:-1.6,z:0.9};
    if (!c.up) c.up = {x:0,y:0,z:1};
    c.projection = {type: projectionType()};
    return c;
  }

  function getEffectiveCamera(){
    return withProjection(viewState.lastCamera || getCamera() || baseCamera());
  }

  function setCamera(cam){
    const plotDiv = el("plot");
    if (!plotDiv) return;
    const c = withProjection(cam || getEffectiveCamera());
    viewState.lastCamera = deepClone(c);
    try{
      return Plotly.relayout("plot", {"scene.camera": c});
    }catch(e){
      return;
    }
  }

  function bindPlotEvents(){
    if (plotEventsBound) return;
    const plotDiv = el("plot");
    if (!plotDiv || typeof plotDiv.on !== "function") return;

    plotDiv.on("plotly_relayout", ()=>{
      const cam = getCamera();
      if (cam) viewState.lastCamera = deepClone(cam);
    });

    plotEventsBound = true;
  }

  function applyProjectionToggle(){
    // One-click toggle like DCC tools: keep current camera (eye/center/up) unchanged,
    // only switch projection type between orthographic and perspective.
    viewState.projection = (viewState.projection === "orthographic") ? "perspective" : "orthographic";
    const bp = el("btnProj");
    if (bp) bp.textContent = (viewState.projection === "orthographic") ? "正投影" : "透视";

    const plotDiv = el("plot");
    if (!plotDiv) return;

    // Do NOT relayout the full camera object (that can re-center or quantize the view).
    // Only change projection.type so the view framing/orientation stays the same.
    const nextType = projectionType();
    try{
      Plotly.relayout("plot", {"scene.camera.projection.type": nextType});
    }catch(e){}

    // Keep a coherent snapshot for export and subsequent operations.
    const camNow = getCamera();
    if (camNow){
      const c = deepClone(camNow);
      c.projection = {type: nextType};
      viewState.lastCamera = c;
    }
  }

  function applyViewPreset(dir){
    if (!dir || dir === "free") return;
    const dOrtho = 2.65;
    const dAxoXY = 1.85;
    const dAxoZ = 1.15;
    const presets = {
      // 轴测（东北/西北/东南/西南）：保持 +Z 向上
      ne:{eye:{x: dAxoXY, y: dAxoXY, z: dAxoZ}, up:{x:0,y:0,z:1}},
      nw:{eye:{x:-dAxoXY, y: dAxoXY, z: dAxoZ}, up:{x:0,y:0,z:1}},
      se:{eye:{x: dAxoXY, y:-dAxoXY, z: dAxoZ}, up:{x:0,y:0,z:1}},
      sw:{eye:{x:-dAxoXY, y:-dAxoXY, z: dAxoZ}, up:{x:0,y:0,z:1}},
      // 正投影方向（仅控制方向，不强制投影类型）
      front:{eye:{x:0.001, y:-dOrtho, z:0.001}, up:{x:0,y:0,z:1}},
      back:{eye:{x:0.001, y: dOrtho, z:0.001}, up:{x:0,y:0,z:1}},
      left:{eye:{x:-dOrtho, y:0.001, z:0.001}, up:{x:0,y:0,z:1}},
      right:{eye:{x: dOrtho, y:0.001, z:0.001}, up:{x:0,y:0,z:1}},
      top:{eye:{x:0.001, y:0.001, z: dOrtho}, up:{x:0,y:1,z:0}},
      bottom:{eye:{x:0.001, y:0.001, z:-dOrtho}, up:{x:0,y:1,z:0}},
    };
    const base = presets[dir] || presets.top;
    setCamera({center:{x:0,y:0,z:0}, eye: base.eye, up: base.up});
  }


  function getCamera(){
    const plotDiv = el("plot");
    try{
      return (plotDiv && plotDiv._fullLayout && plotDiv._fullLayout.scene && plotDiv._fullLayout.scene.camera) ?
        plotDiv._fullLayout.scene.camera : (plotDiv?.layout?.scene?.camera || null);
    }catch(e){ return null; }
  }

  function setRealtime(on){
    el("btnRealtime").dataset.on = on ? "1" : "0";
    el("btnRealtime").textContent = on ? "实时" : "手动";
    el("pending").classList.toggle("show", !on);
  }

  function applyTheme(theme){
    const t = (theme === "light") ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    el("btnTheme").dataset.theme = t;
    el("btnTheme").textContent = (t === "light") ? "亮色" : "暗色";
    try{ localStorage.setItem("ts_theme", t); }catch(e){}
  }

  // ---- collapsible left-panel sections ----
  function initCollapsibles(){
    const sections = Array.from(document.querySelectorAll(".panel .section"));
    const storageKey = "ts_sections_collapsed";
    let state = {};
    try{ state = JSON.parse(localStorage.getItem(storageKey) || "{}") || {}; }catch(e){ state = {}; }

    sections.forEach((sec, idx)=>{
      if (!sec || sec.dataset.collapsible === "1") return;
      sec.dataset.collapsible = "1";

      let title = "";
      const h3 = sec.querySelector(":scope > h3");
      if (h3){
        title = (h3.textContent || "").trim();
        h3.remove();
      }else{
        title = (idx === 0) ? "总览" : `参数组 ${idx+1}`;
      }
      const key = `sec_${idx}_${title}`;

      const head = document.createElement("div");
      head.className = "section-head";

      const t = document.createElement("div");
      t.className = "section-title";
      t.textContent = title;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "section-toggle";
      btn.setAttribute("aria-label", "折叠/展开");

      head.appendChild(t);
      head.appendChild(btn);

      const body = document.createElement("div");
      body.className = "section-body";
      const children = Array.from(sec.childNodes);
      children.forEach(n=>body.appendChild(n));

      sec.appendChild(head);
      sec.appendChild(body);

      if (state[key]) sec.classList.add("collapsed");

      const toggle = ()=>{
        const collapsed = sec.classList.toggle("collapsed");
        state[key] = collapsed;
        try{ localStorage.setItem(storageKey, JSON.stringify(state)); }catch(e){}
      };

      head.addEventListener("click", (e)=>{
        // 标题区域点击折叠/展开；按钮点击由单独事件处理
        if (e.target === btn) return;
        toggle();
      });

      btn.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });
    });
  }

  function readCfg(){
    const cplTimeMode = el("cplTimeMode") ? el("cplTimeMode").value : "window";
    const cplManual = (cplTimeMode === "manual");
    return {
      discipline: el("discipline").value,
      profile: el("profile").value,
      trapTable: (el("trapTable") ? el("trapTable").value : "I"),
      profileGroup: Number(el("profileGroup").value),
      profileMachine: Number(el("profileMachine").value),
      granularity: el("granularity").value,
      samplesPerSource: Number(el("samplesPerSource").value),
      stepM: Number(el("stepM").value),
      showStations: el("showStations").checked,
      showSectors: el("showSectors").checked,
      showMachines: el("showMachines").checked,
      showTraj: el("showTraj").checked,
      onlyEnvelope: el("onlyEnvelope").checked,
      showAxes: el("showAxes").checked,
      gunH: Number(el("gunH").value),
      azHalf: Number(el("azHalf").value),
      elMin: Number(el("elMin").value),
      elMax: Number(el("elMax").value),
      trapH10Min: Number(el("trapH10Min").value),
      trapH10Max: Number(el("trapH10Max").value),
      trapAzMax: Number(el("trapAzMax").value),
      trapCarry: Number(el("trapCarry").value),
      skeetCrossZ: Number(el("skeetCrossZ").value),
      skeetCarry: Number(el("skeetCarry").value),
      arX: Number(el("arX").value),
      arY: Number(el("arY").value),
      arZ: Number(el("arZ").value),
      cplEnable: !!el("cplEnable").checked,
      cplStation: el("cplStation").value,
      cplTimeMode,
      cplTimes: el("cplTimes") ? String(el("cplTimes").value || "") : "",
      cplT0: Number(el("cplT0").value),
      cplT1: Number(el("cplT1").value),
      cplDt: Number(el("cplDt").value),
      cplAdaptive: cplManual ? false : (!!el("cplAdaptive").checked),
      cplDtFine: Number(el("cplDtFine").value),
      cplBand: Number(el("cplBand").value),
      cplPreset: el("cplPreset") ? el("cplPreset").value : "default",
      cplShotV0: Number(el("cplShotV0").value),
      cplV0Sigma: Number(el("cplV0Sigma").value),
      cplSpreadElevSigma: Number(el("cplSpreadElevSigma").value),
      cplSpreadAzimSigma: Number(el("cplSpreadAzimSigma").value),
      cplShotMassG: Number(el("cplShotMassG").value),
      cplPelletDiaMM: Number(el("cplPelletDiaMM").value),
      cplPelletDensity: Number(el("cplPelletDensity").value),
      cplRho: Number(el("cplRho").value),
      cplCd: Number(el("cplCd").value),
      cplWindSpeed: Number(el("cplWindSpeed").value),
      cplWindDirDeg: Number(el("cplWindDirDeg").value),
      cplBallDt: Number(el("cplBallDt").value),
      cplMaxTime: Number(el("cplMaxTime").value),
      cplNSamples: Number(el("cplNSamples").value),
      cplSeed: Number(el("cplSeed").value),
      cplClipSector: !!el("cplClipSector").checked,
      cplShowCone: !!el("cplShowCone").checked,
      cplShowCritical: !!el("cplShowCritical").checked,
      cplShowImpacts: !!el("cplShowImpacts").checked,
      cplShowHull: !!el("cplShowHull").checked,
      realtime: el("btnRealtime").dataset.on === "1",
      theme: el("btnTheme").dataset.theme === "light" ? "light" : "dark"
    };
  }

  function writeDefaults(){
    el("discipline").value = defaults.discipline;
    el("profile").value = defaults.profile;
    if (el("trapTable")) el("trapTable").value = defaults.trapTable;
    el("profileGroup").value = defaults.profileGroup;
    el("profileMachine").value = defaults.profileMachine;
    el("granularity").value = defaults.granularity;
    el("samplesPerSource").value = defaults.samplesPerSource;
    el("stepM").value = defaults.stepM;

    el("showStations").checked = defaults.showStations;
    el("showSectors").checked = defaults.showSectors;
    el("showMachines").checked = defaults.showMachines;
    el("showTraj").checked = defaults.showTraj;
    el("onlyEnvelope").checked = defaults.onlyEnvelope;
    el("showAxes").checked = defaults.showAxes;

    el("gunH").value = defaults.gunH;
    el("azHalf").value = defaults.azHalf;
    el("elMin").value = defaults.elMin;
    el("elMax").value = defaults.elMax;

    el("trapH10Min").value = defaults.trapH10Min;
    el("trapH10Max").value = defaults.trapH10Max;
    el("trapAzMax").value = defaults.trapAzMax;
    el("trapCarry").value = defaults.trapCarry;

    el("skeetCrossZ").value = defaults.skeetCrossZ;
    el("skeetCarry").value = defaults.skeetCarry;

    el("arX").value = defaults.arX;
    el("arY").value = defaults.arY;
    el("arZ").value = defaults.arZ;

    // coupling defaults
    refreshCouplingStationOptions(defaults.discipline);
    el("cplEnable").checked = defaults.cplEnable;
    el("cplStation").value = defaults.cplStation;
    if (el("cplTimeMode")) el("cplTimeMode").value = defaults.cplTimeMode;
    if (el("cplTimes")) el("cplTimes").value = defaults.cplTimes;
    el("cplT0").value = defaults.cplT0;
    el("cplT1").value = defaults.cplT1;
    el("cplDt").value = defaults.cplDt;
    el("cplAdaptive").checked = defaults.cplAdaptive;
    el("cplDtFine").value = defaults.cplDtFine;
    el("cplBand").value = defaults.cplBand;
    if (el("cplPreset")) el("cplPreset").value = defaults.cplPreset;
    el("cplShotV0").value = defaults.cplShotV0;
    if (el("cplV0Sigma")) el("cplV0Sigma").value = defaults.cplV0Sigma;
    if (el("cplSpreadElevSigma")) el("cplSpreadElevSigma").value = defaults.cplSpreadElevSigma;
    if (el("cplSpreadAzimSigma")) el("cplSpreadAzimSigma").value = defaults.cplSpreadAzimSigma;
    if (el("cplShotMassG")) el("cplShotMassG").value = defaults.cplShotMassG;
    if (el("cplPelletDiaMM")) el("cplPelletDiaMM").value = defaults.cplPelletDiaMM;
    if (el("cplPelletDensity")) el("cplPelletDensity").value = defaults.cplPelletDensity;
    if (el("cplRho")) el("cplRho").value = defaults.cplRho;
    if (el("cplCd")) el("cplCd").value = defaults.cplCd;
    if (el("cplWindSpeed")) el("cplWindSpeed").value = defaults.cplWindSpeed;
    if (el("cplWindDirDeg")) el("cplWindDirDeg").value = defaults.cplWindDirDeg;
    el("cplBallDt").value = defaults.cplBallDt;
    if (el("cplMaxTime")) el("cplMaxTime").value = defaults.cplMaxTime;
    if (el("cplNSamples")) el("cplNSamples").value = defaults.cplNSamples;
    if (el("cplSeed")) el("cplSeed").value = defaults.cplSeed;
    el("cplClipSector").checked = defaults.cplClipSector;
    el("cplShowCone").checked = defaults.cplShowCone;
    el("cplShowCritical").checked = defaults.cplShowCritical;
    el("cplShowImpacts").checked = defaults.cplShowImpacts;
    el("cplShowHull").checked = defaults.cplShowHull;


    setRealtime(defaults.realtime);
    // theme
    el("btnTheme").dataset.theme = defaults.theme;
    el("btnTheme").textContent = (defaults.theme === "light") ? "亮色" : "暗色";
    document.documentElement.setAttribute("data-theme", defaults.theme);

  }

  function refreshProfileOptions(discipline){
    const prof = el("profile");
    const cur = prof.value;
    prof.innerHTML = "";
    const add = (val, label) => {
      const o = document.createElement("option");
      o.value = val; o.textContent = label;
      prof.appendChild(o);
    };
    if (discipline === "trap"){
      add("issf", "ISSF 标准（15 台）");
      add("envelope", "极值包络（更少轨迹）");
      add("group", "单组校核（仅 G?）");
      add("machine", "单靶机校核（仅 #?）");
    }else{
      add("issf", "ISSF 标准（高屋+低屋）");
      add("envelope", "极值包络（更少轨迹）");
      add("high", "仅高屋");
      add("low", "仅低屋");
    }
    const exists = Array.from(prof.options).some(o=>o.value===cur);
    prof.value = exists ? cur : "issf";
  }


  function refreshCouplingStationOptions(discipline){
    const sel = el("cplStation");
    if (!sel) return;
    const cur = sel.value || "all";
    sel.innerHTML = "";
    const add = (val, label) => {
      const o = document.createElement("option");
      o.value = val; o.textContent = label;
      sel.appendChild(o);
    };
    add("all", "全部射击位");
    const n = (discipline === "trap") ? 5 : 8;
    for (let i=1;i<=n;i++) add(String(i), `#${i}`);
    const exists = Array.from(sel.options).some(o=>o.value === cur);
    sel.value = exists ? cur : "all";
  }


  // ---- Coupling presets (ballistics only; geometry/scene stay unchanged) ----
  const CPL_PRESETS = {
    default: {
      cplShotV0: 370,
      cplV0Sigma: 6,
      cplSpreadElevSigma: 1.2,
      cplSpreadAzimSigma: 1.2,
      cplShotMassG: 24,
      cplPelletDiaMM: 2.40,
      cplPelletDensity: 11340,
      cplRho: 1.225,
      cplCd: 0.47,
      cplWindSpeed: 0,
      cplWindDirDeg: 90,
      cplBallDt: 0.01,
      cplMaxTime: 8.0,
      cplNSamples: 3000,
      cplSeed: 12345
    },
    // 近似“最大射程”偏置：更高初速 + 更低空气密度/阻力系数（用于敏感性对比，而非规范值）
    worst_range: {
      cplShotV0: 390,
      cplV0Sigma: 6,
      cplSpreadElevSigma: 1.2,
      cplSpreadAzimSigma: 1.2,
      cplShotMassG: 24,
      cplPelletDiaMM: 2.40,
      cplPelletDensity: 11340,
      cplRho: 1.100,
      cplCd: 0.42,
      cplWindSpeed: 0,
      cplWindDirDeg: 90,
      cplBallDt: 0.01,
      cplMaxTime: 8.0,
      cplNSamples: 3000,
      cplSeed: 12345
    },
    // 近似“侧风最不利”：保持默认弹药/阻力，增加侧风
    crosswind_worst: {
      cplShotV0: 370,
      cplV0Sigma: 6,
      cplSpreadElevSigma: 1.2,
      cplSpreadAzimSigma: 1.2,
      cplShotMassG: 24,
      cplPelletDiaMM: 2.40,
      cplPelletDensity: 11340,
      cplRho: 1.225,
      cplCd: 0.47,
      cplWindSpeed: 8,
      cplWindDirDeg: 90,
      cplBallDt: 0.01,
      cplMaxTime: 8.0,
      cplNSamples: 3000,
      cplSeed: 12345
    }
  };

  function applyCouplingPreset(name){
    const key = (name && CPL_PRESETS[name]) ? name : "default";
    const p = CPL_PRESETS[key];
    if (!p) return;
    for (const [id, val] of Object.entries(p)){
      const node = el(id);
      if (!node) continue;
      if (node.type === "checkbox") node.checked = !!val;
      else node.value = String(val);
    }
  }


  function updateSettingPanels(cfg){
    const showTrapTable = (cfg.discipline==="trap") && (cfg.profile !== "envelope");
    const tRow = el("trapTableRow");
    if (tRow) tRow.style.display = showTrapTable ? "" : "none";
    if (cfg.discipline==="trap"){
      el("settingTrap").style.display = "";
      el("settingSkeet").style.display = "none";
      el("assumptions").innerHTML =
        "Trap：靶轨由设定窗口反算生成（无阻力抛体）。Profile 用于选择 ISSF/包络/单组/单靶机；显示过滤默认组级，可切换到“靶机级（可折叠）”。";
    }else{
      el("settingTrap").style.display = "none";
      el("settingSkeet").style.display = "";
      el("assumptions").innerHTML =
        "Skeet：靶轨为满足交叉点高度与携带距离的反算结果。Profile 用于选择 ISSF/包络/仅高屋/仅低屋。";
    }

    const forceEnvelope = (cfg.profile === "envelope");
    el("onlyEnvelope").disabled = forceEnvelope;
    if (forceEnvelope) el("onlyEnvelope").checked = true;

    const showGroup = (cfg.discipline==="trap" && cfg.profile==="group");
    const showMachine = (cfg.discipline==="trap" && cfg.profile==="machine");
    el("profileGroupRow").style.display = showGroup ? "" : "none";
    el("profileMachineRow").style.display = showMachine ? "" : "none";
    // granularity only meaningful for trap when not single machine
    el("granularityRow").style.display = (cfg.discipline==="trap" && cfg.profile!=="machine") ? "" : "none";

    // coupling: time mode UI state
    updateCouplingModeUI();
  }

  function updateCouplingModeUI(){
    const modeEl = el("cplTimeMode");
    if (!modeEl) return;
    const manual = (modeEl.value === "manual");
    const row = el("cplTimesRow");
    if (row) row.style.display = manual ? "" : "none";

    const setDisabled = (id, on) => { const n = el(id); if (n) n.disabled = !!on; };
    setDisabled("cplT0", manual);
    setDisabled("cplT1", manual);
    setDisabled("cplDt", manual);

    const ad = el("cplAdaptive");
    if (ad){
      if (manual) ad.checked = false;
      ad.disabled = manual;
    }
    setDisabled("cplDtFine", manual);
    setDisabled("cplBand", manual);
  }

  function buildScene(cfg){
    return (cfg.discipline==="trap") ? window.SceneTrap.buildTrapScene(cfg) : window.SceneSkeet.buildSkeetScene(cfg);
  }

  function deriveActive(scene, cfg){
    const groups = new Set();
    const sources = new Set();

    if (scene.meta.discipline === "trap"){
      for (let g=1; g<=5; g++) groups.add(String(g));
      for (const m of scene.machines.filter(m=>m.type==="trap_machine")) sources.add(String(m.id));

      if (cfg.profile === "group"){
        const gk = String(cfg.profileGroup);
        for (const g of Array.from(groups)) if (g !== gk) groups.delete(g);
        for (const m of scene.machines.filter(m=>m.type==="trap_machine")){
          if (String(m.group) !== gk) sources.delete(String(m.id));
        }
      }else if (cfg.profile === "machine"){
        const mk = String(cfg.profileMachine);
        const mm = scene.machines.find(m=>m.type==="trap_machine" && String(m.id)===mk);
        const gk = mm ? String(mm.group) : "3";
        for (const g of Array.from(groups)) if (g !== gk) groups.delete(g);
        for (const s of Array.from(sources)) if (s !== mk) sources.delete(s);
      }
    }else{
      groups.add("H"); groups.add("L");
      sources.add("H"); sources.add("L");
      if (cfg.profile === "high"){ groups.delete("L"); sources.delete("L"); }
      if (cfg.profile === "low"){ groups.delete("H"); sources.delete("H"); }
    }
    return {groups, sources};
  }

  function reconcileEnabled(active){
    // Preserve manual toggles across different Profile filters (group/machine are just filters).
    for (const k of active.groups){
      if (enabled.groups[k] === undefined) enabled.groups[k] = true;
    }
    for (const k of active.sources){
      if (enabled.sources[k] === undefined) enabled.sources[k] = true;
    }
  }

  function renderTrajectoryControls(scene, cfg, active){
    const wrap = el("trajControls");
    wrap.innerHTML = "";

    const head = document.createElement("div");
    head.className = "traj-head";
    head.innerHTML = `<div class="t">靶源显示过滤</div>
      <div class="small"><button id="btnAllOn" class="pill">全开</button>
      <button id="btnAllOff" class="pill">全关</button></div>`;
    wrap.appendChild(head);

    const list = document.createElement("div");
    list.className = "traj-list";

    const addRow = ({id, label, meta, checked, onChange, indent=false, expandable=false, expanded=false, onToggleExpand=null}) => {
      const row = document.createElement("div");
      row.className = "traj-item" + (indent ? " traj-sub" : "");
      row.innerHTML = `
        ${expandable ? `<button class="icon" aria-expanded="${expanded?'true':'false'}" title="展开/收起">${expanded ? "▾" : "▸"}</button>` : `<span style="display:inline-block;width:26px;"></span>`}
        <input type="checkbox" id="${id}" ${checked?"checked":""}/>
        <div>
          <div class="name">${label}</div>
          ${meta?`<div class="meta">${meta}</div>`:""}
        </div>
      `;
      list.appendChild(row);
      const cb = row.querySelector("input");
      cb.addEventListener("change", ()=>onChange(cb.checked));
      if (expandable){
        row.querySelector("button.icon").addEventListener("click", ()=>{
          onToggleExpand && onToggleExpand(!expanded);
        });
      }
    };

    if (scene.meta.discipline === "trap"){
      const showMachines = (cfg.granularity === "machine" && cfg.profile !== "machine");
      for (let g=1; g<=5; g++){
        const gk = String(g);
        if (!active.groups.has(gk)) continue;

        const groupMachineIds = scene.machines
          .filter(m=>m.type==="trap_machine" && String(m.group)===gk)
          .map(m=>String(m.id))
          .filter(id=>active.sources.has(id));

        const expanded = !!expandedGroups[gk];

        addRow({
          id:`g_${gk}`,
          label:`G${gk}（靶机组）`,
          meta:`${groupMachineIds.length} 台`,
          checked: enabled.groups[gk] !== false,
          expandable: showMachines,
          expanded: showMachines ? expanded : false,
          onToggleExpand: (next)=>{ expandedGroups[gk]=next; if (cfg.realtime) render(); else el("pending").classList.add("show"); },
          onChange:(v)=>{
            enabled.groups[gk]=v;
            for (const mid of groupMachineIds) enabled.sources[mid]=v;
            if (cfg.realtime) render(); else el("pending").classList.add("show");
          }
        });

        if (showMachines && expanded){
          for (const mid of groupMachineIds){
            addRow({
              id:`s_${mid}`,
              label:`靶机 #${mid}`,
              meta:`G${gk}`,
              checked: enabled.sources[mid] !== false,
              indent:true,
              onChange:(v)=>{
                enabled.sources[mid]=v;
                const allOn = groupMachineIds.every(x=>enabled.sources[x] !== false);
                enabled.groups[gk]=allOn;
                if (cfg.realtime) render(); else el("pending").classList.add("show");
              }
            });
          }
        }
      }
    }else{
      const labels = {H:"高屋", L:"低屋"};
      for (const k of ["H","L"]){
        if (!active.sources.has(k)) continue;
        addRow({
          id:`s_${k}`,
          label:`${labels[k]}（靶源）`,
          meta:null,
          checked: enabled.sources[k] !== false,
          onChange:(v)=>{
            enabled.sources[k]=v;
            enabled.groups[k]=v;
            if (cfg.realtime) render(); else el("pending").classList.add("show");
          }
        });
      }
    }

    wrap.appendChild(list);

    wrap.querySelector("#btnAllOn").addEventListener("click", ()=>{
      for (const k of active.groups) enabled.groups[k]=true;
      for (const k of active.sources) enabled.sources[k]=true;
      if (cfg.realtime) render(); else el("pending").classList.add("show");
    });
    wrap.querySelector("#btnAllOff").addEventListener("click", ()=>{
      for (const k of active.groups) enabled.groups[k]=false;
      for (const k of active.sources) enabled.sources[k]=false;
      if (cfg.realtime) render(); else el("pending").classList.add("show");
    });
  }


  function renderCouplingSummary(coupling, cfg){
    const box = el("cplSummary");
    if (!box) return;

    if (!cfg.cplEnable){
      box.textContent = "-";
      return;
    }

    if (!coupling || !coupling.ok){
      const r = (coupling && coupling.reason) ? `原因：${coupling.reason}` : "";
      const t = (coupling && Number.isFinite(coupling.elapsedSec)) ? `耗时：${coupling.elapsedSec.toFixed(2)}s` : "";
      box.textContent = `未产生耦合结果。${r ? " " + r : ""}${t ? " " + t : ""} ` +
        "建议检查：射击窗口（t0/t1）、过滤条件、以及扇域裁剪是否导致可用样本为 0。";
      return;
    }

    const area = Number(coupling.hullArea || 0);
    const nSamples = Number(coupling.sampleCount || 0);
    const nShown = (coupling.impacts || []).length;
    const stN = Number(coupling.stationCount || coupling.stationCount === 0 ? coupling.stationCount : coupling.stationCount) || Number(coupling.stationCount || 0);
    const trN = Number(coupling.trajCount || 0);

    let maxRange = 0;
    for (const c of (coupling.controls || [])){
      if (c.kind === "maxRange" && Number.isFinite(c.range)) maxRange = Math.max(maxRange, c.range);
    }

    const kEq = (function(){
      const rho = Number(cfg.cplRho);
      const cd = Number(cfg.cplCd);
      const dia = Number(cfg.cplPelletDiaMM) / 1000.0;
      const dens = Number(cfg.cplPelletDensity);
      if (!isFinite(rho) || !isFinite(cd) || !isFinite(dia) || !isFinite(dens) || dia <= 0 || dens <= 0) return NaN;
      const r = dia * 0.5;
      const area = Math.PI * r * r;
      const mass = (4.0/3.0) * Math.PI * r * r * r * dens;
      return 0.5 * rho * cd * area / mass;
    })();

    const timeText = (String(cfg.cplTimeMode || "window") === "manual")
      ? `时间点：${String(cfg.cplTimes || "").trim() || "-"}`
      : `窗口：${Number(cfg.cplT0).toFixed(2)}–${Number(cfg.cplT1).toFixed(2)}s（dt=${Number(cfg.cplDt).toFixed(2)}）`;

    const cfgText = `射击位：${(cfg.cplStation || "all")==="all" ? "全部" : ("#"+cfg.cplStation)}；${timeText}` +
      `；弹丸：v0=${Number(cfg.cplShotV0).toFixed(0)}±${Number(cfg.cplV0Sigma||0).toFixed(0)}m/s，散布(1σ)=${Number(cfg.cplSpreadElevSigma||0).toFixed(1)}°/ ${Number(cfg.cplSpreadAzimSigma||0).toFixed(1)}°，` +
      `ρ=${Number(cfg.cplRho||0).toFixed(3)}，Cd=${Number(cfg.cplCd||0).toFixed(2)}，风=${Number(cfg.cplWindSpeed||0).toFixed(1)}m/s@${Number(cfg.cplWindDirDeg||0).toFixed(0)}°，` +
      `k≈${(isFinite(kEq)?kEq:0).toFixed(3)}，dt=${Number(cfg.cplBallDt).toFixed(3)}s。`;

    const kpiHtml = `
      <div class="cpl-kpis">
        <div class="cpl-item"><div class="k">样本数</div><div class="v">${nSamples.toLocaleString()}</div></div>
        <div class="cpl-item"><div class="k">落弹包络面积</div><div class="v">${area.toFixed(0)} m²</div></div>
        <div class="cpl-item"><div class="k">最大射程（控制性）</div><div class="v">${maxRange.toFixed(1)} m</div></div>
        <div class="cpl-item"><div class="k">靶轨/射击位</div><div class="v">${trN} / ${Number(coupling.stationCount || 0)}</div></div>
      </div>`;

    const rows = (coupling.controls || []).slice(0, 12).map(c=>{
      const tag = (c.kind === "maxRange") ? "最大射程" : (c.kind === "maxDownrange") ? "最大前向" : "最大侧向";
      const extra = (c.table !== null && c.table !== undefined) ? `T${c.table}` : "";
      return `
        <tr>
          <td>${tag}</td>
          <td>S${c.stationId}</td>
          <td><small>${c.trajId}${extra ? " · "+extra : ""}</small><br>t=${Number(c.t).toFixed(2)}s</td>
          <td>Az ${Number(c.aimAzDeg).toFixed(1)}°<br>El ${Number(c.aimElDeg).toFixed(1)}°</td>
          <td>x=${Number(c.impact[0]).toFixed(1)}<br>y=${Number(c.impact[1]).toFixed(1)}</td>
          <td>${Number(c.range).toFixed(1)} m</td>
        </tr>`;
    }).join("");

    const tableHtml = `
      <table class="cpl-table">
        <thead>
          <tr><th>工况</th><th>位</th><th>靶轨/时间</th><th>枪口</th><th>落弹</th><th>射程</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6"><small>暂无控制性工况（可能被扇域裁剪过滤）。</small></td></tr>'}</tbody>
      </table>`;

    const note = `<div style="margin-top:8px; font-size:11px; color:var(--muted); line-height:1.35">
      ${cfgText}<br>
      说明：耦合弹道采用“重力 + 二次阻力（a=-k·|v_rel|·v_rel）”模型（v_rel 为相对风速）；枪口指向以“目标瞬时位置”构造（未包含提前量），并按初速与角度散布抽样形成弹道族；结果中仅叠加控制性工况的关键弹道族，落弹点显示为抽样子集（${nShown.toLocaleString()}）。
    </div>`;

    box.innerHTML = kpiHtml + tableHtml + note;
  }

  // ---- Coupling progress + deferred compute (avoid silent failure and give user feedback) ----
  let cplToken = 0;
  let cplCache = {sig:"", coupling:null};
  let cplCancelToken = null;

  function couplingSig(cfg, enabled, active){
    const enG = (enabled && enabled.groups) ? enabled.groups : {};
    const enS = (enabled && enabled.sources) ? enabled.sources : {};
    const actG = (active && active.groups) ? Array.from(active.groups).sort() : [];
    const actS = (active && active.sources) ? Array.from(active.sources).sort() : [];
    // Only include fields that affect coupling computation
    const pick = {
      discipline: cfg.discipline,
      profile: cfg.profile,
      trapTable: cfg.trapTable,
      profileGroup: cfg.profileGroup,
      profileMachine: cfg.profileMachine,
      gunH: Number(cfg.gunH),
      azHalf: Number(cfg.azHalf),
      elMin: Number(cfg.elMin),
      elMax: Number(cfg.elMax),
      trapH10Min: Number(cfg.trapH10Min),
      trapH10Max: Number(cfg.trapH10Max),
      trapAzMax: Number(cfg.trapAzMax),
      trapCarry: Number(cfg.trapCarry),
      skeetCrossZ: Number(cfg.skeetCrossZ),
      skeetCarry: Number(cfg.skeetCarry),
      // coupling
      cplEnable: !!cfg.cplEnable,
      cplStation: cfg.cplStation,
      cplTimeMode: String(cfg.cplTimeMode||"window"),
      cplTimes: String(cfg.cplTimes||""),
      cplT0: Number(cfg.cplT0),
      cplT1: Number(cfg.cplT1),
      cplDt: Number(cfg.cplDt),
      cplAdaptive: !!cfg.cplAdaptive,
      cplDtFine: Number(cfg.cplDtFine),
      cplBand: Number(cfg.cplBand),
      cplPreset: String(cfg.cplPreset||"default"),
      cplShotV0: Number(cfg.cplShotV0),
      cplV0Sigma: Number(cfg.cplV0Sigma),
      cplSpreadElevSigma: Number(cfg.cplSpreadElevSigma),
      cplSpreadAzimSigma: Number(cfg.cplSpreadAzimSigma),
      cplShotMassG: Number(cfg.cplShotMassG),
      cplPelletDiaMM: Number(cfg.cplPelletDiaMM),
      cplPelletDensity: Number(cfg.cplPelletDensity),
      cplRho: Number(cfg.cplRho),
      cplCd: Number(cfg.cplCd),
      cplWindSpeed: Number(cfg.cplWindSpeed),
      cplWindDirDeg: Number(cfg.cplWindDirDeg),
      cplBallDt: Number(cfg.cplBallDt),
      cplMaxTime: Number(cfg.cplMaxTime),
      cplNSamples: Number(cfg.cplNSamples),
      cplSeed: Number(cfg.cplSeed),
      cplClipSector: !!cfg.cplClipSector,
      cplShowCone: !!cfg.cplShowCone,
      cplShowCritical: !!cfg.cplShowCritical,
      cplShowImpacts: !!cfg.cplShowImpacts,
      cplShowHull: !!cfg.cplShowHull,
      enabledGroups: Object.keys(enG).sort().map(k=>[k, !!enG[k]]),
      enabledSources: Object.keys(enS).sort().map(k=>[k, !!enS[k]]),
      activeGroups: actG,
      activeSources: actS
    };
    return JSON.stringify(pick);
  }

  function setCouplingProgress(show, text, pct){
    const box = el("cplProgress");
    if (!box) return;
    box.style.display = show ? "block" : "none";
    const t = el("cplProgText");
    if (t && text) t.textContent = text;
    const fill = el("cplProgFill");
    if (!fill) return;
    if (pct === undefined || pct === null){
      fill.style.width = "35%";
      fill.style.animationPlayState = "running";
    }else{
      const p = Math.max(0, Math.min(100, Number(pct)));
      fill.style.animationPlayState = "paused";
      fill.style.transform = "translateX(0)";
      fill.style.width = p.toFixed(1) + "%";
    }
  }

  function drawScene(scene, cfg, active, camera, coupling){
    const bboxRef = window.Viz.sceneBbox(scene, cfg, null, coupling);
    const out = window.Viz.sceneToTraces(scene, cfg, enabled, active, coupling);
    cfg.projectionMode = viewState.projection;
    const layout = window.Viz.buildLayout(cfg, bboxRef, camera);
    layout.uirevision = "keep";
    if (layout.scene) layout.scene.uirevision = "keep";
    const plotDiv = document.getElementById("plot");
    Plotly.react(plotDiv, out.traces, layout, {displayModeBar:true, responsive:true});

    // Build mapping for hover: deterministic impact point -> corresponding ballistic trajectory
    try{
      const map = {};
      if (coupling && coupling.ok && Array.isArray(coupling.critical)){
        for (const c of coupling.critical){
          if (!c || !c.shotKey || !Array.isArray(c.points) || !c.points.length) continue;
          const xs = [], ys = [], zs = [];
          for (const p of c.points){
            xs.push(p[0]);
            ys.push(p[1]);
            zs.push(p[2]);
          }
          map[c.shotKey] = {x:xs, y:ys, z:zs};
        }
      }
      plotDiv.__shotMap = map;
    }catch(e){
      plotDiv.__shotMap = {};
    }

    // Also expose station gun positions and coupling config for hover-to-trajectory
    try{
      const gm = {};
      for (const st of scene.stations || []){
        if (!st || !st.id || !st.gun) continue;
        gm[Number(st.id)] = st.gun;
      }
      plotDiv.__stationGunMap = gm;
      plotDiv.__couplingCfg = (coupling && coupling.cfg) ? coupling.cfg : null;
    }catch(e){
      plotDiv.__stationGunMap = {};
      plotDiv.__couplingCfg = null;
    }

    // bind hover indicator + native HUD (once)
    if (window.Viz && window.Viz.bindHoverMarker) window.Viz.bindHoverMarker(plotDiv);

    el("kStations").textContent = scene.stations.length;
    el("kSources").textContent = scene.machines.filter(m=>m.type!=="cross_point").length;
    el("kTraj").textContent = scene.targets.trajectories.length;
    el("kBBox").textContent = `${(bboxRef.maxX-bboxRef.minX).toFixed(1)} × ${(bboxRef.maxY-bboxRef.minY).toFixed(1)} × ${(bboxRef.maxZ-bboxRef.minZ).toFixed(1)}`;
    window.__BBOX__ = bboxRef;
  }

  function scheduleCoupling(scene, cfg, active, camera){
    if (!cfg.cplEnable || !window.Coupling){
      setCouplingProgress(false);
      cplCache.sig = "";
      cplCache.coupling = null;
      window.__COUPLING__ = null;
      return;
    }

    const sig = couplingSig(cfg, enabled, active);
    if (cplCache.sig === sig && cplCache.coupling && cplCache.coupling.ok){
      window.__COUPLING__ = cplCache.coupling;
      return;
    }

    const token = ++cplToken;
    // New token => cancel any in-flight compute
    if (cplCancelToken) cplCancelToken.cancelled = true;
    cplCancelToken = {cancelled:false};

    setCouplingProgress(true, "耦合计算中…", null);
    window.__COUPLING__ = null;

    // Defer heavy compute so the progress hint can render first
    setTimeout(async ()=>{
      if (token !== cplToken) return;
      let coupling = null;
      const tStart = (window.performance && performance.now) ? performance.now() : Date.now();
      try {
        const progressCb = (p, msg)=>{
          if (token !== cplToken) return;
          const pct = (p === null || p === undefined) ? null : (Number(p) * 100.0);
          setCouplingProgress(true, msg || "耦合计算中…", pct);
        };

        const runner = window.Coupling.computeAsync ? window.Coupling.computeAsync : window.Coupling.compute;
        coupling = runner(scene, cfg, enabled, active, progressCb, cplCancelToken);
        if (coupling && typeof coupling.then === "function") coupling = await coupling;
      } catch (err) {
        const msg = (err && err.message) ? err.message : String(err);
        coupling = {ok:false, reason: msg, impacts:[], hull:[], controls:[], critical:[], coneRays:[]};
      }
      const tEnd = (window.performance && performance.now) ? performance.now() : Date.now();
      coupling.elapsedSec = (tEnd - tStart) / 1000.0;

      if (token !== cplToken) return;
      if (cplCancelToken && cplCancelToken.cancelled){
        setCouplingProgress(false);
        return;
      }
      cplCache = {sig, coupling};
      window.__COUPLING__ = coupling;
      setCouplingProgress(false);

      // Redraw with coupling overlays
      drawScene(scene, cfg, active, camera, coupling);
      bindPlotEvents();
      renderCouplingSummary(coupling, cfg);
    }, 20);
  }

  function resetIfContextChanged(cfg){
    const key = `${cfg.discipline}`;
    if (key !== lastKey){
      enabled.groups = {};
      enabled.sources = {};
      lastKey = key;
      for (const k of Object.keys(expandedGroups)) delete expandedGroups[k];
    }
  }

  function render(){
    const cfg = readCfg();
    updateSettingPanels(cfg);

    const scene = buildScene(cfg);
    const active = deriveActive(scene, cfg);

    resetIfContextChanged(cfg);
    reconcileEnabled(active);

    const camera = getEffectiveCamera();
    viewState.lastCamera = deepClone(camera);

    // Do NOT compute coupling synchronously inside render(); it can be heavy and
    // will freeze the UI. We first draw the base scene (or cached coupling), then
    // schedule the coupling compute and redraw overlays.
    let coupling = null;
    let sig = "";
    if (cfg.cplEnable) sig = couplingSig(cfg, enabled, active);
    if (cfg.cplEnable && cplCache.sig === sig && cplCache.coupling) coupling = cplCache.coupling;
    window.__COUPLING__ = coupling;

    drawScene(scene, cfg, active, camera, coupling);
    bindPlotEvents();
    renderTrajectoryControls(scene, cfg, active);
    renderCouplingSummary(coupling, cfg);

    // compute only when cache-miss (forced recompute handled by Refresh)
    if (cfg.cplEnable && cplCache.sig !== sig){
      scheduleCoupling(scene, cfg, active, camera);
    }else{
      setCouplingProgress(false);
    }

    window.__SCENE__ = scene;
    window.__CFG__ = cfg;
    window.__ACTIVE__ = {groups:Array.from(active.groups), sources:Array.from(active.sources)};
    if (cfg.realtime) el("pending").classList.remove("show");
  }

  function bindHandlers(){
    const ids = [
      "discipline","profile","trapTable","profileGroup","profileMachine","granularity",
      "samplesPerSource","stepM",
      "showStations","showSectors","showMachines","showTraj","onlyEnvelope","showAxes",
      "gunH","azHalf","elMin","elMax",
      "trapH10Min","trapH10Max","trapAzMax","trapCarry",
      "skeetCrossZ","skeetCarry",
      "arX","arY","arZ",
      "cplEnable","cplStation","cplTimeMode","cplTimes","cplT0","cplT1","cplDt","cplAdaptive","cplDtFine","cplBand",
      "cplPreset","cplShotV0","cplV0Sigma","cplSpreadElevSigma","cplSpreadAzimSigma",
      "cplShotMassG","cplPelletDiaMM","cplPelletDensity","cplRho","cplCd","cplWindSpeed","cplWindDirDeg",
      "cplBallDt","cplMaxTime","cplNSamples","cplSeed",
      "cplClipSector","cplShowCone","cplShowCritical","cplShowImpacts","cplShowHull"
    ];

    for (const id of ids){
      const node = el(id);
      if (!node) continue;

      node.addEventListener("change", ()=>{
        const cfg0 = readCfg();
        if (id === "discipline"){
          refreshProfileOptions(node.value);
          refreshCouplingStationOptions(node.value);
        }
        if (id === "cplPreset"){
          applyCouplingPreset(node.value);
        }
        updateSettingPanels(readCfg());
        const cfg = readCfg();
        if (cfg.realtime){
          render();
        }else{
          el("pending").classList.add("show");
        }
      });

      node.addEventListener("keydown", (e)=>{
        const cfg = readCfg();
        if (!cfg.realtime) return;
        if (e.key === "Enter"){
          e.preventDefault();
          node.blur();
          render();
        }
      });
    }

    el("btnRefresh").addEventListener("click", ()=>{
      cplToken += 1;
      cplCache = {sig:"", coupling:null};
      setCouplingProgress(false);
      render();
    });

    el("btnReset").addEventListener("click", ()=>{
      writeDefaults();
      // load persisted theme
      let savedTheme = null;
      try{ savedTheme = localStorage.getItem("ts_theme"); }catch(e){}
      if (savedTheme === "light" || savedTheme === "dark") applyTheme(savedTheme);

      refreshProfileOptions(el("discipline").value);
        refreshCouplingStationOptions(el("discipline").value);
      updateSettingPanels(readCfg());
      // reset camera: purge plot
      viewState.lastCamera = null;
      viewState.savedCamera = null;
      plotEventsBound = false;
      Plotly.purge("plot");
      cplToken += 1;
      cplCache = {sig:"", coupling:null};
      setCouplingProgress(false);
      render();
    });

    el("btnExport").addEventListener("click", ()=>{
      const scene = window.__SCENE__;
      if (!scene){ alert("请先刷新生成场景"); return; }
      const payload = {
        exportedAt: new Date().toISOString(),
        cfg: window.__CFG__,
        active: window.__ACTIVE__,
        enabled,
        coupling: window.__COUPLING__ || null,
        view:{projection:viewState.projection, camera:viewState.lastCamera || getCamera() || null, savedCamera:viewState.savedCamera},
        scene
      };
      window.U.downloadText(`scene_${scene.meta.discipline}.json`, JSON.stringify(payload, null, 2));
    });


    el("btnTheme").addEventListener("click", ()=>{
      const cur = el("btnTheme").dataset.theme === "light" ? "light" : "dark";
      const next = (cur === "light") ? "dark" : "light";
      applyTheme(next);
      render(); // keep camera
    });

    el("btnRealtime").addEventListener("click", ()=>{
      const on = el("btnRealtime").dataset.on !== "1";
      setRealtime(on);
      if (on) render();
    });

    // plot overlay controls (top-right)
    const vp = el("viewPreset");
    if (vp){
      vp.addEventListener("change", ()=>applyViewPreset(vp.value));
    }
    const bp = el("btnProj");
    if (bp){
      bp.textContent = (viewState.projection === "orthographic") ? "正投影" : "透视";
      bp.addEventListener("click", ()=>applyProjectionToggle());
    }
    const bs = el("btnSaveView");
    if (bs){
      bs.addEventListener("click", ()=>{
        const cam = getCamera();
        if (cam){
          viewState.savedCamera = deepClone(cam);
          const old = bs.textContent;
          bs.textContent = "已保存";
          setTimeout(()=>{ bs.textContent = old; }, 900);
        }
      });
    }

    // coupling cancel
    const cc = el("cplCancel");
    if (cc){
      cc.addEventListener("click", (e)=>{
        e.preventDefault();
        if (cplCancelToken) cplCancelToken.cancelled = true;
        cplToken += 1; // invalidate pending job
        setCouplingProgress(false);
        const summary = el("cplSummary");
        if (summary) summary.textContent = "已取消本次耦合计算（未更新耦合结果）。";
      });
    }

  }

  // init
  initCollapsibles();
  writeDefaults();
  refreshProfileOptions(defaults.discipline);
  refreshCouplingStationOptions(defaults.discipline);
  updateSettingPanels(readCfg());
  bindHandlers();
  render();
})();
