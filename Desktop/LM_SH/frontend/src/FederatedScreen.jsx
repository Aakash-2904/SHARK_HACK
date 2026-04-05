import { useState, useEffect, useRef } from "react";

const BASE_URL = "http://localhost:8000";

// ─────────────────────────────────────────────────────────────────
// Architecture Canvas Panel — ported directly from index.html
// ─────────────────────────────────────────────────────────────────
function ArchPanel({ name, color, title, canvasRef }) {
  return (
    <div style={{
      borderTop: `2px solid ${color}`,
      background: "linear-gradient(to bottom,rgba(3,0,10,0.97),rgba(3,0,10,1))",
      padding: "12px 20px 18px",
      borderRadius: "0 0 10px 10px",
      marginTop: 8,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <span style={{ color, fontFamily:"monospace", fontSize:11, fontWeight:700 }}>{title}</span>
      </div>
      <canvas ref={canvasRef} style={{
        width:"100%", height:180, borderRadius:8, display:"block",
        background:"#03000a", border:`1px solid ${color}22`
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Architecture Diagram — full interactive diagram from slide S5
// ─────────────────────────────────────────────────────────────────
function ArchitectureDiagram() {
  const [activePanel, setActivePanel] = useState(null);
  const canvasRefs = {
    qed:  useRef(null),
    fdl:  useRef(null),
    qaoa: useRef(null),
    sci:  useRef(null),
  };
  const rafRefs = useRef({});
  const startedRef = useRef({});

  // ── helpers ──
  function rnd(a, b) { return Math.random() * (b - a) + a; }
  function lrp(a, b, t) { return a + (b - a) * t; }

  function initCanvas(ref) {
    const c = ref.current;
    if (!c) return null;
    c.width  = c.offsetWidth  * 2;
    c.height = c.offsetHeight * 2;
    return { c, ctx: c.getContext("2d"), W: c.width, H: c.height };
  }

  // ── QED animation ──
  function startQED() {
    const d = initCanvas(canvasRefs.qed);
    if (!d) return;
    const { c, ctx, W, H } = d;
    let t = 0;
    const tokens = ["research","quantum","neural","dataset","paper","model","collab"]
      .map((w, i) => ({ word:w, x:rnd(0, W*0.22), y:rnd(H*0.08, H*0.85), sp:rnd(1.2,2.4), ph:i*0.7 }));
    const px = Array.from({length:80}, (_,i) => ({
      col:`hsl(${rnd(10,42)},85%,${rnd(38,65)}%)`,
      x:(i%10)*20+W*0.03, y:Math.floor(i/10)*20+H*0.05
    }));
    function draw() {
      ctx.clearRect(0,0,W,H);
      px.forEach(p => {
        ctx.globalAlpha = 0.6+0.3*Math.sin(t*3+p.x*0.01);
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x,p.y,15,15);
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle="#c9a96e"; ctx.font="20px monospace";
      ctx.fillText("Raw Image", W*0.03, H*0.3);
      ctx.fillStyle="#7a5c2a"; ctx.font="15px monospace";
      ctx.fillText("pixels → qubits", W*0.03, H*0.34);
      tokens.forEach(tk => {
        tk.x += tk.sp*0.35;
        if (tk.x > W*0.33) tk.x = 0;
        const al = 0.4+0.5*Math.abs(Math.sin(t*1.3+tk.ph));
        ctx.fillStyle=`rgba(255,140,0,${al})`; ctx.font="bold 22px monospace";
        ctx.fillText(tk.word, tk.x, tk.y*0.5+H*0.44);
      });
      ctx.fillStyle="#c9a96e"; ctx.font="20px monospace";
      ctx.fillText("Raw Text", W*0.03, H*0.74);
      const fx=W*0.37, fw=W*0.27;
      ctx.beginPath();
      ctx.moveTo(fx,H*0.04); ctx.lineTo(fx+fw,H*0.04);
      ctx.lineTo(fx+fw*0.6,H*0.5); ctx.lineTo(fx+fw*0.4,H*0.5);
      ctx.closePath();
      const g=ctx.createLinearGradient(fx,H*0.04,fx,H*0.5);
      g.addColorStop(0,"rgba(255,69,0,0.1)"); g.addColorStop(1,"rgba(255,140,0,0.25)");
      ctx.fillStyle=g; ctx.fill();
      ctx.strokeStyle="rgba(255,69,0,0.32)"; ctx.lineWidth=2; ctx.stroke();
      ["H","CNOT","QFT","Rz"].forEach((g2,i) => {
        const gx=fx+fw*0.17+i*fw*0.22, gy=H*0.13+Math.sin(t*1.1+i)*H*0.04;
        ctx.strokeStyle="#ff8c00"; ctx.fillStyle="rgba(255,120,0,0.12)"; ctx.lineWidth=1.5;
        ctx.fillRect(gx-15,gy-12,30,24); ctx.strokeRect(gx-15,gy-12,30,24);
        ctx.fillStyle="rgba(255,140,0,0.9)"; ctx.font="bold 17px monospace"; ctx.textAlign="center";
        ctx.fillText(g2,gx,gy+5);
      });
      ctx.textAlign="left";
      for (let q=0;q<8;q++) {
        const wx=fx+fw*0.18, wy=H*0.54+q*H*0.043, ww=fw*0.62;
        ctx.beginPath(); ctx.moveTo(wx,wy); ctx.lineTo(wx+ww,wy);
        ctx.strokeStyle="rgba(255,69,0,0.25)"; ctx.lineWidth=1; ctx.stroke();
        for (let s=0;s<5;s++) {
          const ph=t*2.4+q*0.8+s*1.1;
          ctx.beginPath(); ctx.arc(wx+(s/4)*ww, wy+Math.sin(ph)*H*0.015, 3.5, 0, Math.PI*2);
          ctx.fillStyle=`rgba(255,130,0,${0.3+0.55*Math.abs(Math.sin(ph))})`;
          ctx.shadowColor="#ff8c00"; ctx.shadowBlur=5; ctx.fill(); ctx.shadowBlur=0;
        }
        ctx.fillStyle="rgba(255,100,0,0.7)"; ctx.font="16px monospace"; ctx.textAlign="center";
        ctx.fillText("|q"+q+"⟩", wx-44, wy+4);
      }
      t += 0.016;
      rafRefs.current.qed = requestAnimationFrame(draw);
    }
    draw();
  }

  // ── FDL animation ──
  function startFDL() {
    const d = initCanvas(canvasRefs.fdl);
    if (!d) return;
    const { ctx, W, H } = d;
    let t = 0;
    const unis = [
      {label:"Uni 1", x:0.12, y:0.25, col:"#ff4500"},
      {label:"Uni 2", x:0.12, y:0.52, col:"#ffd700"},
      {label:"Uni 3", x:0.12, y:0.79, col:"#10b981"},
    ];
    function draw() {
      ctx.clearRect(0,0,W,H);
      unis.forEach((u, ui) => {
        const ux=W*u.x, uy=H*u.y, bx=ux-55, by=uy-44, bw=110, bh=82;
        ctx.strokeStyle=u.col+"55"; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,bw,bh);
        for (let b=0;b<5;b++) {
          const bH=(0.28+0.5*Math.abs(Math.sin(t*0.8+ui*1.1+b*0.9)))*(bh-16);
          ctx.fillStyle=u.col+"88";
          ctx.fillRect(bx+4+b*(bw-8)/5, by+bh-6-bH, (bw-8)/5-2, bH);
        }
        ctx.fillStyle=u.col; ctx.font="bold 18px monospace"; ctx.textAlign="center";
        ctx.fillText(u.label, ux, uy+52);
        const ph=((t*0.5+ui*0.33)%1);
        const px2=lrp(ux+58,W*0.5-50,ph), py2=lrp(uy,H*0.52,ph);
        ctx.beginPath(); ctx.moveTo(ux+58,uy); ctx.lineTo(W*0.5-50,H*0.52);
        ctx.strokeStyle=u.col+"28"; ctx.lineWidth=1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(px2,py2,5,0,Math.PI*2);
        ctx.fillStyle=u.col; ctx.shadowColor=u.col; ctx.shadowBlur=9; ctx.fill(); ctx.shadowBlur=0;
        if (ph<0.55) {
          ctx.fillStyle=u.col+"cc"; ctx.font="14px monospace"; ctx.textAlign="center";
          ctx.fillText("∇W",px2,py2-9);
        }
      });
      const ax=W*0.5, ay=H*0.52, ar=50+Math.sin(t*1.5)*4;
      const ag=ctx.createRadialGradient(ax,ay,0,ax,ay,ar);
      ag.addColorStop(0,"rgba(255,140,0,0.28)"); ag.addColorStop(1,"rgba(255,140,0,0)");
      ctx.beginPath(); ctx.arc(ax,ay,ar,0,Math.PI*2); ctx.fillStyle=ag; ctx.fill();
      ctx.strokeStyle="#ff8c00"; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle="#ffd700"; ctx.font="bold 18px monospace"; ctx.textAlign="center";
      ctx.fillText("FedAvg",ax,ay-2); ctx.font="14px monospace"; ctx.fillText("Aggregator",ax,ay+16);
      const gph=((t*0.5)%1), gpx=lrp(ax+56,W*0.84-50,gph);
      ctx.beginPath(); ctx.moveTo(ax+56,ay); ctx.lineTo(W*0.84-50,ay);
      ctx.strokeStyle="rgba(255,215,0,0.28)"; ctx.lineWidth=2; ctx.stroke();
      ctx.beginPath(); ctx.arc(gpx,ay,6,0,Math.PI*2);
      ctx.fillStyle="#ffd700"; ctx.shadowColor="#ffd700"; ctx.shadowBlur=11; ctx.fill(); ctx.shadowBlur=0;
      const gx=W*0.84, gy=H*0.52, gr=50;
      const gg=ctx.createRadialGradient(gx,gy,0,gx,gy,gr);
      gg.addColorStop(0,"rgba(255,215,0,0.2)"); gg.addColorStop(1,"rgba(255,215,0,0)");
      ctx.beginPath(); ctx.arc(gx,gy,gr,0,Math.PI*2); ctx.fillStyle=gg; ctx.fill();
      ctx.strokeStyle="#ffd700"; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle="#ffd700"; ctx.font="bold 17px monospace"; ctx.textAlign="center";
      ctx.fillText("Global",gx,gy-3); ctx.font="13px monospace"; ctx.fillText("Model → LDB",gx,gy+15);
      ctx.textAlign="left"; t+=0.018;
      rafRefs.current.fdl = requestAnimationFrame(draw);
    }
    draw();
  }

  // ── QAOA animation ──
  function startQAOA() {
    const d = initCanvas(canvasRefs.qaoa);
    if (!d) return;
    const { ctx, W, H } = d;
    let t = 0;
    function draw() {
      ctx.clearRect(0,0,W,H);
      const gcx=W*0.5, gcy=H*0.44, gr=H*0.3;
      const upos=[0,1,2].map(i=>({
        x:gcx+gr*Math.cos(i*Math.PI*2/3-Math.PI/2),
        y:gcy+gr*Math.sin(i*Math.PI*2/3-Math.PI/2),
        col:["#ff4500","#ffd700","#10b981"][i],
        label:["Uni 1","Uni 2","Uni 3"][i]
      }));
      [[0,1],[1,2],[0,2]].forEach(([a,b]) => {
        const st=0.38+0.42*Math.abs(Math.sin(t*0.55+a+b*1.2));
        ctx.beginPath(); ctx.moveTo(upos[a].x,upos[a].y); ctx.lineTo(upos[b].x,upos[b].y);
        ctx.strokeStyle=`rgba(255,140,0,${st})`; ctx.lineWidth=st*5; ctx.stroke();
        const mx=(upos[a].x+upos[b].x)/2, my=(upos[a].y+upos[b].y)/2;
        ctx.fillStyle="#fff8ee"; ctx.font="bold 19px monospace"; ctx.textAlign="center";
        ctx.fillText((st*100).toFixed(0)+"%", mx, my);
      });
      upos.forEach(u => {
        ctx.beginPath(); ctx.arc(u.x,u.y,36+Math.sin(t*1.7)*3,0,Math.PI*2);
        ctx.fillStyle=u.col+"18"; ctx.fill(); ctx.strokeStyle=u.col; ctx.lineWidth=2.5; ctx.stroke();
        ctx.fillStyle=u.col; ctx.font="bold 18px monospace"; ctx.textAlign="center";
        ctx.fillText(u.label,u.x,u.y+5);
      });
      const collab=0.72+0.15*Math.abs(Math.sin(t*0.28));
      const gx2=W*0.14, gy2=H*0.82, gw2=W*0.72, gh2=H*0.06;
      ctx.fillStyle="rgba(255,255,255,0.04)"; ctx.fillRect(gx2,gy2,gw2,gh2);
      const gg2=ctx.createLinearGradient(gx2,0,gx2+gw2*collab,0);
      gg2.addColorStop(0,"#ff4500"); gg2.addColorStop(1,"#ffd700");
      ctx.fillStyle=gg2; ctx.fillRect(gx2,gy2,gw2*collab,gh2);
      ctx.strokeStyle="rgba(255,255,255,0.1)"; ctx.lineWidth=1; ctx.strokeRect(gx2,gy2,gw2,gh2);
      ctx.fillStyle="#fff8ee"; ctx.font="bold 21px monospace"; ctx.textAlign="center";
      ctx.fillText("COLLABORATION SCORE: "+Math.round(collab*100)+"%", gx2+gw2/2, gy2+gh2+22);
      ctx.textAlign="left"; t+=0.018;
      rafRefs.current.qaoa = requestAnimationFrame(draw);
    }
    draw();
  }

  // ── SCI animation ──
  function startSCI() {
    const d = initCanvas(canvasRefs.sci);
    if (!d) return;
    const { ctx, W, H } = d;
    let t = 0;
    const words=["federated","privacy","neural","gradient","quantum","NLP","BERT","cosine","similarity","embed"];
    const nodes=words.map((w,i)=>({
      word:w, x:rnd(W*0.08,W*0.92), y:rnd(H*0.1,H*0.85),
      vx:rnd(-0.28,0.28), vy:rnd(-0.28,0.28), r:rnd(22,36), ph:i*0.6
    }));
    function draw() {
      ctx.clearRect(0,0,W,H);
      nodes.forEach(n => {
        n.x+=n.vx; n.y+=n.vy;
        if(n.x<n.r||n.x>W-n.r) n.vx*=-1;
        if(n.y<n.r||n.y>H-n.r) n.vy*=-1;
      });
      nodes.forEach((a,i) => nodes.slice(i+1).forEach(b => {
        const d=Math.hypot(a.x-b.x,a.y-b.y);
        if(d<170){
          const sim=1-d/170;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
          ctx.strokeStyle=`rgba(255,140,0,${sim*0.22})`; ctx.lineWidth=sim*2; ctx.stroke();
          if(d<95){
            const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
            ctx.fillStyle=`rgba(255,215,0,${sim*0.85})`;
            ctx.font="bold 13px monospace"; ctx.textAlign="center";
            ctx.fillText((sim*100).toFixed(0)+"%",mx,my);
          }
        }
      }));
      nodes.forEach(n => {
        const pulse=0.7+0.3*Math.sin(t*1.2+n.ph);
        ctx.beginPath(); ctx.arc(n.x,n.y,n.r*pulse,0,Math.PI*2);
        ctx.fillStyle="rgba(255,69,0,0.1)";
        ctx.strokeStyle=`rgba(255,140,0,${0.4+0.4*pulse})`; ctx.lineWidth=1.5;
        ctx.fill(); ctx.stroke();
        ctx.fillStyle=`rgba(255,215,0,${0.7+0.3*pulse})`;
        ctx.font=`bold ${Math.floor(n.r*0.44)}px monospace`; ctx.textAlign="center";
        ctx.fillText(n.word,n.x,n.y+4);
      });
      ctx.textAlign="left"; t+=0.016;
      rafRefs.current.sci = requestAnimationFrame(draw);
    }
    draw();
  }

  // Start animation when panel opens, cancel when it closes
  useEffect(() => {
    if (!activePanel) return;
    if (startedRef.current[activePanel]) return;
    // Small delay so the canvas is visible and sized before we read offsetWidth
    const timer = setTimeout(() => {
      startedRef.current[activePanel] = true;
      if (activePanel === "qed")  startQED();
      if (activePanel === "fdl")  startFDL();
      if (activePanel === "qaoa") startQAOA();
      if (activePanel === "sci")  startSCI();
    }, 50);
    return () => clearTimeout(timer);
  }, [activePanel]);

  // Cancel all RAFs on unmount
  useEffect(() => {
    return () => Object.values(rafRefs.current).forEach(id => cancelAnimationFrame(id));
  }, []);

  function toggle(name) {
    setActivePanel(prev => prev === name ? null : name);
  }

  const btnStyle = (name, borderCol, bgCol, textCol) => ({
    borderRadius:7, padding:"9px 14px", cursor:"pointer", border:`2px solid ${borderCol}`,
    background: activePanel === name ? bgCol.replace("0.08","0.22") : bgCol,
    color: textCol, display:"inline-flex", flexDirection:"column", alignItems:"center",
    gap:3, minWidth:130, transition:"all 0.2s",
    filter: activePanel && activePanel !== name ? "brightness(0.55)" : "brightness(1)",
    fontFamily:"monospace",
  });

  const layerStyle = (borderCol, bgCol) => ({
    border:`1px solid ${borderCol}`, background:bgCol,
    borderRadius:10, padding:"12px 14px", width:"100%",
    position:"relative", marginBottom:0,
  });

  const lbl = (col, text) => (
    <span style={{
      position:"absolute", top:-9, left:12, background:"#03000a",
      padding:"0 8px", fontSize:7, fontWeight:700, letterSpacing:3,
      textTransform:"uppercase", fontFamily:"monospace", color:col
    }}>{text}</span>
  );

  // Animated dot helpers
  const vline = (col, delay) => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ width:2, height:20, background:`linear-gradient(rgba(${col},0.2),rgba(${col},0.9))`, borderRadius:2, position:"relative", overflow:"hidden" }}>
        <div style={{
          position:"absolute", left:"50%", width:5, height:5, borderRadius:"50%",
          transform:"translateX(-50%)", background:`rgb(${col})`,
          boxShadow:`0 0 4px rgb(${col})`,
          animation:`slideDown 1.4s ${delay}s infinite linear`
        }} />
      </div>
    </div>
  );

  const hline = (col, delay) => (
    <div style={{ width:20, height:2, background:`linear-gradient(90deg,rgba(${col},0.2),rgba(${col},0.9))`, borderRadius:2, position:"relative", overflow:"hidden", flexShrink:0 }}>
      <div style={{
        position:"absolute", top:"50%", left:0, width:5, height:5, borderRadius:"50%",
        transform:"translateY(-50%)", background:`rgb(${col})`,
        animation:`slideRight 1.4s ${delay}s infinite linear`
      }} />
    </div>
  );

  return (
    <div style={{ background:"#03000a", borderRadius:14, padding:24, border:"1px solid rgba(255,140,0,0.2)" }}>
      <style>{`
        @keyframes slideDown  { 0%{top:0;opacity:1} 100%{top:100%;opacity:0} }
        @keyframes slideRight { 0%{left:0;opacity:1} 100%{left:100%;opacity:0} }
        .arch-btn:hover { transform:scale(1.06) }
      `}</style>

      <div style={{ fontSize:13, color:"#c9a96e", marginBottom:14 }}>
        3-Layer System — <strong style={{ color:"#ffd700" }}>Click any node to explore</strong>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>

        {/* LAYER 3 — University Systems */}
        <div style={{ ...layerStyle("rgba(255,69,0,0.25)","rgba(255,69,0,0.03)") }}>
          {lbl("#ff4500","LAYER 3 · UNIVERSITY SYSTEMS")}
          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            {[["#ff4500","UNI 1"],["#ffd700","UNI 2"],["#10b981","UNI 3"]].map(([col,name]) => (
              <div key={name} style={{ border:`1px solid ${col}44`, background:`${col}0a`, borderRadius:8, padding:"8px 10px", flex:1 }}>
                <div style={{ fontFamily:"monospace", fontSize:9, fontWeight:700, color:col, letterSpacing:2, textAlign:"center", marginBottom:5 }}>{name}</div>
                <div style={{ display:"flex", gap:3, justifyContent:"center", marginBottom:4 }}>
                  {["KH","CPS","CE"].map(d => (
                    <div key={d} style={{ width:26, height:26, borderRadius:4, background:`${col}20`, border:`1px solid ${col}40`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"monospace", fontSize:7, fontWeight:700, color:col }}>
                      {d}<span style={{ fontSize:5, opacity:0.5 }}>{d==="KH"?"Know.":d==="CPS"?"Comp.":"Collab"}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height:1, background:col, opacity:0.18, margin:"3px 0" }} />
                <div style={{ textAlign:"center", fontFamily:"monospace", fontSize:6, color:col, opacity:0.55 }}>University DB</div>
                <div style={{ height:1, background:col, opacity:0.18, margin:"3px 0" }} />
                <div style={{ textAlign:"center", fontFamily:"monospace", fontSize:6, color:col, opacity:0.55 }}>SharePoint / Local DS</div>
              </div>
            ))}
          </div>
        </div>

        {/* Flow arrows down */}
        <div style={{ display:"flex", justifyContent:"space-around", padding:"0 20px" }}>
          {[["255,69,0",0],["255,69,0",0.5],["255,215,0",0.2],["255,215,0",0.7],["16,185,129",0.4],["16,185,129",0.9]].map(([col,d],i) => (
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
              <div style={{ fontFamily:"monospace", fontSize:6, letterSpacing:0.5, marginBottom:1, opacity:0.55, color:`rgb(${col})` }}>
                {i%2===0?"RAW TEXT":"IMAGES"}
              </div>
              {vline(col, d)}
            </div>
          ))}
        </div>

        {/* LAYER 2 — Processing */}
        <div style={{ ...layerStyle("rgba(255,140,0,0.3)","rgba(255,140,0,0.04)") }}>
          {lbl("#ff8c00","LAYER 2 · PROCESSING & ENCODING PIPELINE")}
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:20, flexWrap:"wrap", marginTop:4 }}>
            <button className="arch-btn" onClick={() => toggle("qed")} style={btnStyle("qed","rgba(255,69,0,0.5)","rgba(255,69,0,0.08)","#ff4500")}>
              <span style={{ fontSize:16 }}>⚛️</span>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:1 }}>QUANTUM ENCODING</span>
              <span style={{ fontSize:7, opacity:0.6 }}>click to explore</span>
            </button>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <div style={{ width:22, height:1, background:"#2a1506" }} />
              <span style={{ fontFamily:"monospace", fontSize:7, color:"#2a1506" }}>parallel</span>
            </div>
            <button className="arch-btn" onClick={() => toggle("fdl")} style={btnStyle("fdl","rgba(255,215,0,0.5)","rgba(255,215,0,0.08)","#ffd700")}>
              <span style={{ fontSize:16 }}>🧠</span>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:1 }}>FEDERATED LEARNING</span>
              <span style={{ fontSize:7, opacity:0.6 }}>click to explore</span>
            </button>
          </div>
          <div style={{ display:"flex", justifyContent:"space-around", marginTop:6, padding:"0 50px" }}>
            {[["#ff4500","ENCODED DATA",0],["#ffd700","FEDERATED MODELS",0]].map(([col,lbl2,d]) => (
              <div key={lbl2} style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ fontFamily:"monospace", fontSize:6, color:col, opacity:0.55, marginBottom:1 }}>{lbl2}</div>
                {vline(col.replace("#ff4500","255,69,0").replace("#ffd700","255,215,0"), d)}
              </div>
            ))}
          </div>
        </div>

        {/* LAYER 1 — Central */}
        <div style={{ ...layerStyle("rgba(255,215,0,0.28)","rgba(255,215,0,0.03)") }}>
          {lbl("#ffd700","LAYER 1 · CENTRALIZED SYSTEM")}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, marginTop:4 }}>
            <div style={{ border:"1px solid rgba(255,215,0,0.22)", borderRadius:7, padding:"5px 32px", color:"rgba(255,215,0,0.65)", fontFamily:"monospace", fontSize:10, letterSpacing:2, background:"rgba(255,215,0,0.06)", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg,transparent,#ffd700,transparent)" }} />
              LOCAL DB — LDB <span style={{ color:"rgba(255,215,0,0.3)", fontSize:7, marginLeft:8 }}>stores encoded data + model index</span>
            </div>
            {vline("255,215,0", 0)}
            <div style={{ border:"2px solid rgba(255,140,0,0.55)", borderRadius:9, padding:"7px 44px", color:"#ff8c00", fontFamily:"monospace", fontSize:12, letterSpacing:3, fontWeight:700, background:"rgba(255,140,0,0.1)", boxShadow:"0 0 18px rgba(255,140,0,0.14)" }}>
              CENTRAL SYSTEM — CENT
            </div>
          </div>
        </div>

        <div style={{ height:1, background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)", margin:"4px 0" }} />

        {/* USER SEARCH LAYER */}
        <div style={{ ...layerStyle("rgba(56,189,248,0.22)","rgba(56,189,248,0.03)") }}>
          {lbl("#38bdf8","USER-TRIGGERED SEARCH — queries Local DB")}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0, flexWrap:"nowrap", overflowX:"auto", marginTop:4 }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"7px 10px", border:"1px solid rgba(56,189,248,0.28)", borderRadius:7, background:"rgba(56,189,248,0.06)", minWidth:60 }}>
              <span style={{ fontSize:16 }}>👤</span>
              <span style={{ color:"#38bdf8", fontFamily:"monospace", fontSize:8, fontWeight:700 }}>USER</span>
            </div>
            {hline("56,189,248", 0)}
            <button className="arch-btn" onClick={() => toggle("sci")} style={btnStyle("sci","rgba(56,189,248,0.5)","rgba(56,189,248,0.08)","#38bdf8")}>
              <span style={{ fontSize:16 }}>🔍</span>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:1 }}>SCIBERT + COSINE</span>
              <span style={{ fontSize:7, opacity:0.6 }}>click to explore</span>
            </button>
            {hline("255,140,0", 0.35)}
            <button className="arch-btn" onClick={() => toggle("qaoa")} style={btnStyle("qaoa","rgba(255,215,0,0.5)","rgba(255,215,0,0.08)","#ffd700")}>
              <span style={{ fontSize:16 }}>⚡</span>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:1 }}>QAOA OPTIMIZER</span>
              <span style={{ fontSize:7, opacity:0.6 }}>click to explore</span>
            </button>
            {hline("255,215,0", 0.7)}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"7px 10px", border:"1px solid rgba(255,215,0,0.28)", borderRadius:7, background:"rgba(255,215,0,0.06)", minWidth:60 }}>
              <span style={{ fontSize:16 }}>📊</span>
              <span style={{ color:"#ffd700", fontFamily:"monospace", fontSize:8, fontWeight:700 }}>RESULTS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-panels */}
      {activePanel === "qed" && (
        <ArchPanel name="qed" color="#ff4500" title="⚛️ QUANTUM ENCODING — Raw Data → Quantum States" canvasRef={canvasRefs.qed} />
      )}
      {activePanel === "fdl" && (
        <ArchPanel name="fdl" color="#ffd700" title="🧠 FEDERATED LEARNING — Gradient-only Model Training" canvasRef={canvasRefs.fdl} />
      )}
      {activePanel === "qaoa" && (
        <ArchPanel name="qaoa" color="#ffd700" title="⚡ QAOA OPTIMIZER — Collaboration Matching via MaxCut" canvasRef={canvasRefs.qaoa} />
      )}
      {activePanel === "sci" && (
        <ArchPanel name="sci" color="#38bdf8" title="🔍 SCIBERT + COSINE SIMILARITY — Semantic Research Matching" canvasRef={canvasRefs.sci} />
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────
// Main FederatedScreen — original content + arch diagram inserted
// ─────────────────────────────────────────────────────────────────
export default function FederatedScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [animStep, setAnimStep] = useState(0);

  useEffect(() => {
    fetch(`${BASE_URL}/federated/status`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data) return;
    const t = setInterval(() => setAnimStep(s => (s + 1) % (data.nodes.length + 2)), 1200);
    return () => clearInterval(t);
  }, [data]);

  const S = {
    page:   { padding:"40px", maxWidth:1000, margin:"0 auto" },
    card:   { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:24, marginBottom:16 },
    tag:    { display:"inline-block", fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, textTransform:"uppercase", letterSpacing:1 },
    green:  { background:"rgba(5,150,105,0.15)", color:"#34d399", border:"1px solid rgba(5,150,105,0.3)" },
    purple: { background:"rgba(124,58,237,0.15)", color:"#a78bfa", border:"1px solid rgba(124,58,237,0.3)" },
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"calc(100vh - 65px)", color:"#64748b" }}>
      Loading federated network status...
    </div>
  );

  if (!data) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"calc(100vh - 65px)", color:"#ef4444" }}>
      ⚠️ Backend offline — start uvicorn first
    </div>
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#7c3aed", textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>
          Live Network
        </div>
        <h2 style={{ fontSize:32, fontWeight:800, marginBottom:8 }}>Federated Learning Network</h2>
        <p style={{ fontSize:15, color:"#64748b", lineHeight:1.7 }}>
          Each university trains locally on its own data. Only encrypted model weights are shared.
          Raw research data never leaves any university node.
        </p>
      </div>

      {/* Privacy guarantee banner */}
      <div style={{ background:"rgba(5,150,105,0.08)", border:"1px solid rgba(5,150,105,0.2)", borderRadius:12, padding:"16px 24px", marginBottom:24, display:"flex", alignItems:"center", gap:14 }}>
        <span style={{ fontSize:24 }}>🔒</span>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#34d399", marginBottom:4 }}>Privacy Guarantee Active</div>
          <div style={{ fontSize:13, color:"#94a3b8" }}>{data.privacy_guarantee} · Compliance: {data.compliance?.join(" · ")}</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          {data.compliance?.map(c => <span key={c} style={{ ...S.tag, ...S.green }}>{c}</span>)}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:24 }}>
        {[
          ["🏛️", data.global_model.n_nodes,           "University Nodes"],
          ["👥", data.global_model.total_researchers,  "Researchers Indexed"],
          ["🔐", "0",                                  "Raw Records Shared"],
          ["⚡", "FedAvg",                             "Aggregation Method"],
        ].map(([icon, val, label]) => (
          <div key={label} style={{ ...S.card, textAlign:"center", padding:20 }}>
            <div style={{ fontSize:24, marginBottom:8 }}>{icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:"#a78bfa", marginBottom:4 }}>{val}</div>
            <div style={{ fontSize:12, color:"#64748b" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── ARCHITECTURE DIAGRAM ── */}
      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <div style={{ padding:"20px 24px 12px" }}>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>System Architecture</div>
          <div style={{ fontSize:13, color:"#64748b" }}>3-layer federated pipeline — from university data to ranked results</div>
        </div>
        <div style={{ padding:"0 24px 24px" }}>
          <ArchitectureDiagram />
        </div>
      </div>

      {/* FL Round Visualization */}
      <div style={S.card}>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:20 }}>Round 1 — Federated Training Flow</div>
        <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:28, overflowX:"auto" }}>
          {["Fetch Data","Local Training","Encrypt Weights","Send to Server","FedAvg","Global Model"].map((step, i) => (
            <div key={step} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
              <div style={{
                padding:"10px 16px", borderRadius:8, fontSize:12, fontWeight:600, textAlign:"center",
                background: animStep > i ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.04)",
                border: animStep > i ? "1px solid #7c3aed" : "1px solid rgba(255,255,255,0.08)",
                color: animStep > i ? "#a78bfa" : "#64748b",
                transition:"all .4s ease",
                boxShadow: animStep > i ? "0 0 12px rgba(124,58,237,0.3)" : "none"
              }}>
                {animStep > i ? "✓ " : ""}{step}
              </div>
              {i < 5 && <div style={{ color: animStep > i ? "#7c3aed" : "#4b5563", fontSize:18, margin:"0 6px", transition:"color .4s" }}>→</div>}
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
          {data.nodes.map((node, i) => (
            <div key={node.university} style={{
              background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:10, padding:18, transition:"all .4s",
              borderColor: animStep > i ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.07)",
              boxShadow: animStep > i ? "0 0 16px rgba(124,58,237,0.1)" : "none"
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:"linear-gradient(135deg,#7c3aed,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🏛️</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{node.university}</div>
                  <div style={{ fontSize:11, color:"#64748b" }}>{node.researchers_trained} researchers trained</div>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  ["Training Status", node.status, "#34d399"],
                  ["Data Shared",     node.data_shared, "#a78bfa"],
                ].map(([k,v,col]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                    <span style={{ color:"#64748b" }}>{k}</span>
                    <span style={{ color:col, fontWeight:600 }}>{v}</span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                  <span style={{ color:"#64748b" }}>Raw Data Left Node</span>
                  <span style={{ color:"#ef4444", fontWeight:600 }}>
                    {node.raw_data_left_university ? "⚠️ Yes" : "🔒 Never"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Encryption explanation */}
      <div style={S.card}>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>How Encryption Works</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
          {[
            ["1️⃣","Local Encoding",      "Each researcher's abstract is encoded into a 256-dim vector using SciBERT at the university's own server."],
            ["2️⃣","Node Encryption",     "The vector is encrypted with a university-specific key before it leaves the local server. The key never leaves the node."],
            ["3️⃣","Central Aggregation", "Only encrypted weights reach Luminary's central server. FedAvg aggregates them without ever decrypting raw research content."],
          ].map(([num, title, desc]) => (
            <div key={title} style={{ background:"rgba(255,255,255,0.02)", borderRadius:10, padding:18, border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize:24, marginBottom:10 }}>{num}</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#c4b5fd", marginBottom:8 }}>{title}</div>
              <div style={{ fontSize:13, color:"#94a3b8", lineHeight:1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}