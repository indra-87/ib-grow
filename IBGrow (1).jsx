import { useState, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG — Supabase & AI
// ═══════════════════════════════════════════════════════════════════════════════
const SUPABASE_URL  = "https://pqjuvuflinnrpemqcafl.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxanV2dWZsaW5ucnBlbXFjYWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzAzMjQsImV4cCI6MjA5NDA0NjMyNH0.E4sJv1gM9TbWG-2o90aH8wJXZMLRY_uLQ9fgWARX1Ro";

const GEMINI_API_KEY = "AIzaSyAbjeTs7-di6mrIT7JKhCxCOGvXPjjn76M";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const MASTER_ID = "admin";
const MASTER_PW = "grow123";
const APP_BASE_URL = typeof window !== "undefined"
  ? window.location.origin + window.location.pathname
  : "https://ibgrow.app";

// ─── Supabase REST helper ─────────────────────────────────────────────────────
const sb = {
  headers: {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON,
    "Authorization": `Bearer ${SUPABASE_ANON}`,
    "Prefer": "return=representation",
  },
  url(table, query = "") { return `${SUPABASE_URL}/rest/v1/${table}${query}`; },

  async select(table, query = "") {
    const r = await fetch(sb.url(table, query), { headers: sb.headers });
    if (!r.ok) throw new Error(`SELECT ${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async insert(table, body) {
    const r = await fetch(sb.url(table), {
      method: "POST", headers: sb.headers,
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`INSERT ${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async update(table, id, body) {
    const r = await fetch(sb.url(table, `?id=eq.${id}`), {
      method: "PATCH", headers: sb.headers,
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`UPDATE ${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async upsert(table, body) {
    const r = await fetch(sb.url(table), {
      method: "POST",
      headers: { ...sb.headers, "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`UPSERT ${table}: ${r.status} ${await r.text()}`);
    return r.json();
  },
  async delete(table, id) {
    const r = await fetch(sb.url(table, `?id=eq.${id}`), {
      method: "DELETE", headers: sb.headers,
    });
    if (!r.ok) throw new Error(`DELETE ${table}: ${r.status} ${await r.text()}`);
    return true;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const IB_PROFILES = [
  { id: "inquirer",      icon: "🔍", label: "탐구하는 사람",   color: "#8B5CF6" },
  { id: "knowledgeable", icon: "📚", label: "지식이 있는 사람", color: "#3B82F6" },
  { id: "thinker",       icon: "💡", label: "생각하는 사람",   color: "#F59E0B" },
  { id: "communicator",  icon: "💬", label: "소통하는 사람",   color: "#10B981" },
  { id: "principled",    icon: "⚖️", label: "원칙이 있는 사람", color: "#EF4444" },
  { id: "open-minded",   icon: "🌍", label: "열린 마음",       color: "#06B6D4" },
  { id: "caring",        icon: "🤝", label: "배려하는 사람",   color: "#EC4899" },
  { id: "risk-taker",    icon: "🚀", label: "도전하는 사람",   color: "#F97316" },
  { id: "balanced",      icon: "⚡", label: "균형잡힌 사람",   color: "#84CC16" },
  { id: "reflective",    icon: "💭", label: "성찰하는 사람",   color: "#A78BFA" },
];
const ATL_SKILLS = [
  { id: "thinking",      label: "사고 기술",     color: "#8B5CF6" },
  { id: "communication", label: "소통 기술",     color: "#3B82F6" },
  { id: "social",        label: "사회적 기술",   color: "#10B981" },
  { id: "self-mgmt",     label: "자기관리 기술", color: "#EC4899" },
  { id: "research",      label: "조사 기술",     color: "#F97316" },
];
const LEVELS = [
  { lv: 1, name: "씨앗",   icon: "🌱", xp: 0    },
  { lv: 2, name: "새싹",   icon: "🌿", xp: 150  },
  { lv: 3, name: "탐구자", icon: "🔭", xp: 400  },
  { lv: 4, name: "발견자", icon: "📖", xp: 800  },
  { lv: 5, name: "사상가", icon: "💡", xp: 1500 },
  { lv: 6, name: "선구자", icon: "🚀", xp: 2500 },
  { lv: 7, name: "마스터", icon: "👑", xp: 4000 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const getLv   = xp => { let l = LEVELS[0]; for (const x of LEVELS) { if (xp >= x.xp) l = x; } return l; };
const getNext = xp => LEVELS.find(l => xp < l.xp) || null;
const pad2    = n  => String(n).padStart(2, "0");
const uid     = () => Math.random().toString(36).slice(2, 10).toUpperCase();

function makeStudentCode(classCode, num) { return `${classCode}-${pad2(num)}`; }
function makeStudentUrl(studentCode) { return `${APP_BASE_URL}?student=${encodeURIComponent(studentCode)}`; }

function makeStudent(id, name, classCode, num, pw = "") {
  return {
    id, name, num,
    studentCode: makeStudentCode(classCode, num),
    password: pw,
    totalXp: 0, level: 1,
    profiles: Object.fromEntries(IB_PROFILES.map(p => [p.id, 0])),
    atl:      Object.fromEntries(ATL_SKILLS.map(s => [s.id, 0])),
    xpHistory: [],
  };
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else { fallbackCopy(text); }
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(ta); ta.focus(); ta.select();
  document.execCommand("copy"); document.body.removeChild(ta);
}

// ─── DB row ↔ app object converters ──────────────────────────────────────────
function dbRowToStudent(row) {
  return {
    id: row.id,
    name: row.name,
    num: row.num,
    studentCode: row.student_code,
    password: row.password || "",
    totalXp: row.total_xp || 0,
    level: row.level || 1,
    profiles: row.profiles || Object.fromEntries(IB_PROFILES.map(p => [p.id, 0])),
    atl:      row.atl      || Object.fromEntries(ATL_SKILLS.map(s => [s.id, 0])),
    xpHistory: row.xp_history || [],
    classId: row.class_id,
  };
}

function studentToDbRow(s, classId) {
  return {
    id: s.id,
    class_id: classId,
    name: s.name,
    num: s.num,
    student_code: s.studentCode,
    password: s.password || "",
    total_xp: s.totalXp,
    level: s.level,
    profiles: s.profiles,
    atl: s.atl,
    xp_history: s.xpHistory,
  };
}

function dbRowToRecord(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    classId: row.class_id,
    date: row.date,
    content: row.content,
    profiles: row.profiles || [],
    atl: row.atl || [],
    xp: row.xp || 0,
    type: row.type || "AI",
    comment: row.comment || "",
    profileScores: row.profile_scores || {},
    atlScores: row.atl_scores || {},
  };
}

function recordToDbRow(rec, classId) {
  return {
    id: rec.id,
    class_id: classId,
    student_id: rec.studentId,
    date: rec.date,
    content: rec.content,
    profiles: rec.profiles,
    atl: rec.atl,
    xp: rec.xp,
    type: rec.type,
    comment: rec.comment || "",
    profile_scores: rec.profileScores || {},
    atl_scores: rec.atlScores || {},
  };
}

// ─── AI APIs ──────────────────────────────────────────────────────────────────
async function callAnthropic(prompt, imageBase64 = null, imageMime = null) {
  const userContent = imageBase64
    ? [{ type: "image", source: { type: "base64", media_type: imageMime, data: imageBase64 } }, { type: "text", text: prompt }]
    : prompt;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: userContent }] }),
  });
  if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${resp.status}`); }
  const data = await resp.json();
  return data.content?.find(b => b.type === "text")?.text || "";
}

async function callGemini(prompt, imageBase64 = null, imageMime = null) {
  const parts = imageBase64
    ? [{ inline_data: { mime_type: imageMime, data: imageBase64 } }, { text: prompt }]
    : [{ text: prompt }];
  const resp = await fetch(GEMINI_URL, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.3, maxOutputTokens: 1000 } }),
  });
  if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${resp.status}`); }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

async function callAI(prompt, imageBase64 = null, imageMime = null) {
  try { return await callAnthropic(prompt, imageBase64, imageMime); }
  catch (e1) {
    try { return await callGemini(prompt, imageBase64, imageMime); }
    catch (e2) { throw new Error(`Anthropic: ${e1.message} / Gemini: ${e2.message}`); }
  }
}

async function ocrWithAI(base64, mimeType) {
  const text = await callAI("이 이미지에서 텍스트를 읽어주세요. 손글씨가 있다면 최대한 정확하게 읽어주세요. 텍스트만 출력하고 설명은 하지 마세요.", base64, mimeType);
  return text;
}

async function analyzeWithAI(text) {
  if (!text || text.trim().length < 3) {
    return {
      profileScores: Object.fromEntries(IB_PROFILES.map(p => [p.id, 0])),
      atlScores: Object.fromEntries(ATL_SKILLS.map(s => [s.id, 0])),
      profiles: [], atl: [], xp: 0,
      message: "글이 너무 짧아요. 오늘 있었던 일을 조금 더 써봐요! ✏️",
    };
  }
  const prompt = `당신은 IB 초등 교육 전문가입니다. 학생의 글을 분석해서 각 IB 학습자상에 점수를 줍니다.\n\n학생 글: """${text}"""\n\n채점 규칙:\n- 글 내용과 직접 관련된 학습자상에만 점수 부여 (관련 없으면 반드시 0점)\n- 점수 범위: 0~50점\n- 5~10점: 약간 관련, 11~25점: 관련 있음, 26~40점: 강하게 관련, 41~50점: 핵심 주제\n- 여러 학습자상에 동시 점수 가능\n- ATL 기술도 동일 기준\n\nIB 학습자상:\n- inquirer: 호기심, 탐구, 배움에 열정\n- knowledgeable: 지식 습득, 다양한 학습\n- thinker: 논리적 사고, 문제 해결\n- communicator: 의사소통, 발표, 나눔\n- principled: 정직, 약속, 책임감\n- open-minded: 다양성 수용, 새로운 시각\n- caring: 배려, 도움, 공감\n- risk-taker: 도전, 새로운 시도\n- balanced: 몸과 마음의 균형\n- reflective: 자기 성찰, 개선점 인식\n\nATL: thinking, communication, social, self-mgmt, research\n\nJSON만 출력 (설명 없이):\n{"profileScores":{"inquirer":0,"knowledgeable":0,"thinker":0,"communicator":0,"principled":0,"open-minded":0,"caring":0,"risk-taker":0,"balanced":0,"reflective":0},"atlScores":{"thinking":0,"communication":0,"social":0,"self-mgmt":0,"research":0},"message":"격려 메시지 1~2문장"}`;
  try {
    const raw = await callAI(prompt);
    const clean = raw.replace(/```json|```/g, "").trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
    const profileScores = parsed.profileScores || {};
    const atlScores = parsed.atlScores || {};
    const profiles = Object.entries(profileScores).filter(([, v]) => v > 0).map(([k]) => k);
    const atl = Object.entries(atlScores).filter(([, v]) => v > 0).map(([k]) => k);
    const totalXp = Math.min(100, Object.values(profileScores).reduce((s, v) => s + (v || 0), 0));
    return { profileScores, atlScores, profiles, atl, xp: totalXp, message: parsed.message || "오늘도 잘 기록했어요! 🌱" };
  } catch (e) {
    return { profileScores: Object.fromEntries(IB_PROFILES.map(p => [p.id, 0])), atlScores: Object.fromEntries(ATL_SKILLS.map(s => [s.id, 0])), profiles: [], atl: [], xp: 0, message: "AI 분석 중 오류가 발생했어요. (오류: " + e.message + ")", error: true };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════════════════════════
function Spinner({ text = "불러오는 중..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

function RadarChart({ data, labels, size = 200 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const n = data.length;
  const max = Math.max(...data, 1);
  const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, ratio) => [cx + r * ratio * Math.cos(angle(i)), cy + r * ratio * Math.sin(angle(i))];
  const rings = [0.2, 0.4, 0.6, 0.8, 1];
  return (
    <svg width={size} height={size} className="mx-auto">
      {rings.map(ring => (
        <polygon key={ring} points={Array.from({ length: n }, (_, i) => pt(i, ring).join(",")).join(" ")} fill="none" stroke="#e5e7eb" strokeWidth="1" />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="#e5e7eb" strokeWidth="1" />
      ))}
      <polygon
        points={data.map((v, i) => pt(i, v / max).join(",")).join(" ")}
        fill="rgba(139,92,246,0.2)" stroke="#8B5CF6" strokeWidth="2"
      />
      {data.map((v, i) => <circle key={i} cx={pt(i, v / max)[0]} cy={pt(i, v / max)[1]} r="3" fill="#8B5CF6" />)}
      {labels.map((l, i) => {
        const [x, y] = pt(i, 1.22);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#6b7280">{l}</text>;
      })}
    </svg>
  );
}

function ATLBars({ atl }) {
  const max = Math.max(...ATL_SKILLS.map(s => atl[s.id] || 0), 1);
  return (
    <div className="space-y-2">
      {ATL_SKILLS.map(s => (
        <div key={s.id} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-20 shrink-0">{s.label}</span>
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${((atl[s.id] || 0) / max) * 100}%`, backgroundColor: s.color }} />
          </div>
          <span className="text-xs font-bold w-6 text-right" style={{ color: s.color }}>{atl[s.id] || 0}</span>
        </div>
      ))}
    </div>
  );
}

function XPLineChart({ history, width = 280, height = 100 }) {
  if (!history || history.length < 2) return <p className="text-xs text-gray-400 text-center py-4">기록이 더 필요해요</p>;
  const maxXp = Math.max(...history.map(h => h.xp), 1);
  const pts = history.map((h, i) => {
    const x = 20 + (i / (history.length - 1)) * (width - 40);
    const y = height - 20 - ((h.xp / maxXp) * (height - 30));
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L${pts[pts.length-1][0]},${height-20} L${pts[0][0]},${height-20} Z`;
  return (
    <svg width={width} height={height} className="w-full">
      <defs><linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3"/><stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0"/></linearGradient></defs>
      <path d={area} fill="url(#xpGrad)" />
      <path d={path} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#8B5CF6" />)}
      {history.map((h, i) => (
        <text key={i} x={pts[i][0]} y={height - 5} textAnchor="middle" fontSize="8" fill="#9CA3AF">{h.date?.slice(5)}</text>
      ))}
      <text x={pts[pts.length-1][0]} y={pts[pts.length-1][1] - 6} textAnchor="middle" fontSize="9" fill="#7C3AED" fontWeight="bold">{history[history.length-1].xp}</text>
    </svg>
  );
}

function ResultPopup({ result, onClose }) {
  if (!result) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl mb-4" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4"><div className="text-4xl mb-2">⭐</div><h3 className="font-bold text-gray-800 text-lg">기록 완료!</h3><p className="text-sm text-gray-500 mt-1">{result.message}</p></div>
        <div className="bg-yellow-50 rounded-2xl p-3 text-center mb-4"><div className="text-3xl font-black text-yellow-500">+{result.xp} XP</div><div className="text-xs text-gray-400">누적 {result.totalXp} XP</div></div>
        {result.profiles && result.profiles.length > 0 && (
          <div className="mb-3"><p className="text-xs text-gray-500 mb-2 font-medium">IB 학습자상</p><div className="flex flex-wrap gap-1">{result.profiles.map(pid => { const p = IB_PROFILES.find(x => x.id === pid); return p ? <span key={pid} className="text-xs px-2 py-1 rounded-full text-white" style={{ backgroundColor: p.color }}>{p.icon} {p.label}</span> : null; })}</div></div>
        )}
        <button onClick={onClose} className="w-full bg-purple-500 text-white font-bold py-3 rounded-2xl hover:bg-purple-600 transition-colors mt-2">계속하기 🌱</button>
      </div>
    </div>
  );
}

function LevelUpPopup({ fromLv, toLv, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-xs w-full" onClick={e => e.stopPropagation()}>
        <div className="text-6xl mb-4 animate-bounce">{toLv.icon}</div>
        <h2 className="text-2xl font-black text-purple-600 mb-1">레벨 업!</h2>
        <p className="text-gray-600 mb-2">{fromLv.name} → <b className="text-purple-600">{toLv.name}</b></p>
        <p className="text-sm text-gray-400 mb-6">Lv.{fromLv.lv} → Lv.{toLv.lv}</p>
        <button onClick={onClose} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 rounded-2xl">🎉 축하해요!</button>
      </div>
    </div>
  );
}

function FileOCRUpload({ onOCRResult }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [ocrText, setOcrText] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const ref = useRef();

  function pick(f) {
    if (!f) return;
    setFile(f); setStatus("preview"); setOcrText(""); setErrMsg("");
    if (f.type.startsWith("image/")) { const r = new FileReader(); r.onload = e => setPreview(e.target.result); r.readAsDataURL(f); }
    else setPreview(null);
  }

  async function doOCR() {
    if (!file) return;
    setStatus("loading");
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      const t = await ocrWithAI(b64, file.type);
      if (t) { setOcrText(t); setStatus("done"); } else { setErrMsg("텍스트를 찾지 못했어요."); setStatus("error"); }
    } catch (e) { setErrMsg(e.message); setStatus("error"); }
  }

  function apply() { onOCRResult(ocrText); reset(); }
  function reset() { setFile(null); setPreview(null); setOcrText(""); setStatus("idle"); setErrMsg(""); if (ref.current) ref.current.value = ""; }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-3 border border-blue-100">
      <p className="text-xs font-semibold text-blue-700 mb-2">📎 손글씨 사진·PDF 올리기 <span className="text-gray-400 font-normal">— AI가 자동으로 읽어줘요!</span></p>
      {status === "idle" && (
        <div className="border-2 border-dashed border-blue-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-white transition-all" onClick={() => ref.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pick(e.dataTransfer?.files?.[0]); }}>
          <div className="text-3xl mb-1">📷</div><p className="text-xs font-medium text-gray-600">탭하거나 파일을 끌어다 놓아요</p><p className="text-xs text-gray-400 mt-0.5">JPG · PNG · PDF 지원</p>
        </div>
      )}
      {(status === "preview" || status === "loading") && (
        <div className="space-y-2">
          <div className="bg-white rounded-xl p-2 flex items-center gap-3 border border-blue-100">
            {preview ? <img src={preview} alt="" className="h-16 w-16 object-cover rounded-lg shrink-0" /> : <div className="h-16 w-16 bg-blue-50 rounded-lg flex items-center justify-center text-2xl shrink-0">📄</div>}
            <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-700 truncate">{file?.name}</p><p className="text-xs text-gray-400">{((file?.size || 0) / 1024).toFixed(1)} KB</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={doOCR} disabled={status === "loading"} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1">
              {status === "loading" ? <><span>⏳</span> 글자 읽는 중...</> : <><span>✨</span> AI로 글자 인식</>}
            </button>
            <button onClick={reset} disabled={status === "loading"} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs text-gray-500">취소</button>
          </div>
        </div>
      )}
      {status === "done" && (
        <div className="space-y-2">
          <div className="bg-white rounded-xl p-3 border border-green-100"><p className="text-xs font-semibold text-green-600 mb-1">✅ 인식된 텍스트</p><p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">{ocrText}</p></div>
          <div className="flex gap-2"><button onClick={apply} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-xl text-xs">📝 글쓰기 칸에 넣기</button><button onClick={reset} className="px-3 py-2 rounded-xl bg-gray-100 text-xs text-gray-500">다시</button></div>
        </div>
      )}
      {status === "error" && (
        <div className="space-y-2">
          <div className="bg-red-50 rounded-xl p-3 border border-red-100"><p className="text-xs text-red-600 font-semibold">😢 인식 실패</p><p className="text-xs text-red-500 mt-0.5">{errMsg}</p></div>
          <button onClick={reset} className="w-full py-2 rounded-xl bg-gray-100 text-xs text-gray-600">다시 시도</button>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => pick(e.target.files?.[0])} />
    </div>
  );
}

function CopyButton({ text, label = "복사", className = "" }) {
  const [copied, setCopied] = useState(false);
  function handle() { copyText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <button onClick={handle} className={`text-xs px-2 py-0.5 rounded transition-colors ${copied ? "bg-green-100 text-green-600" : "bg-blue-100 hover:bg-blue-200 text-blue-600"} ${className}`}>
      {copied ? "✅ 복사됨" : label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT APP
// ═══════════════════════════════════════════════════════════════════════════════
function StudentApp({ student, classData, onAddRecord, onLogout }) {
  const [tab, setTab] = useState("record");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [levelUp, setLevelUp] = useState(null);

  const lv = getLv(student.totalXp), next = getNext(student.totalXp);
  const pct = next ? Math.round(((student.totalXp - lv.xp) / (next.xp - lv.xp)) * 100) : 100;
  const myRecords = classData.records.filter(r => r.studentId === student.id);

  async function handleSave() {
    if (!text.trim() || loading) return;
    setLoading(true);
    const oldLv = getLv(student.totalXp);
    const analysis = await analyzeWithAI(text);
    const rec = {
      id: Date.now(), studentId: student.id,
      date: new Date().toISOString().slice(0, 10),
      content: text, profiles: analysis.profiles, atl: analysis.atl, xp: analysis.xp,
      profileScores: analysis.profileScores, atlScores: analysis.atlScores, type: "AI",
    };
    const newTotalXp = student.totalXp + analysis.xp;
    await onAddRecord(rec, analysis.xp, analysis.profileScores, analysis.atlScores);
    setResult({ ...analysis, totalXp: newTotalXp });
    const newLv = getLv(newTotalXp);
    if (newLv.lv > oldLv.lv) setTimeout(() => setLevelUp({ fromLv: oldLv, toLv: newLv }), 800);
    setText(""); setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-green-50">
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-200 to-green-400 flex items-center justify-center text-xl shadow">{lv.icon}</div>
          <div>
            <div className="font-bold text-gray-800 text-sm flex items-center gap-2">{student.name}
              <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">Lv.{lv.lv} {lv.name}</span>
            </div>
            <div className="text-xs text-gray-400">{classData.code} · {classData.name}</div>
          </div>
        </div>
        <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-600">로그아웃</button>
      </div>

      <div className="px-4 pt-4">
        <div className="text-center mb-2"><p className="text-sm text-gray-500">안녕, <b className="text-gray-700">{student.name}</b>! 👋</p></div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100 mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1"><span>{student.totalXp} XP</span><span>{next ? next.xp : "MAX"} XP</span></div>
          <div className="h-5 bg-gray-100 rounded-full overflow-hidden relative">
            <div className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-orange-300 transition-all duration-700" style={{ width: `${pct}%` }} />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">내가 모은 경험치 ⭐</span>
          </div>
          {next && <p className="text-xs text-gray-400 text-center mt-1">다음 레벨까지 {next.xp - student.totalXp} XP 남아요! 💎</p>}
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl p-1 flex shadow-sm border border-gray-100">
          {[{ id: "record", l: "✏️ 기록하기" }, { id: "growth", l: "🌱 내 성장" }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? "bg-purple-500 text-white shadow" : "text-gray-500"}`}>{t.l}</button>
          ))}
        </div>
      </div>

      {tab === "record" ? (
        <div className="px-4 pb-8 space-y-4">
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-center font-bold text-gray-700 mb-1">오늘 나는 어떤 일을 했나요?</h3>
            <p className="text-center text-xs text-gray-400 mb-3">아래 카드들을 참고해서 글을 써봐요 😊</p>
            <div className="grid grid-cols-5 gap-2">
              {IB_PROFILES.map(p => (
                <div key={p.id} className="flex flex-col items-center gap-1 bg-gray-50 rounded-2xl p-2 hover:bg-purple-50 cursor-pointer transition-colors">
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-xs text-gray-600 text-center leading-tight">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
          <FileOCRUpload onOCRResult={t => setText(prev => prev ? prev + "\n" + t : t)} />
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-1">✏️ 오늘 있었던 일을 자유롭게 써봐요!</p>
            <p className="text-xs text-gray-400 mb-2">더 자세히 쓸수록 AI가 더 높은 점수를 줘요! ⭐</p>
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="예) 오늘 수업에서 환경 문제에 대해 배웠어요. 플라스틱이 바다를 오염시킨다는 걸 알고 깜짝 놀랐어요. 앞으로는 텀블러를 꼭 써야겠다고 생각했어요."
              className="w-full h-32 bg-gray-50 rounded-2xl p-3 text-sm text-gray-700 resize-none outline-none border border-gray-100 focus:border-purple-300 focus:bg-white transition-all" />
            {text && <p className="text-xs text-right text-gray-400 mt-1">{text.length}자</p>}
          </div>
          <button onClick={handleSave} disabled={loading || !text.trim()}
            className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl text-base transition-colors shadow-lg disabled:shadow-none">
            {loading ? "🤖 AI가 분석 중이에요..." : "⭐ 저장하기!"}
          </button>
        </div>
      ) : (
        <div className="px-4 pb-8 space-y-4">
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-3">🗺️ 나의 성장 여정</h3>
            <div className="space-y-2">
              {LEVELS.map(l => { const done = student.totalXp >= l.xp, cur = getLv(student.totalXp).lv === l.lv; return (
                <div key={l.lv} className={`flex items-center gap-3 p-2 rounded-xl ${cur ? "bg-yellow-50 border border-yellow-200" : done ? "bg-green-50" : "bg-gray-50"}`}>
                  <span className="text-xl">{l.icon}</span>
                  <div className="flex-1"><div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-500">Lv.{l.lv}</span><span className="text-sm font-semibold text-gray-700">{l.name}</span>{cur && <span className="text-xs bg-yellow-400 text-white px-2 py-0.5 rounded-full">현재!</span>}</div><span className="text-xs text-gray-400">{l.xp} XP부터</span></div>
                  {done ? <span className="text-green-400">✅</span> : <span className="text-gray-200">⭕</span>}
                </div>
              ); })}
            </div>
          </div>
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-3">🌟 나의 IB 역량 맵</h3>
            <RadarChart data={IB_PROFILES.map(p => student.profiles[p.id] || 0)} labels={IB_PROFILES.map(p => p.label.slice(0, 3))} size={220} />
            <div className="grid grid-cols-2 gap-2 mt-3">
              {IB_PROFILES.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <span>{p.icon}</span><span className="text-gray-600 flex-1">{p.label}</span>
                  <span className="font-bold" style={{ color: p.color }}>{student.profiles[p.id] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100"><h3 className="font-bold text-gray-700 mb-3">📊 ATL 기술</h3><ATLBars atl={student.atl} /></div>
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-700 mb-3">📝 최근 기록</h3>
            {myRecords.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">아직 기록이 없어요. 첫 기록을 남겨봐요! 🌱</p> : (
              <div className="space-y-3">{myRecords.slice(0, 5).map(r => (
                <div key={r.id} className="bg-gray-50 rounded-2xl p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex flex-wrap gap-1">{r.profiles.map(pid => { const p = IB_PROFILES.find(x => x.id === pid); return p ? <span key={pid} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: p.color }}>{p.icon} {p.label}</span> : null; })}</div>
                    <span className="text-xs text-green-500 font-bold ml-2">+{r.xp}XP</span>
                  </div>
                  <p className="text-sm text-gray-700">{r.content}</p>
                  <div className="flex justify-between mt-1"><span className="text-xs text-gray-400">{r.date}</span><span className={`text-xs ${r.type === "교사" ? "text-blue-500" : "text-purple-400"}`}>{r.type === "교사" ? "🏫 교사 부여" : "🤖 AI"}</span></div>
                  {r.comment && <p className="text-xs text-blue-600 mt-1 bg-blue-50 rounded-lg px-2 py-1">💬 {r.comment}</p>}
                </div>
              ))}</div>
            )}
          </div>
        </div>
      )}
      <ResultPopup result={result} onClose={() => setResult(null)} />
      {levelUp && <LevelUpPopup fromLv={levelUp.fromLv} toLv={levelUp.toLv} onClose={() => setLevelUp(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT GROWTH REPORT
// ═══════════════════════════════════════════════════════════════════════════════
function StudentReportView({ students, records, cls }) {
  const [selId, setSelId] = useState(students[0]?.id || null);
  const [printMode, setPrintMode] = useState(false);
  const st = students.find(s => s.id === selId);
  const stRecords = records.filter(r => r.studentId === selId);
  const lv = st ? getLv(st.totalXp) : LEVELS[0];
  const next = st ? getNext(st.totalXp) : null;
  const topProfiles = st ? [...IB_PROFILES].sort((a, b) => (st.profiles[b.id] || 0) - (st.profiles[a.id] || 0)).slice(0, 3) : [];

  function handlePrint() { setPrintMode(true); setTimeout(() => { window.print(); setPrintMode(false); }, 300); }
  if (!st) return <div className="p-6 text-gray-400 text-center">학생을 선택해주세요</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div><h1 className="text-xl font-bold text-gray-800">📄 학생 성장 리포트</h1><p className="text-xs text-gray-400 mt-0.5">개별 성장 리포트를 확인하고 인쇄할 수 있어요</p></div>
        <button onClick={handlePrint} className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">🖨️ 인쇄 / PDF 저장</button>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <p className="text-xs text-gray-500 mb-2 font-medium">학생 선택</p>
        <div className="flex flex-wrap gap-2">
          {students.map(s => (
            <button key={s.id} onClick={() => setSelId(s.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all ${selId === s.id ? "bg-purple-500 text-white font-bold shadow" : "bg-gray-100 text-gray-600 hover:bg-purple-100"}`}>
              <span>{getLv(s.totalXp).icon}</span><span>{s.name}</span><span className={`text-xs ${selId === s.id ? "text-purple-200" : "text-gray-400"}`}>{s.totalXp}XP</span>
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-purple-200">
          <div>
            <div className="flex items-center gap-3 mb-1"><span className="text-4xl">{lv.icon}</span><div><h2 className="text-2xl font-black text-gray-800">{st.name}</h2><p className="text-sm text-purple-600 font-semibold">Lv.{lv.lv} {lv.name} · {st.totalXp} XP</p></div></div>
            <p className="text-xs text-gray-500">{cls.name} · 학생 코드: {st.studentCode}</p>
            <p className="text-xs text-gray-400">보고서 생성일: {new Date().toLocaleDateString("ko-KR")}</p>
          </div>
          <div className="text-right"><div className="text-xs text-gray-400 mb-1">총 기록 수</div><div className="text-3xl font-bold text-purple-600">{stRecords.length}</div><div className="text-xs text-gray-400">건</div></div>
        </div>
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2">📈 XP 성장 현황</h3>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>현재: {st.totalXp} XP (Lv.{lv.lv} {lv.name})</span>
              <span>목표: {next ? `${next.xp} XP (Lv.${next.lv} ${next.name})` : "최고 레벨 달성! 🏆"}</span>
            </div>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all" style={{ width: `${next ? Math.round(((st.totalXp - lv.xp) / (next.xp - lv.xp)) * 100) : 100}%` }} />
            </div>
            {st.xpHistory && st.xpHistory.length > 1 && <div className="mt-2"><XPLineChart history={st.xpHistory} width={500} height={80} /></div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">🌟 IB 학습자상 역량 맵</h3>
            <div className="bg-gray-50 rounded-xl p-2"><RadarChart data={IB_PROFILES.map(p => st.profiles[p.id] || 0)} labels={IB_PROFILES.map(p => p.label.slice(0, 3))} size={200} /></div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">🏆 강점 학습자상 TOP 3</h3>
            <div className="space-y-2">
              {topProfiles.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <span className="text-lg font-bold text-gray-300">{["🥇","🥈","🥉"][i]}</span><span className="text-2xl">{p.icon}</span>
                  <div className="flex-1"><div className="text-sm font-bold text-gray-700">{p.label}</div><div className="h-2 bg-gray-200 rounded-full mt-1"><div className="h-full rounded-full" style={{ width: `${Math.min(100, ((st.profiles[p.id] || 0) / Math.max(...IB_PROFILES.map(x => st.profiles[x.id] || 0), 1)) * 100)}%`, backgroundColor: p.color }} /></div></div>
                  <span className="text-sm font-bold" style={{ color: p.color }}>{st.profiles[p.id] || 0}점</span>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-bold text-gray-700 mt-4 mb-2">📊 ATL 기술 현황</h3>
            <div className="bg-gray-50 rounded-xl p-3"><ATLBars atl={st.atl} /></div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">IB Grow · {cls.name} · {new Date().toLocaleDateString("ko-KR")} 생성</div>
      </div>
      <style>{`@media print { body > * { display: none !important; } body > div > div:last-child { display: block !important; } .no-print { display: none !important; } }`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEACHER APP
// ═══════════════════════════════════════════════════════════════════════════════
function TeacherApp({ teacher, classes, onLogout, onUpdateClass, onAddClass, dbOps }) {
  const [view, setView] = useState("dashboard");
  const [activeClsId, setActiveClsId] = useState(classes[0]?.id || null);
  const [selStudentId, setSelStudentId] = useState(null);
  const [grantForm, setGrantForm] = useState({ profile: "inquirer", xp: 5, comment: "" });
  const [ncName, setNcName] = useState("");
  const [ncCode, setNcCode] = useState("");
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [saving, setSaving] = useState(false);

  const cls = classes.find(c => c.id === activeClsId) || classes[0];
  const students = cls?.students || [];
  const records = cls?.records || [];
  const sorted = [...students].sort((a, b) => b.totalXp - a.totalXp);
  const selected = students.find(s => s.id === selStudentId);

  const avgP = Object.fromEntries(IB_PROFILES.map(p => [p.id, Math.round(students.reduce((s, st) => s + (st.profiles[p.id] || 0), 0) / Math.max(students.length, 1))]));
  const avgA = Object.fromEntries(ATL_SKILLS.map(s => [s.id, Math.round(students.reduce((a, st) => a + (st.atl[s.id] || 0), 0) / Math.max(students.length, 1))]));

  function upd(fn) { if (cls) onUpdateClass(cls.id, fn); }

  async function handleGrant() {
    if (!selected || !cls) return;
    const xp = Number(grantForm.xp);
    const profileScores = { [grantForm.profile]: xp };
    const rec = {
      id: Date.now(), studentId: selected.id, date: new Date().toISOString().slice(0, 10),
      content: `교사 직접 부여: ${IB_PROFILES.find(p => p.id === grantForm.profile)?.label}`,
      profiles: [grantForm.profile], atl: [], xp, type: "교사", comment: grantForm.comment, profileScores, atlScores: {},
    };
    setSaving(true);
    try {
      await dbOps.saveRecord(rec, cls.id);
      const newXp = selected.totalXp + xp;
      const newHist = [...(selected.xpHistory || []), { date: rec.date, xp: newXp }];
      const updatedStudent = { ...selected, totalXp: newXp, level: getLv(newXp).lv, profiles: { ...selected.profiles, [grantForm.profile]: (selected.profiles[grantForm.profile] || 0) + xp }, xpHistory: newHist };
      await dbOps.saveStudent(updatedStudent, cls.id);
      upd(c => ({
        ...c, records: [rec, ...c.records],
        students: c.students.map(s => s.id !== selected.id ? s : updatedStudent),
      }));
      setGrantForm({ profile: "inquirer", xp: 5, comment: "" });
      alert(`✅ ${selected.name}에게 ${xp}XP 부여!`);
    } catch (e) { alert("저장 실패: " + e.message); }
    setSaving(false);
  }

  async function addStudent(name) {
    if (!name.trim() || !cls) return;
    const num = (students.length > 0 ? Math.max(...students.map(s => s.num || 0)) : 0) + 1;
    const st = makeStudent(Date.now(), name.trim(), cls.code, num, "");
    setSaving(true);
    try {
      await dbOps.saveStudent(st, cls.id);
      upd(c => ({ ...c, students: [...c.students, st] }));
    } catch (e) { alert("학생 추가 실패: " + e.message); }
    setSaving(false);
  }

  async function removeStudent(st) {
    if (!window.confirm(`${st.name}을 삭제할까요?`)) return;
    setSaving(true);
    try {
      await dbOps.deleteStudent(st.id);
      upd(c => ({ ...c, students: c.students.filter(s => s.id !== st.id) }));
    } catch (e) { alert("삭제 실패: " + e.message); }
    setSaving(false);
  }

  async function updateStudentField(st, field, value) {
    const updated = { ...st, [field]: value };
    setSaving(true);
    try {
      await dbOps.saveStudent(updated, cls.id);
      upd(c => ({ ...c, students: c.students.map(s => s.id === st.id ? updated : s) }));
    } catch (e) { alert("수정 실패: " + e.message); }
    setSaving(false);
  }

  async function createClass() {
    if (!ncName.trim() || !ncCode.trim()) { alert("반 이름과 코드를 입력해주세요!"); return; }
    const newCls = { id: "cls_" + Date.now(), teacherId: teacher.id, code: ncCode.trim().toUpperCase(), name: ncName.trim(), students: [], records: [] };
    setSaving(true);
    try {
      await dbOps.saveClass(newCls);
      onAddClass(newCls);
      setNcName(""); setNcCode(""); setActiveClsId(newCls.id); setView("dashboard");
      alert("✅ 새 반이 만들어졌어요!");
    } catch (e) { alert("반 생성 실패: " + e.message); }
    setSaving(false);
  }

  const navItems = [
    { id: "dashboard", icon: "📊", label: "대시보드" },
    { id: "students",  icon: "👥", label: "학생 목록" },
    { id: "report",    icon: "📄", label: "성장 리포트" },
    { id: "roster",    icon: "📋", label: "학생 관리" },
    { id: "newclass",  icon: "➕", label: "새 반 만들기" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="w-60 bg-white border-r border-gray-100 flex flex-col shadow-sm shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-2xl">🏫</span>
          <div><div className="font-bold text-gray-800 text-sm">IB Grow</div><div className="text-xs text-gray-400">{teacher.name}</div></div>
        </div>
        {saving && <div className="px-3 py-1 bg-yellow-50 border-b border-yellow-100"><p className="text-xs text-yellow-600 text-center">💾 저장 중...</p></div>}
        {classes.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs text-gray-400 mb-1 font-medium">담당 반</p>
            {classes.map(c => (
              <button key={c.id} onClick={() => { setActiveClsId(c.id); setSelStudentId(null); setView("dashboard"); }}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs mb-0.5 transition-all ${activeClsId === c.id ? "bg-purple-100 text-purple-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}>
                <span className="font-mono">{c.code}</span><span className="text-gray-400 ml-1">{c.name}</span>
              </button>
            ))}
          </div>
        )}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setSelStudentId(null); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${view === item.id ? "bg-purple-50 text-purple-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        {cls && <div className="p-3 border-t border-gray-100">
          <div className="text-xs font-mono text-purple-500 bg-purple-50 rounded-lg px-2 py-1 mb-2 text-center">{cls.code}</div>
          <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center">로그아웃</button>
        </div>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === "dashboard" && cls && (
          <div className="p-6">
            <div className="mb-4"><h1 className="text-xl font-bold text-gray-800">{cls.name}</h1><p className="text-sm text-gray-400">{cls.code}</p></div>
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { l: "전체 학생", v: students.length, c: "text-purple-600", bg: "bg-purple-50" },
                { l: "평균 XP", v: Math.round(students.reduce((s, st) => s + st.totalXp, 0) / Math.max(students.length, 1)), c: "text-green-600", bg: "bg-green-50" },
                { l: "총 기록", v: records.length, c: "text-blue-600", bg: "bg-blue-50" },
                { l: "이번주 기록", v: records.filter(r => { const d = new Date(r.date); const now = new Date(); return (now - d) < 7 * 86400000; }).length, c: "text-yellow-600", bg: "bg-yellow-50" },
              ].map(s => (
                <div key={s.l} className={`${s.bg} rounded-2xl p-3 text-center border border-white shadow-sm`}>
                  <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-2 text-sm">🌟 반 평균 역량</h3>
                <RadarChart data={IB_PROFILES.map(p => avgP[p.id])} labels={IB_PROFILES.map(p => p.label.slice(0, 3))} size={180} />
              </div>
              <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-3 text-sm">📊 학습자상 상위 순위</h3>
                <div className="space-y-2.5">
                  {[...IB_PROFILES].sort((a, b) => (avgP[b.id] || 0) - (avgP[a.id] || 0)).map((p, i) => {
                    const maxVal = Math.max(...IB_PROFILES.map(x => avgP[x.id] || 0), 1);
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-4">{i + 1}</span><span className="text-sm">{p.icon}</span>
                        <span className="text-xs text-gray-600 w-20 shrink-0">{p.label}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${((avgP[p.id] || 0) / maxVal) * 100}%`, backgroundColor: p.color }} /></div>
                        <span className="text-xs font-bold w-6 text-right" style={{ color: p.color }}>{avgP[p.id] || 0}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"><h3 className="font-bold text-gray-700 mb-3 text-sm">📐 반 평균 ATL</h3><ATLBars atl={avgA} /></div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-3 text-sm">🏆 XP 순위</h3>
                <div className="space-y-1.5">
                  {sorted.slice(0, 6).map((st, i) => {
                    const lv = getLv(st.totalXp), nx = getNext(st.totalXp);
                    const p = nx ? Math.round(((st.totalXp - lv.xp) / (nx.xp - lv.xp)) * 100) : 100;
                    return (
                      <div key={st.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg p-1" onClick={() => { setSelStudentId(st.id); setView("student"); }}>
                        <span className={`text-xs font-bold w-4 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-400" : "text-gray-300"}`}>{i + 1}</span>
                        <span>{lv.icon}</span>
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-1 mb-0.5"><span className="text-xs font-semibold text-gray-700 truncate">{st.name}</span></div><div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full" style={{ width: `${p}%` }} /></div></div>
                        <span className="text-xs font-bold text-purple-600 shrink-0">{st.totalXp}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">📈 학생별 XP 성장 그래프</h3>
              <div className="grid grid-cols-2 gap-4">
                {sorted.slice(0, 4).map(st => (
                  <div key={st.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2"><span className="text-base">{getLv(st.totalXp).icon}</span><div><div className="text-xs font-bold text-gray-700">{st.name}</div><div className="text-xs text-purple-500">{st.totalXp} XP</div></div></div>
                    <XPLineChart history={st.xpHistory || []} width={240} height={80} />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">📝 최근 기록</h3>
              <div className="space-y-2">
                {records.slice(0, 5).map(r => {
                  const st = students.find(s => s.id === r.studentId);
                  return (
                    <div key={r.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-gray-50">
                      <div className="text-base mt-0.5">{getLv(st?.totalXp || 0).icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-700">{st?.name}</span><span className="text-xs text-green-500 font-bold">+{r.xp}XP</span><span className="text-xs text-gray-400">{r.date}</span></div>
                        <p className="text-xs text-gray-600 truncate">{r.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === "students" && cls && (
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-800 mb-6">👥 {cls.name}</h1>
            <div className="grid grid-cols-3 gap-4">
              {sorted.map(st => {
                const lv = getLv(st.totalXp);
                return (
                  <div key={st.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md cursor-pointer transition-all" onClick={() => { setSelStudentId(st.id); setView("student"); }}>
                    <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-green-100 flex items-center justify-center text-xl">{lv.icon}</div><div><div className="font-bold text-gray-800 text-sm">{st.name}</div><div className="text-xs text-purple-500">Lv.{lv.lv} {lv.name}</div></div></div>
                    <div className="text-center"><div className="text-2xl font-bold text-purple-600">{st.totalXp}</div><div className="text-xs text-gray-400">XP</div></div>
                    <div className="mt-2"><XPLineChart history={st.xpHistory || []} width={160} height={50} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "student" && selected && cls && (
          <div className="p-6">
            <button onClick={() => setView("students")} className="text-sm text-purple-500 mb-4 hover:underline">← 목록으로</button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-green-100 flex items-center justify-center text-2xl">{getLv(selected.totalXp).icon}</div>
              <div><h1 className="text-xl font-bold text-gray-800">{selected.name}</h1><span className="text-sm text-purple-500">Lv.{getLv(selected.totalXp).lv} {getLv(selected.totalXp).name} · {selected.totalXp} XP</span></div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4"><h3 className="font-bold text-gray-700 mb-2 text-sm">📈 XP 성장 그래프</h3><XPLineChart history={selected.xpHistory || []} width={500} height={100} /></div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"><h3 className="font-bold text-gray-700 mb-2 text-sm">🌟 학습자상</h3><RadarChart data={IB_PROFILES.map(p => selected.profiles[p.id] || 0)} labels={IB_PROFILES.map(p => p.label.slice(0, 3))} size={180} /></div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"><h3 className="font-bold text-gray-700 mb-2 text-sm">📊 ATL 기술</h3><div className="mt-4"><ATLBars atl={selected.atl} /></div></div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">🔍 학습자상 점수 상세</h3>
              <div className="grid grid-cols-2 gap-2">
                {IB_PROFILES.map(p => {
                  const val = selected.profiles[p.id] || 0;
                  const maxVal = Math.max(...IB_PROFILES.map(x => selected.profiles[x.id] || 0), 1);
                  return (
                    <div key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                      <span className="text-lg">{p.icon}</span>
                      <div className="flex-1 min-w-0"><div className="text-xs text-gray-600 truncate">{p.label}</div><div className="h-1.5 bg-gray-200 rounded-full mt-0.5"><div className="h-full rounded-full" style={{ width: `${(val / maxVal) * 100}%`, backgroundColor: p.color }} /></div></div>
                      <span className="text-sm font-bold shrink-0" style={{ color: p.color }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-green-50 rounded-2xl p-4 border border-purple-100 mb-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">🏅 교사 포인트 직접 부여</h3>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <select value={grantForm.profile} onChange={e => setGrantForm(f => ({ ...f, profile: e.target.value }))} className="bg-white rounded-xl border border-gray-200 px-2 py-2 text-xs">
                  {IB_PROFILES.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                </select>
                <input type="number" value={grantForm.xp} onChange={e => setGrantForm(f => ({ ...f, xp: e.target.value }))} min={1} max={50} className="bg-white rounded-xl border border-gray-200 px-2 py-2 text-xs" placeholder="점수" />
                <button onClick={handleGrant} disabled={saving} className="bg-purple-500 text-white rounded-xl px-3 py-2 text-xs font-bold hover:bg-purple-600 disabled:bg-purple-300 transition-colors">부여하기</button>
              </div>
              <input value={grantForm.comment} onChange={e => setGrantForm(f => ({ ...f, comment: e.target.value }))} placeholder="코멘트 (선택사항)" className="w-full bg-white rounded-xl border border-gray-200 px-3 py-2 text-xs" />
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">📝 기록 이력 ({records.filter(r => r.studentId === selected.id).length}건)</h3>
              <div className="space-y-3">
                {records.filter(r => r.studentId === selected.id).map(r => (
                  <div key={r.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex flex-wrap gap-1">{r.profiles.map(pid => { const p = IB_PROFILES.find(x => x.id === pid); return p ? <span key={pid} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: p.color }}>{p.icon} +{r.profileScores?.[pid] || r.xp}</span> : null; })}</div>
                      <div className="flex gap-1 ml-2 items-center"><span className={`text-xs ${r.type === "교사" ? "text-blue-500" : "text-purple-400"}`}>{r.type === "교사" ? "🏫" : "🤖"}</span><span className="text-xs text-green-500 font-bold">+{r.xp}XP</span></div>
                    </div>
                    <p className="text-sm text-gray-700">{r.content}</p>
                    {r.comment && <p className="text-xs text-blue-600 mt-1">💬 {r.comment}</p>}
                    <p className="text-xs text-gray-400 mt-1">{r.date}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "roster" && cls && (
          <div className="p-6">
            <div className="mb-5"><h1 className="text-xl font-bold text-gray-800">📋 학생 관리 — {cls.name}</h1><p className="text-xs text-gray-400 mt-1">학생별 개인 코드·비밀번호·접속 URL 관리</p></div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">➕ 학생 추가</h3>
              <AddStudentRow classCode={cls.code} nextNum={(students.length > 0 ? Math.max(...students.map(s => s.num || 0)) : 0) + 1} onAdd={addStudent} />
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <div className="col-span-2">이름 / XP</div><div className="col-span-2">학생 코드</div><div className="col-span-2">비밀번호</div><div className="col-span-4">개별 접속 URL</div><div className="col-span-2 text-center">관리</div>
              </div>
              {students.length === 0 && <p className="text-sm text-gray-400 text-center py-8">학생을 추가해주세요</p>}
              {students.map(st => (
                <div key={st.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 items-center">
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5"><span>{getLv(st.totalXp).icon}</span><span className="text-sm font-semibold text-gray-700">{st.name}</span></div>
                    <div className="text-xs text-purple-400 ml-5">{st.totalXp} XP</div>
                  </div>
                  <div className="col-span-2">
                    {editingStudentId === st.id ? (
                      <input defaultValue={st.studentCode} onBlur={e => { updateStudentField(st, "studentCode", e.target.value.toUpperCase()); setEditingStudentId(null); }}
                        className="w-full border border-purple-300 rounded-lg px-2 py-1 text-xs font-mono" autoFocus />
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded">{st.studentCode}</span>
                        <button onClick={() => setEditingStudentId(st.id)} className="text-gray-400 hover:text-gray-600 text-xs">✏️</button>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <input value={st.password || ""} onChange={e => updateStudentField(st, "password", e.target.value)}
                      placeholder="없음" className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs" />
                    {st.password && <span className="text-xs text-green-500">🔒 설정됨</span>}
                  </div>
                  <div className="col-span-4">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-blue-600 truncate font-mono bg-blue-50 px-2 py-0.5 rounded flex-1 overflow-hidden">{makeStudentUrl(st.studentCode)}</span>
                      <CopyButton text={makeStudentUrl(st.studentCode)} label="복사" />
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-center gap-2">
                    <button onClick={() => { setSelStudentId(st.id); setView("student"); }} className="text-xs text-purple-500 hover:text-purple-700">상세</button>
                    <button onClick={() => removeStudent(st)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                  </div>
                </div>
              ))}
            </div>
            {students.length > 0 && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                <h3 className="font-bold text-blue-700 mb-2 text-sm">📋 전체 접속 정보 복사</h3>
                <CopyButton
                  text={students.map(s => `${s.name}\t코드: ${s.studentCode}\tURL: ${makeStudentUrl(s.studentCode)}${s.password ? `\t비밀번호: ${s.password}` : ""}`).join("\n")}
                  label="📋 전체 접속 정보 복사" className="!text-sm !px-4 !py-2 !rounded-xl" />
              </div>
            )}
          </div>
        )}

        {view === "report" && cls && <StudentReportView students={sorted} records={records} cls={cls} />}

        {view === "newclass" && (
          <div className="p-6 max-w-lg">
            <h1 className="text-xl font-bold text-gray-800 mb-1">➕ 새 반 만들기</h1>
            <p className="text-sm text-gray-400 mb-6">새 반을 개설하면 학생들이 반 코드로 접속해요.</p>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div><label className="text-sm font-semibold text-gray-700 block mb-1">반 이름</label>
                <input value={ncName} onChange={e => setNcName(e.target.value)} placeholder="예: 매안초 3학년 5반" className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-xl px-3 py-2.5 text-sm outline-none" /></div>
              <div><label className="text-sm font-semibold text-gray-700 block mb-1">반 코드</label>
                <input value={ncCode} onChange={e => setNcCode(e.target.value.toUpperCase())} placeholder="예: MAEAN3-5" className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-xl px-3 py-2.5 text-sm font-mono outline-none" />
                <p className="text-xs text-gray-400 mt-1">학생 코드: {ncCode || "반코드"}-01, -02 … 자동 생성</p></div>
              <button onClick={createClass} disabled={saving} className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white font-bold py-3 rounded-xl transition-colors">🌱 반 만들기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddStudentRow({ classCode, nextNum, onAdd }) {
  const [name, setName] = useState("");
  function submit() { if (name.trim()) { onAdd(name.trim()); setName(""); } }
  return (
    <div className="flex gap-2 items-center">
      <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="학생 이름" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
      <span className="text-xs text-gray-400 font-mono whitespace-nowrap">→ {makeStudentCode(classCode, nextNum)}</span>
      <button onClick={submit} className="bg-green-500 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-green-600 transition-colors">추가</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER APP
// ═══════════════════════════════════════════════════════════════════════════════
function MasterApp({ teachers, classes, onLogout, onAddTeacher, onRemoveTeacher, onUpdateTeacher, dbOps }) {
  const [view, setView] = useState("overview");
  const [ntName, setNtName] = useState("");
  const [ntEmail, setNtEmail] = useState("");
  const [ntCode, setNtCode] = useState("TEACH-" + uid());
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const totalStudents = classes.reduce((s, c) => s + c.students.length, 0);
  const totalRecords  = classes.reduce((s, c) => s + c.records.length, 0);

  async function addTeacher() {
    if (!ntName.trim()) { alert("이름을 입력해주세요!"); return; }
    if (!ntCode.trim()) { alert("교사 코드를 입력해주세요!"); return; }
    const newTeacher = { id: "t_" + Date.now(), name: ntName.trim(), teacherCode: ntCode.trim().toUpperCase(), teacherPassword: "", email: ntEmail.trim(), classIds: [] };
    setSaving(true);
    try {
      await dbOps.saveTeacher(newTeacher);
      onAddTeacher(newTeacher);
      setNtName(""); setNtEmail(""); setNtCode("TEACH-" + uid());
      alert("✅ 교사 등록 완료!");
    } catch (e) { alert("교사 등록 실패: " + e.message); }
    setSaving(false);
  }

  function startEdit(t) { setEditingTeacherId(t.id); setEditForm({ name: t.name, teacherCode: t.teacherCode, email: t.email || "", teacherPassword: t.teacherPassword || "" }); }

  async function saveEdit(id) {
    setSaving(true);
    try {
      const updated = { teacherCode: editForm.teacherCode.toUpperCase(), name: editForm.name, email: editForm.email, teacherPassword: editForm.teacherPassword };
      await sb.update("teachers", id, { teacher_code: updated.teacherCode, name: updated.name, email: updated.email, teacher_password: updated.teacherPassword });
      onUpdateTeacher(id, t => ({ ...t, ...updated }));
      setEditingTeacherId(null);
    } catch (e) { alert("수정 실패: " + e.message); }
    setSaving(false);
  }

  async function removeTeacher(t) {
    if (!window.confirm(`${t.name} 교사를 삭제할까요?`)) return;
    setSaving(true);
    try {
      await dbOps.deleteTeacher(t.id);
      onRemoveTeacher(t.id);
    } catch (e) { alert("삭제 실패: " + e.message); }
    setSaving(false);
  }

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      <div className="w-56 bg-gray-800 flex flex-col shadow-xl shrink-0">
        <div className="p-4 border-b border-gray-700 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-sm font-bold text-white">M</div>
          <div><div className="font-bold text-white text-sm">IB Grow</div><div className="text-xs text-yellow-400">마스터 관리자</div></div>
        </div>
        {saving && <div className="px-3 py-1 bg-yellow-900/50 border-b border-yellow-700"><p className="text-xs text-yellow-400 text-center">💾 저장 중...</p></div>}
        <nav className="flex-1 p-3 space-y-1">
          {[{ id: "overview", icon: "📊", label: "전체 현황" }, { id: "teachers", icon: "👩‍🏫", label: "교사 관리" }, { id: "classes", icon: "🏫", label: "반 현황" }].map(item => (
            <button key={item.id} onClick={() => setView(item.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${view === item.id ? "bg-yellow-500 text-white font-semibold" : "text-gray-400 hover:bg-gray-700 hover:text-white"}`}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-700">
          <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-200 w-full text-center">로그아웃</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {view === "overview" && (
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-800 mb-6">📊 전체 현황</h1>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { l: "교사", v: teachers.length, c: "text-purple-600", bg: "bg-purple-50" },
                { l: "반", v: classes.length, c: "text-blue-600", bg: "bg-blue-50" },
                { l: "학생", v: totalStudents, c: "text-green-600", bg: "bg-green-50" },
                { l: "기록", v: totalRecords, c: "text-yellow-600", bg: "bg-yellow-50" },
              ].map(s => (
                <div key={s.l} className={`${s.bg} rounded-2xl p-4 border border-white shadow-sm text-center`}><div className={`text-3xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-gray-500 mt-1">{s.l}</div></div>
              ))}
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-3">🏫 전체 반 목록</h3>
              <div className="space-y-2">{classes.map(c => {
                const t = teachers.find(x => x.id === c.teacherId);
                const avgXp = Math.round(c.students.reduce((s, st) => s + st.totalXp, 0) / Math.max(c.students.length, 1));
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="flex-1"><div className="flex items-center gap-2"><span className="font-mono text-sm font-bold text-purple-600">{c.code}</span><span className="text-sm text-gray-700">{c.name}</span></div><span className="text-xs text-gray-400">담임: {t?.name || "미지정"}</span></div>
                    <div className="text-right"><div className="text-sm font-bold text-gray-700">{c.students.length}명</div><div className="text-xs text-gray-400">평균 {avgXp} XP</div></div>
                  </div>
                );
              })}</div>
            </div>
          </div>
        )}

        {view === "teachers" && (
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-800 mb-6">👩‍🏫 교사 관리</h1>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">➕ 교사 등록</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input value={ntName} onChange={e => setNtName(e.target.value)} placeholder="교사 이름 *" className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                <input value={ntEmail} onChange={e => setNtEmail(e.target.value)} placeholder="이메일 (선택)" className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">교사 코드 (직접 수정 가능)</label>
                  <input value={ntCode} onChange={e => setNtCode(e.target.value.toUpperCase())} placeholder="TEACH-XXXX" className="w-full border-2 border-purple-200 focus:border-purple-400 rounded-xl px-3 py-2 text-sm font-mono outline-none" />
                </div>
                <div className="flex items-end">
                  <button onClick={() => setNtCode("TEACH-" + uid())} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs text-gray-600 transition-colors">🎲 랜덤</button>
                </div>
              </div>
              <button onClick={addTeacher} disabled={saving} className="bg-purple-500 text-white rounded-xl px-5 py-2 text-sm font-bold hover:bg-purple-600 disabled:bg-purple-300 transition-colors">등록하기</button>
            </div>
            <div className="space-y-3">
              {teachers.map(t => {
                const tClasses = classes.filter(c => c.teacherId === t.id);
                const isEditing = editingTeacherId === t.id;
                return (
                  <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="이름" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                          <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="이메일" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className="text-xs text-gray-500">교사 코드</label><input value={editForm.teacherCode} onChange={e => setEditForm(f => ({ ...f, teacherCode: e.target.value.toUpperCase() }))} className="w-full border border-purple-300 rounded-lg px-2 py-1.5 text-sm font-mono mt-0.5" /></div>
                          <div><label className="text-xs text-gray-500">교사 비밀번호 (선택)</label><input value={editForm.teacherPassword} onChange={e => setEditForm(f => ({ ...f, teacherPassword: e.target.value }))} placeholder="없으면 비워두세요" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" /></div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(t.id)} disabled={saving} className="bg-purple-500 text-white rounded-lg px-4 py-1.5 text-xs font-bold disabled:bg-purple-300">저장</button>
                          <button onClick={() => setEditingTeacherId(null)} className="bg-gray-100 text-gray-600 rounded-lg px-4 py-1.5 text-xs">취소</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-orange-100 flex items-center justify-center text-xl">👩‍🏫</div>
                          <div>
                            <div className="font-bold text-gray-800">{t.name}</div>
                            {t.email && <div className="text-xs text-gray-400">{t.email}</div>}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-mono bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">🔑 {t.teacherCode}</span>
                              <CopyButton text={t.teacherCode} label="복사" />
                              {t.teacherPassword && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded">🔒 비밀번호 설정됨</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(t)} className="text-xs text-purple-500 hover:text-purple-700 px-3 py-1 border border-purple-200 rounded-lg hover:bg-purple-50">수정</button>
                          <button onClick={() => removeTeacher(t)} className="text-xs text-red-400 hover:text-red-600 px-3 py-1 border border-red-200 rounded-lg hover:bg-red-50">삭제</button>
                        </div>
                      </div>
                    )}
                    {!isEditing && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">담당 반 ({tClasses.length}개)</p>
                        {tClasses.length === 0 ? <p className="text-xs text-gray-400">담당 반 없음</p> : (
                          <div className="flex flex-wrap gap-2">{tClasses.map(c => <span key={c.id} className="text-xs font-mono bg-purple-50 text-purple-600 px-2 py-0.5 rounded">{c.code}</span>)}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {teachers.length === 0 && <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm border border-gray-100">등록된 교사가 없어요.</div>}
            </div>
          </div>
        )}

        {view === "classes" && (
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-800 mb-6">🏫 반 현황</h1>
            <div className="space-y-4">{classes.map(c => {
              const t = teachers.find(x => x.id === c.teacherId);
              return (
                <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div><div className="flex items-center gap-2"><span className="font-mono font-bold text-purple-600 text-lg">{c.code}</span><span className="font-bold text-gray-800">{c.name}</span></div><span className="text-xs text-gray-400">담임: {t?.name || "미지정"} · 학생 {c.students.length}명 · 기록 {c.records.length}건</span></div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {c.students.slice(0, 10).map(s => (
                      <div key={s.id} className="flex items-center gap-1 text-xs bg-gray-50 rounded-lg px-2 py-1"><span>{getLv(s.totalXp).icon}</span><span className="text-gray-700 truncate">{s.name}</span><span className="text-purple-400 shrink-0">{s.totalXp}</span></div>
                    ))}
                  </div>
                </div>
              );
            })}
            {classes.length === 0 && <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm border border-gray-100">아직 개설된 반이 없어요.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ teachers, classes, onStudentLogin, onTeacherLogin, onMasterLogin }) {
  const [step, setStep] = useState("role");
  const [studentCode, setStudentCode] = useState("");
  const [studentPw, setStudentPw] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherPw, setTeacherPw] = useState("");
  const [masterId, setMasterId] = useState("");
  const [masterPw, setMasterPw] = useState("");
  const [foundStudent, setFoundStudent] = useState(null);
  const [foundTeacher, setFoundTeacher] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const sc = new URLSearchParams(window.location.search).get("student");
    if (sc) lookupStudent(sc);
  }, []);

  function lookupStudent(code) {
    const upper = (code || studentCode).trim().toUpperCase();
    for (const cls of classes) {
      const st = cls.students.find(s => s.studentCode.toUpperCase() === upper);
      if (st) {
        setFoundStudent({ student: st, classData: cls });
        if (st.password) { setStep("student-pw"); setError(""); }
        else { onStudentLogin(st, cls); }
        return;
      }
    }
    setError("코드를 찾을 수 없어요. 선생님께 확인해봐요!");
  }

  function handleStudentPw() {
    if (!foundStudent) return;
    if (foundStudent.student.password === studentPw) onStudentLogin(foundStudent.student, foundStudent.classData);
    else setError("비밀번호가 틀렸어요!");
  }

  function handleTeacherCode() {
    const t = teachers.find(x => x.teacherCode === teacherCode.trim().toUpperCase());
    if (!t) { setError("교사 코드를 다시 확인해주세요!"); return; }
    if (t.teacherPassword) { setFoundTeacher(t); setStep("teacher-pw"); setError(""); }
    else { onTeacherLogin(t); }
  }

  function handleTeacherPw() {
    if (!foundTeacher) return;
    if (foundTeacher.teacherPassword === teacherPw) onTeacherLogin(foundTeacher);
    else setError("비밀번호가 틀렸어요!");
  }

  function handleMasterLogin() {
    if (masterId === MASTER_ID && masterPw === MASTER_PW) onMasterLogin();
    else setError("아이디 또는 비밀번호가 틀렸어요!");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-green-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8"><div className="text-6xl mb-3">🌱</div><h1 className="text-2xl font-black text-gray-800">IB Grow</h1><p className="text-sm text-gray-500">나의 IB 역량 성장 여정을 시작해봐요!</p></div>

        {step === "role" && (
          <div className="space-y-3">
            <button onClick={() => { setStep("student-code"); setError(""); }} className="w-full bg-white border-2 border-purple-200 hover:border-purple-400 rounded-3xl p-5 text-left transition-all shadow-sm hover:shadow-md">
              <div className="text-3xl mb-2">👦</div><div className="font-bold text-gray-800">학생으로 시작하기</div><div className="text-xs text-gray-400 mt-1">나만의 개인 코드로 로그인해요</div>
            </button>
            <button onClick={() => { setStep("teacher"); setError(""); }} className="w-full bg-white border-2 border-orange-200 hover:border-orange-400 rounded-3xl p-5 text-left transition-all shadow-sm hover:shadow-md">
              <div className="text-3xl mb-2">👩‍🏫</div><div className="font-bold text-gray-800">선생님으로 시작하기</div><div className="text-xs text-gray-400 mt-1">교사 코드로 로그인해요</div>
            </button>
            <button onClick={() => { setStep("master"); setError(""); }} className="w-full bg-white border-2 border-gray-200 hover:border-gray-400 rounded-3xl p-4 text-left transition-all shadow-sm hover:shadow-md">
              <div className="flex items-center gap-2"><span className="text-lg">🔐</span><div><div className="font-semibold text-gray-600 text-sm">관리자 로그인</div><div className="text-xs text-gray-400">마스터 계정</div></div></div>
            </button>
          </div>
        )}

        {step === "student-code" && (
          <div className="bg-white rounded-3xl p-6 shadow-md">
            <h2 className="font-bold text-gray-800 mb-1">🔑 나만의 코드를 입력해요</h2>
            <p className="text-xs text-gray-400 mb-4">선생님께 받은 개인 코드 (예: MAEAN3-5-01)</p>
            <input value={studentCode} onChange={e => setStudentCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && lookupStudent()}
              placeholder="예: MAEAN3-5-01" className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-lg font-mono outline-none mb-3" />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button onClick={() => lookupStudent()} className="w-full bg-purple-500 text-white font-bold py-3 rounded-2xl hover:bg-purple-600 transition-colors">로그인 →</button>
            <button onClick={() => { setStep("role"); setError(""); }} className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600">← 뒤로</button>
          </div>
        )}

        {step === "student-pw" && foundStudent && (
          <div className="bg-white rounded-3xl p-6 shadow-md">
            <h2 className="font-bold text-gray-800 mb-1">🔒 비밀번호를 입력해요</h2>
            <p className="text-xs text-gray-400 mb-1">안녕하세요, <b className="text-purple-600">{foundStudent.student.name}</b>!</p>
            <p className="text-xs text-gray-400 mb-4">{foundStudent.classData.name}</p>
            <input type="password" value={studentPw} onChange={e => setStudentPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handleStudentPw()}
              placeholder="비밀번호" className="w-full border-2 border-gray-200 focus:border-purple-400 rounded-2xl px-4 py-3 text-lg outline-none mb-3" />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button onClick={handleStudentPw} className="w-full bg-purple-500 text-white font-bold py-3 rounded-2xl hover:bg-purple-600 transition-colors">입장하기 🌱</button>
            <button onClick={() => { setStep("student-code"); setStudentPw(""); setError(""); }} className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600">← 뒤로</button>
          </div>
        )}

        {step === "teacher" && (
          <div className="bg-white rounded-3xl p-6 shadow-md">
            <h2 className="font-bold text-gray-800 mb-1">👩‍🏫 교사 코드 입력</h2>
            <p className="text-xs text-gray-400 mb-4">관리자로부터 발급받은 교사 코드를 입력하세요</p>
            <input value={teacherCode} onChange={e => setTeacherCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && handleTeacherCode()}
              placeholder="예: TEACH-T1" className="w-full border-2 border-gray-200 focus:border-orange-400 rounded-2xl px-4 py-3 text-base font-mono outline-none mb-3" />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button onClick={handleTeacherCode} className="w-full bg-orange-400 text-white font-bold py-3 rounded-2xl hover:bg-orange-500 transition-colors">다음 →</button>
            <button onClick={() => { setStep("role"); setError(""); }} className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600">← 뒤로</button>
          </div>
        )}

        {step === "teacher-pw" && foundTeacher && (
          <div className="bg-white rounded-3xl p-6 shadow-md">
            <h2 className="font-bold text-gray-800 mb-1">🔒 교사 비밀번호</h2>
            <p className="text-xs text-gray-400 mb-4">{foundTeacher.name} 선생님, 비밀번호를 입력해주세요</p>
            <input type="password" value={teacherPw} onChange={e => setTeacherPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handleTeacherPw()}
              placeholder="비밀번호" className="w-full border-2 border-gray-200 focus:border-orange-400 rounded-2xl px-4 py-3 text-lg outline-none mb-3" />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button onClick={handleTeacherPw} className="w-full bg-orange-400 text-white font-bold py-3 rounded-2xl hover:bg-orange-500 transition-colors">로그인</button>
            <button onClick={() => { setStep("teacher"); setTeacherPw(""); setError(""); }} className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600">← 뒤로</button>
          </div>
        )}

        {step === "master" && (
          <div className="bg-white rounded-3xl p-6 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-sm font-bold text-white">M</div>
              <div><h2 className="font-bold text-gray-800">마스터 관리자</h2><p className="text-xs text-gray-400">전체 플랫폼 관리</p></div>
            </div>
            <input value={masterId} onChange={e => setMasterId(e.target.value)} onKeyDown={e => e.key === "Enter" && handleMasterLogin()}
              placeholder="아이디" className="w-full border-2 border-gray-200 focus:border-yellow-400 rounded-2xl px-4 py-3 text-base outline-none mb-2" />
            <input type="password" value={masterPw} onChange={e => setMasterPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handleMasterLogin()}
              placeholder="비밀번호" className="w-full border-2 border-gray-200 focus:border-yellow-400 rounded-2xl px-4 py-3 text-base outline-none mb-3" />
            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
            <button onClick={handleMasterLogin} className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold py-3 rounded-2xl hover:from-yellow-500 hover:to-orange-500 transition-all">로그인</button>
            <button onClick={() => { setStep("role"); setError(""); }} className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600">← 뒤로</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — Supabase data loading + state management
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dbError, setDbError]   = useState(null);
  const [mode, setMode]         = useState("login");
  const [currentStudentId, setCurrentStudentId] = useState(null);
  const [currentClassId, setCurrentClassId]     = useState(null);
  const [currentTeacherId, setCurrentTeacherId] = useState(null);

  // ── Load all data from Supabase on mount ────────────────────────────────────
  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setDbError(null);
    try {
      const [teacherRows, classRows, studentRows, recordRows] = await Promise.all([
        sb.select("teachers", "?order=created_at.asc"),
        sb.select("classes",  "?order=created_at.asc"),
        sb.select("students", "?order=num.asc"),
        sb.select("records",  "?order=date.desc"),
      ]);

      const mappedTeachers = teacherRows.map(row => ({
        id: row.id,
        name: row.name,
        teacherCode: row.teacher_code,
        teacherPassword: row.teacher_password || "",
        email: row.email || "",
        classIds: row.class_ids || [],
      }));

      const mappedClasses = classRows.map(row => {
        const classStudents = studentRows
          .filter(s => s.class_id === row.id)
          .map(s => dbRowToStudent(s));
        const classRecords = recordRows
          .filter(r => r.class_id === row.id)
          .map(r => dbRowToRecord(r));
        return {
          id: row.id,
          teacherId: row.teacher_id,
          code: row.code,
          name: row.name,
          students: classStudents,
          records: classRecords,
        };
      });

      setTeachers(mappedTeachers);
      setClasses(mappedClasses);
    } catch (e) {
      console.error("DB load error:", e);
      setDbError(e.message);
    }
    setLoading(false);
  }

  // ── DB operations object passed to components ────────────────────────────────
  const dbOps = {
    async saveRecord(rec, classId) {
      await sb.upsert("records", recordToDbRow(rec, classId));
    },
    async saveStudent(student, classId) {
      await sb.upsert("students", studentToDbRow(student, classId));
    },
    async deleteStudent(id) {
      await sb.delete("students", id);
    },
    async saveTeacher(teacher) {
      await sb.upsert("teachers", {
        id: teacher.id, name: teacher.name, teacher_code: teacher.teacherCode,
        teacher_password: teacher.teacherPassword || "", email: teacher.email || "", class_ids: teacher.classIds || [],
      });
    },
    async deleteTeacher(id) {
      await sb.delete("teachers", id);
    },
    async saveClass(cls) {
      await sb.upsert("classes", { id: cls.id, teacher_id: cls.teacherId, code: cls.code, name: cls.name });
    },
  };

  // ── State update helpers ─────────────────────────────────────────────────────
  const classData   = classes.find(c => c.id === currentClassId);
  const liveStudent = classData?.students.find(s => s.id === currentStudentId);
  const liveTeacher = teachers.find(t => t.id === currentTeacherId);
  const teacherClasses = classes.filter(c => c.teacherId === currentTeacherId);

  function updateClass(classId, fn) { setClasses(cs => cs.map(c => c.id === classId ? fn(c) : c)); }

  async function addRecord(classId, record, xpTotal, profileScores, atlScores) {
    // Optimistic local update
    setClasses(cs => cs.map(c => {
      if (c.id !== classId) return c;
      const students = c.students.map(s => {
        if (s.id !== record.studentId) return s;
        const newXp = s.totalXp + xpTotal;
        const newProfiles = { ...s.profiles };
        Object.entries(profileScores || {}).forEach(([pid, score]) => { newProfiles[pid] = (newProfiles[pid] || 0) + (score || 0); });
        const newAtl = { ...s.atl };
        Object.entries(atlScores || {}).forEach(([aid, score]) => { newAtl[aid] = (newAtl[aid] || 0) + (score || 0); });
        const newHist = [...(s.xpHistory || []), { date: record.date, xp: newXp }];
        return { ...s, totalXp: newXp, level: getLv(newXp).lv, profiles: newProfiles, atl: newAtl, xpHistory: newHist };
      });
      return { ...c, students, records: [record, ...c.records] };
    }));

    // Persist to DB
    try {
      await dbOps.saveRecord(record, classId);
      // Update student in DB
      const updatedClass = classes.find(c => c.id === classId);
      const student = updatedClass?.students.find(s => s.id === record.studentId);
      if (student) {
        const newXp = student.totalXp + xpTotal;
        const newProfiles = { ...student.profiles };
        Object.entries(profileScores || {}).forEach(([pid, score]) => { newProfiles[pid] = (newProfiles[pid] || 0) + (score || 0); });
        const newAtl = { ...student.atl };
        Object.entries(atlScores || {}).forEach(([aid, score]) => { newAtl[aid] = (newAtl[aid] || 0) + (score || 0); });
        const newHist = [...(student.xpHistory || []), { date: record.date, xp: newXp }];
        const updatedStudent = { ...student, totalXp: newXp, level: getLv(newXp).lv, profiles: newProfiles, atl: newAtl, xpHistory: newHist };
        await dbOps.saveStudent(updatedStudent, classId);
      }
    } catch (e) { console.error("DB save error:", e); }
  }

  function addTeacherFn(t)      { setTeachers(ts => [...ts, t]); }
  function removeTeacherFn(id)  { setTeachers(ts => ts.filter(t => t.id !== id)); }
  function updateTeacherFn(id, fn) { setTeachers(ts => ts.map(t => t.id === id ? fn(t) : t)); }

  function addClassForTeacher(cls) {
    setClasses(cs => [...cs, cls]);
    setTeachers(ts => ts.map(t => t.id === cls.teacherId ? { ...t, classIds: [...(t.classIds || []), cls.id] } : t));
  }

  function logout() { setMode("login"); setCurrentStudentId(null); setCurrentClassId(null); setCurrentTeacherId(null); }

  // ── Loading / error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-green-50 flex flex-col items-center justify-center gap-4">
        <div className="text-5xl">🌱</div>
        <h1 className="text-xl font-black text-gray-800">IB Grow</h1>
        <Spinner text="데이터를 불러오는 중..." />
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-lg font-bold text-red-700">Supabase 연결 오류</h2>
        <p className="text-sm text-red-500 text-center max-w-sm">{dbError}</p>
        <p className="text-xs text-gray-500 text-center max-w-sm">Supabase URL, anon key, 테이블 RLS 정책을 확인해주세요.</p>
        <button onClick={loadAll} className="mt-2 bg-red-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-600">다시 시도</button>
      </div>
    );
  }

  if (mode === "login") {
    return <LoginScreen teachers={teachers} classes={classes}
      onStudentLogin={(st, cls) => { setCurrentStudentId(st.id); setCurrentClassId(cls.id); setMode("student"); }}
      onTeacherLogin={t => { setCurrentTeacherId(t.id); setMode("teacher"); }}
      onMasterLogin={() => setMode("master")} />;
  }
  if (mode === "student" && liveStudent && classData) {
    return <StudentApp student={liveStudent} classData={classData}
      onAddRecord={(rec, xp, ps, as) => addRecord(currentClassId, rec, xp, ps, as)}
      onLogout={logout} />;
  }
  if (mode === "teacher" && liveTeacher) {
    return <TeacherApp teacher={liveTeacher} classes={teacherClasses}
      onLogout={logout} onUpdateClass={updateClass} dbOps={dbOps}
      onAddClass={cls => addClassForTeacher({ ...cls, teacherId: liveTeacher.id })} />;
  }
  if (mode === "master") {
    return <MasterApp teachers={teachers} classes={classes}
      onLogout={logout} onAddTeacher={addTeacherFn} onRemoveTeacher={removeTeacherFn}
      onUpdateTeacher={updateTeacherFn} dbOps={dbOps} />;
  }
  return null;
}
