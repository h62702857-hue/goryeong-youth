import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Users, Settings, Clock, Download, X, Monitor, Music,
  Gamepad2, BookOpen, Coffee, Camera, LogOut, BarChart3,
  Sparkles, Info, CalendarDays, TrendingUp, Trash2
} from 'lucide-react';

/* ═══════════════════════════════════════════════
   글로벌 CSS (Tailwind에 없는 애니메이션 보완)
   ═══════════════════════════════════════════════ */
const GlobalCSS = () => (
  <style>{`
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    @keyframes zoomIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
    @keyframes slideRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
    @keyframes slideTop{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    .anim-fade{animation:fadeIn .2s ease forwards}
    .anim-zoom{animation:zoomIn .2s ease forwards}
    .anim-right{animation:slideRight .2s ease forwards}
    .anim-top{animation:slideTop .25s ease forwards}
    .anim-spin{animation:spin 1s linear infinite}
    .scrollbar-thin::-webkit-scrollbar{width:4px}
    .scrollbar-thin::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px}
    input[type=number]::-webkit-inner-spin-button{opacity:1}
  `}</style>
);

/* ═══════════════════════════════════════════════
   설정 및 상수
   ═══════════════════════════════════════════════ */
const APP_VERSION = "v6-3-2 Navy+Sky";

const ROOM_DEFS = [
  { id:'dvd1',    name:'DVD1',   mixed:false, multi:false, waitable:true,  iconType:'tv' },
  { id:'dvd2',    name:'DVD2',   mixed:false, multi:false, waitable:true,  iconType:'tv' },
  { id:'karaoke1',name:'노래1',  mixed:false, multi:false, waitable:true,  iconType:'mic' },
  { id:'karaoke2',name:'노래2',  mixed:false, multi:false, waitable:true,  iconType:'mic' },
  { id:'karaoke3',name:'노래3',  mixed:false, multi:false, waitable:true,  iconType:'mic' },
  { id:'dance',   name:'댄스실', mixed:true,  multi:false, waitable:true,  iconType:'music' },
  { id:'music',   name:'음악실', mixed:true,  multi:false, waitable:true,  iconType:'music' },
  { id:'club1',   name:'동아리1',mixed:true,  multi:false, waitable:true,  iconType:'users' },
  { id:'club2',   name:'동아리2',mixed:true,  multi:false, waitable:true,  iconType:'users' },
  { id:'edu',     name:'교육실', mixed:true,  multi:false, waitable:false, iconType:'book' },
  { id:'book',    name:'북카페', mixed:true,  multi:true,  waitable:false, iconType:'book' },
  { id:'lounge',  name:'휴게실', mixed:true,  multi:true,  waitable:false, iconType:'coffee' },
  { id:'internet',name:'인터넷', mixed:true,  multi:true,  waitable:false, iconType:'monitor' },
  { id:'board',   name:'보드게임',mixed:true,  multi:true,  waitable:false, iconType:'game' },
];

const CATEGORIES = ['초등','중등','고등','대학','일반'];

// 메인화면 표시 순서 (5열 x 3줄)
const DISPLAY_ORDER = [
  'dvd1','dvd2','book','lounge','internet',
  'board','dance','karaoke1','karaoke2','karaoke3',
  'music','club1','club2','edu'
];

const ICON_MAP = {
  tv: <Monitor size={12}/>, mic: <Music size={12}/>, music: <Music size={12}/>,
  users: <Users size={12}/>, book: <BookOpen size={12}/>, coffee: <Coffee size={12}/>,
  monitor: <Monitor size={12}/>, game: <Gamepad2 size={12}/>
};

/* ═══════════════════════════════════════════════
   유틸리티
   ═══════════════════════════════════════════════ */
const formatHHMM = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
};
const maskName = (n) => {
  if(!n) return '';
  if(n.length<=1) return n+'**';
  return n.charAt(0)+'*'.repeat(n.length-1);
};
const uid = () => Math.random().toString(36).substr(2,9);

/* ═══════════════════════════════════════════════
   IndexedDB 로컬 저장 (태블릿 한 대 전용)
   ═══════════════════════════════════════════════ */
const DB_NAME = 'YouthCenterDB';
const DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs',{keyPath:'id',autoIncrement:true});
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings',{keyPath:'key'});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbSaveLogs(logs) {
  const db = await openDB();
  const tx = db.transaction('logs','readwrite');
  const store = tx.objectStore('logs');
  store.clear();
  logs.forEach(l => store.add({...l, id: undefined}));
}

async function dbLoadLogs() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('logs','readonly');
    const req = tx.objectStore('logs').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function dbSaveSetting(key, value) {
  const db = await openDB();
  const tx = db.transaction('settings','readwrite');
  tx.objectStore('settings').put({key, value});
}

async function dbLoadSetting(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('settings','readonly');
    const req = tx.objectStore('settings').get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => resolve(null);
  });
}

/* ═══════════════════════════════════════════════
   Anthropic API (키 불필요)
   ═══════════════════════════════════════════════ */
async function callClaude(prompt, systemPrompt) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1000,
        system: systemPrompt || '',
        messages:[{role:'user',content:prompt}]
      })
    });
    const data = await res.json();
    return (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n') || null;
  } catch(e) {
    console.error('Claude API error:',e);
    return null;
  }
}

/* ═══════════════════════════════════════════════
   RoomCard 컴포넌트
   ═══════════════════════════════════════════════ */
function RoomCard({room, onClick, onEarlyCheckout, isAdmin}) {
  const isOccupied = room.occupants.length > 0;
  const isClosed = room.status === 'closed';
  const soonestExit = isOccupied
    ? [...room.occupants].sort((a,b)=>new Date(a.endTime)-new Date(b.endTime))[0].endTime
    : null;
  const icon = ICON_MAP[room.iconType] || <Monitor size={14}/>;
  const displayName = (n) => isAdmin ? n : maskName(n);

  return (
    <div className={`relative flex flex-col transition-all overflow-hidden rounded-xl border-2 h-full
      ${isClosed ? 'bg-red-50 opacity-80 border-red-200' : 'bg-white shadow-sm border-slate-200 hover:border-sky-300'}`}>
      {/* 헤더 */}
      <div className={`p-1.5 px-2 ${isClosed?'bg-red-100':'bg-sky-50'} flex justify-between items-center`}>
        <span className={`font-black ${isClosed?'text-red-900':'text-sky-800'} truncate max-w-[70%]`} style={{fontSize:13}}>{room.name}</span>
        <div className={isClosed?'text-red-400':'text-sky-500'}>{isClosed ? <Settings size={14}/> : icon}</div>
      </div>
      {/* 바디 */}
      <div className="p-2 flex-grow flex flex-col justify-between" style={{minHeight:115}}>
        {isClosed ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500 py-1">
            <Settings size={16} className="mb-1"/>
            <span className="text-center leading-tight whitespace-pre-wrap font-bold" style={{fontSize:11}}>{room.disabledReason||'수리 및 점검중'}</span>
          </div>
        ) : (
          <div className="h-full flex flex-col justify-center">
            {isOccupied ? (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className={`px-1.5 py-0.5 rounded font-black ${!room.multi?'bg-amber-100 text-amber-700 border border-amber-200':'bg-sky-50 text-sky-700 border border-sky-200'}`} style={{fontSize:10}}>
                    {room.multi?'다팀이용':'사용중'}
                  </span>
                  {!room.multi && <span className="text-slate-600 font-bold truncate" style={{fontSize:11,maxWidth:60}}>{displayName(room.occupants[0].name)}</span>}
                </div>
                <div className="py-1.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center text-slate-800 relative group">
                  <span className="font-black" style={{fontSize:13}}>{formatHHMM(soonestExit)}</span>
                  <button onClick={(e)=>{e.stopPropagation();onEarlyCheckout(room.id,0);}}
                    className="absolute inset-0 bg-red-500 text-white font-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-lg shadow-md cursor-pointer"
                    style={{fontSize:11}}>퇴실하기</button>
                </div>
                {room.waitable && room.waitlist.length > 0 && (
                  <div className="text-amber-600 font-black text-center" style={{fontSize:10}}>
                    대기 {room.waitlist.length}팀
                    {room.waitlist.map((w,i)=>(
                      <div key={i} className="text-amber-500 font-bold truncate" style={{fontSize:10}}>{i+1}. {displayName(w.name)}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-300 font-bold py-2 flex flex-col items-center gap-1" style={{fontSize:12}}>
                <Info size={16} className="text-sky-200"/>신청가능
              </div>
            )}
          </div>
        )}
      </div>
      {/* 하단 버튼 */}
      {!isClosed && !isOccupied && (
        <div onClick={onClick} className="bg-sky-400 py-2.5 cursor-pointer text-center font-black text-white hover:bg-sky-500 transition-colors rounded-b-xl" style={{fontSize:12}}>신청하기</div>
      )}
      {!isClosed && isOccupied && (room.multi || (room.waitable && room.waitlist.length < 2)) && (
        <div onClick={onClick} className="bg-sky-50 py-2.5 cursor-pointer text-center border-t border-sky-100 font-black text-sky-600 hover:bg-sky-400 hover:text-white transition-colors rounded-b-xl" style={{fontSize:12}}>
          {room.multi ? '추가등록' : '대기등록'}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   신청 모달
   ═══════════════════════════════════════════════ */
function RegistrationModal({room, onClose, onSubmit, showToast}) {
  const [form, setForm] = useState({name:'', maleCount:'', femaleCount:'', categoryCounts:{'초등':'','중등':'','고등':'','대학':'','일반':''}});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTip, setAiTip] = useState('');

  const gT = parseInt(form.maleCount||0) + parseInt(form.femaleCount||0);
  const cT = Object.values(form.categoryCounts).reduce((a,b)=>a+parseInt(b||0),0);

  const getAI = async () => {
    if (cT===0) return showToast('인원을 먼저 입력해 주세요.','error');
    setAiLoading(true);
    const cats = Object.entries(form.categoryCounts).filter(([,v])=>parseInt(v)>0).map(([k])=>k).join(', ');
    const res = await callClaude(
      `활동실 [${room.name}]을 이용하려는 [${cats}] 학생들에게 줄 3가지 창의적인 활동 추천 리스트를 한국어로 짧게 작성해줘.`,
      '청소년 활동 전문가. 간결하게 답변.'
    );
    setAiTip(res || 'AI 추천을 불러올 수 없습니다.');
    setAiLoading(false);
  };

  const icon = ICON_MAP[room.iconType] || <Monitor size={12}/>;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-2 text-slate-700" style={{background:'rgba(0,0,0,.5)',backdropFilter:'blur(2px)'}}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden anim-zoom border border-sky-200">
        <div className="p-3 flex justify-between items-center bg-sky-50">
          <h3 className="font-black flex items-center gap-2 text-sky-800" style={{fontSize:14}}>{icon} {room.name} 이용신청</h3>
          <button onClick={onClose} className="p-1 hover:bg-sky-200 rounded-full text-sky-600"><X size={18}/></button>
        </div>
        <div className="p-4 space-y-3">
          {/* AI 추천 */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-2.5 rounded-lg border border-sky-100 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="font-black text-sky-600 flex items-center gap-1" style={{fontSize:11}}><Sparkles size={12}/> AI 활동추천</span>
              <button onClick={getAI} disabled={aiLoading} className="text-white px-3 py-1 rounded-full font-bold shadow-sm bg-sky-500 hover:bg-sky-600" style={{fontSize:10}}>
                {aiLoading ? <span className="anim-spin inline-block">⏳</span> : '추천받기'}
              </button>
            </div>
            {aiTip && <div className="text-slate-600 leading-relaxed whitespace-pre-wrap anim-fade" style={{fontSize:9}}>{aiTip}</div>}
          </div>

          {/* 이름 */}
          <div className="space-y-1">
            <label className="block font-black text-slate-600 ml-1" style={{fontSize:12}}>대표자 / 팀명</label>
            <input autoFocus placeholder="이름 입력" className="w-full p-2.5 bg-slate-50 border-2 rounded-lg outline-none focus:ring-2 focus:ring-sky-200 border-slate-200 font-bold"
              style={{fontSize:13}} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          </div>

          {/* 성별 */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center font-black text-slate-600" style={{fontSize:12}}>
              <span>성별 인원</span><span className="text-sky-600">합계: {gT}</span>
            </div>
            {!room.mixed && <div className="bg-amber-50 text-amber-700 p-2 rounded-lg text-center font-bold" style={{fontSize:11}}>⚠ 혼성 이용 불가 시설</div>}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center bg-blue-50 p-1.5 rounded-lg border border-blue-200">
                <span className="font-black text-blue-600 w-8 ml-1" style={{fontSize:12}}>남</span>
                <input type="number" min="0" placeholder="0" className="bg-transparent w-full text-center font-black outline-none py-1"
                  style={{fontSize:14}} value={form.maleCount} onChange={e=>setForm({...form,maleCount:e.target.value})}/>
              </div>
              <div className="flex items-center bg-pink-50 p-1.5 rounded-lg border border-pink-200">
                <span className="font-black text-pink-600 w-8 ml-1" style={{fontSize:12}}>여</span>
                <input type="number" min="0" placeholder="0" className="bg-transparent w-full text-center font-black outline-none py-1"
                  style={{fontSize:14}} value={form.femaleCount} onChange={e=>setForm({...form,femaleCount:e.target.value})}/>
              </div>
            </div>
          </div>

          {/* 교급 */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center font-black text-slate-600" style={{fontSize:12}}>
              <span>교급별 인원</span>
              <span className={gT===cT && gT>0?'text-green-600':'text-red-500'}>합계: {cT}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {CATEGORIES.map(cat=>(
                <div key={cat} className="bg-slate-50 p-1.5 rounded-lg border border-slate-200 flex flex-col items-center hover:bg-sky-50 transition-colors">
                  <span className="text-slate-500 font-black" style={{fontSize:10}}>{cat}</span>
                  <input type="number" min="0" placeholder="0" className="w-full text-center font-black bg-transparent outline-none py-0.5"
                    style={{fontSize:14}} value={form.categoryCounts[cat]}
                    onChange={e=>setForm({...form,categoryCounts:{...form.categoryCounts,[cat]:e.target.value}})}/>
                </div>
              ))}
            </div>
          </div>

          <button disabled={!form.name||gT<=0||gT!==cT} onClick={()=>onSubmit(form)}
            className="w-full py-3 hover:opacity-90 disabled:bg-slate-300 text-white rounded-xl font-black shadow-md transition-all active:scale-95"
            style={{fontSize:13,background:(!form.name||gT<=0||gT!==cT)?undefined:'#38bdf8'}}>
            {gT<=0 ? '인원을 입력하세요' : gT!==cT ? '성별·교급 합계 불일치' : '신청 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   관리자 대시보드
   ═══════════════════════════════════════════════ */
function AdminDashboard({rooms, updateRoom, logs, setLogs, password, setPassword, showToast, setConfirmModal}) {
  const [tab, setTab] = useState('status');
  const [newPw, setNewPw] = useState('');
  const [curPw, setCurPw] = useState('');
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selMonth, setSelMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`);

  const changeMonth = useCallback((dir)=>{
    setSelMonth(prev=>{
      const [y,m] = prev.split('-').map(Number);
      const d = new Date(y, m-1+dir, 1);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    });
  },[]);

  const selMonthLabel = useMemo(()=>{
    const [y,m] = selMonth.split('-');
    return `${y}년 ${parseInt(m)}월`;
  },[selMonth]);

  const filtered = useMemo(()=>logs.filter(l=>l.monthKey===selMonth),[logs,selMonth]);

  const stats = useMemo(()=>{
    const s = {daily:{},hourly:Array(24).fill(0),gender:{남:0,여:0},type:{주중:0,주말:0},roomDetails:{}};
    ROOM_DEFS.forEach(r=>s.roomDetails[r.name]={total:0,male:0,female:0,weekday:0,weekend:0,cats:{'초등':0,'중등':0,'고등':0,'대학':0,'일반':0}});
    filtered.forEach(l=>{
      s.daily[l.date]=(s.daily[l.date]||0)+1; s.hourly[l.time]++; s.gender[l.gender]++; s.type[l.type]++;
      if(s.roomDetails[l.room]){const rd=s.roomDetails[l.room];rd.total++;if(l.gender==='남')rd.male++;else rd.female++;if(l.type==='주중')rd.weekday++;else rd.weekend++;rd.cats[l.category]++;}
    });
    return s;
  },[filtered]);

  const downloadCSV = ()=>{
    if(!filtered.length) return showToast('데이터 없음','error');
    const h='\uFEFF날짜,시간대,활동실,성별,교급,구분\n';
    const rows=filtered.map(l=>`${l.date},${l.time}시,${l.room},${l.gender},${l.category},${l.type}`).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([h+rows],{type:'text/csv;charset=utf-8;'}));
    a.download=`고령_통계_${selMonth}.csv`;a.click();
  };

  const genReport = async ()=>{
    if(!filtered.length) return showToast('데이터 없음','error');
    setAiLoading(true);
    const summary = JSON.stringify({total:filtered.length,gender:stats.gender,type:stats.type,peakHour:stats.hourly.indexOf(Math.max(...stats.hourly))});
    const res = await callClaude(`이 ${selMonth} 데이터를 운영 관리 리포트로 분석해줘: ${summary}`, '데이터 분석 전문가. 한국어로 간결하게.');
    setAiReport(res||'리포트 생성 실패');
    setAiLoading(false);
  };

  const resetStats = ()=>{
    setConfirmModal({title:'통계 초기화',message:'모든 통계를 삭제합니다. 복구 불가.',onConfirm:()=>{setLogs([]);setConfirmModal(null);showToast('초기화 완료','success');}});
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-sky-100 flex flex-col h-full overflow-hidden">
      {/* 탭 */}
      <div className="flex bg-slate-50 border-b overflow-x-auto shrink-0" style={{height:44}}>
        {[{id:'status',label:'실시간 현황',icon:<Monitor size={14}/>},{id:'stats',label:'통계 분석',icon:<TrendingUp size={14}/>},{id:'settings',label:'설정',icon:<Settings size={14}/>}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`px-5 py-1.5 font-black flex shrink-0 items-center gap-2 transition-all ${tab===t.id?'text-sky-600 border-b-2 border-sky-400 bg-white shadow-sm':'text-slate-400'}`}
            style={{fontSize:12}}>{t.icon} {t.label}</button>
        ))}
      </div>

      <div className="flex-grow overflow-hidden p-2">
        {/* ── 실시간 현황 ── */}
        {tab==='status' && (
          <div className="grid grid-cols-5 gap-1.5 h-full overflow-y-auto pr-1 scrollbar-thin">
            {DISPLAY_ORDER.map(rid=>{const room=rooms.find(r=>r.id===rid);if(!room)return null;
              const totalNum = room.occupants.reduce((a,c)=>a+parseInt(c.maleCount||0)+parseInt(c.femaleCount||0),0);
              const icon = ICON_MAP[room.iconType] || <Monitor size={12}/>;
              return (
                <div key={room.id} className={`p-2 rounded-lg border-2 flex flex-col gap-1 shadow-sm ${room.status==='closed'?'bg-red-50 border-red-200':'bg-white border-slate-200 hover:border-sky-300 transition-all'}`}>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1 font-black">
                    <span className={`truncate ${room.status==='closed'?'text-red-800':'text-slate-800'}`} style={{fontSize:12}}>{room.name}</span>
                    <input type="checkbox" className="cursor-pointer" style={{transform:'scale(.85)'}}
                      checked={room.status==='open'} onChange={e=>updateRoom(room.id,{status:e.target.checked?'open':'closed'})}/>
                  </div>
                  <div className="flex-grow space-y-1" style={{minHeight:90}}>
                    {room.status==='closed'?(
                      <div className="p-1 space-y-1 anim-fade">
                        <span className="font-black text-red-500 flex items-center gap-1" style={{fontSize:10}}><Settings size={10}/> 점검중</span>
                        <textarea className="w-full p-1.5 bg-white border border-red-200 rounded-lg outline-none resize-none shadow-inner font-bold" style={{fontSize:11,height:48}}
                          placeholder="수리 사유 입력" value={room.disabledReason} onChange={e=>updateRoom(room.id,{disabledReason:e.target.value})}/>
                      </div>
                    ):(
                      <>
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-black text-sky-600" style={{fontSize:10}}>이용현황</span>
                          <span className="text-white px-1.5 rounded font-black shadow-sm bg-sky-500" style={{fontSize:10}}>{totalNum}</span>
                        </div>
                        {room.occupants.map((occ,idx)=>(
                          <div key={idx} className="bg-slate-50 p-1.5 rounded-lg border border-slate-200 flex justify-between shadow-sm anim-right" style={{fontSize:11}}>
                            <b>{occ.name}</b><span className="text-red-500 font-black">{formatHHMM(occ.endTime)}</span>
                          </div>
                        ))}
                        {room.waitable && room.waitlist.length>0 && (
                          <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-200 mt-1 space-y-1.5 shadow-inner">
                            <div className="flex justify-between items-center border-b border-amber-100 pb-0.5">
                              <span className="font-black text-amber-700" style={{fontSize:10}}>대기목록</span>
                              <span className="bg-amber-200 text-amber-800 px-1.5 rounded-full font-black" style={{fontSize:9}}>{room.waitlist.length}</span>
                            </div>
                            {room.waitlist.map((w,idx)=>(
                              <div key={idx} className="border-b border-amber-100 last:border-0 py-0.5 space-y-0.5" style={{fontSize:10}}>
                                <div className="font-black text-amber-900 flex justify-between items-center">
                                  <span style={{fontSize:11}}>{w.name}</span>
                                  <span className="text-amber-600 bg-white px-1.5 rounded border border-amber-100 font-black">D-{idx+1}</span>
                                </div>
                                <div className="text-slate-600 font-bold flex justify-between items-center">
                                  <span>남{w.maleCount||0}/여{w.femaleCount||0}</span>
                                  <span className="bg-amber-100 px-1 rounded text-amber-700" style={{fontSize:9}}>
                                    {w.categoryCounts ? Object.entries(w.categoryCounts).filter(([,v])=>parseInt(v||0)>0).map(([k,v])=>`${k}${v}`).join(' ') : ''}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button onClick={()=>setConfirmModal({title:'초기화',message:`${room.name} 정보를 초기화할까요?`,onConfirm:()=>{updateRoom(room.id,{occupants:[],waitlist:[]});setConfirmModal(null);showToast(`${room.name} 초기화됨`,'success');}})}
                    className="py-1.5 bg-red-100 text-red-600 font-black rounded-lg border border-red-200 mt-auto hover:bg-red-200 active:scale-95 transition-all" style={{fontSize:10}}>초기화</button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 통계 ── */}
        {tab==='stats' && (
          <div className="h-full flex flex-col gap-2 overflow-hidden">
            <div className="flex justify-between items-center px-1 shrink-0" style={{height:32}}>
              <h2 className="font-black flex items-center gap-2 text-slate-800" style={{fontSize:14}}><BarChart3 size={16} className="text-sky-600"/> 통계 분석</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border border-sky-200 rounded-lg overflow-hidden shadow-sm">
                  <button onClick={()=>changeMonth(-1)} className="px-3 py-1.5 hover:bg-sky-50 text-slate-700 font-black transition-colors" style={{fontSize:14}}>◀</button>
                  <span className="px-4 py-1.5 font-black text-slate-800 border-x border-sky-100 bg-sky-50" style={{fontSize:12,minWidth:90,textAlign:'center'}}>{selMonthLabel}</span>
                  <button onClick={()=>changeMonth(1)} className="px-3 py-1.5 hover:bg-sky-50 text-slate-700 font-black transition-colors" style={{fontSize:14}}>▶</button>
                </div>
                <button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg font-black flex items-center gap-2 transition-all shadow-md active:scale-95" style={{fontSize:11}}>
                  <Download size={12}/> CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 shrink-0">
              {[
                {label:'총 이용자',val:`${filtered.length}명`,color:'navy'},
                {label:'남 / 여',val:`${stats.gender.남} / ${stats.gender.여}`,color:'slate'},
                {label:'주중 / 주말',val:`${stats.type.주중} / ${stats.type.주말}`,color:'slate'},
                {label:'피크 시간',val:`${stats.hourly.indexOf(Math.max(...stats.hourly))}시`,color:'amber'},
              ].map((c,i)=>(
                <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                  <span className="font-black text-slate-400 mb-1" style={{fontSize:10}}>{c.label}</span>
                  <span className={`font-black ${c.color==='navy'?'text-sky-600':c.color==='amber'?'text-amber-600':'text-slate-700'}`} style={{fontSize:c.color==='navy'?24:13}}>{c.val}</span>
                </div>
              ))}
            </div>

            {/* AI 리포트 */}
            <div className="p-2.5 px-4 rounded-xl flex justify-between items-center shadow-lg shrink-0 bg-sky-50">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-sky-600"/>
                <span className="font-black text-sky-800" style={{fontSize:12}}>AI 운영 리포트 ({selMonthLabel})</span>
                {aiReport && <div className="ml-4 text-sky-600 opacity-90 truncate border-l border-sky-200 pl-4" style={{fontSize:9,maxWidth:400}}>{aiReport.slice(0,100)}...</div>}
              </div>
              <button onClick={genReport} disabled={aiLoading} className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-1 rounded-full font-black border border-sky-300 flex items-center gap-1.5 transition-all shadow-sm" style={{fontSize:10}}>
                {aiLoading ? <span className="anim-spin inline-block">⏳</span> : '✨ 생성'}
              </button>
            </div>

            {/* 시설별 테이블 */}
            <div className="flex-grow bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
              <div className="bg-slate-50 p-1.5 px-3 border-b font-black text-slate-600 flex items-center gap-2 shrink-0" style={{fontSize:9}}>
                <CalendarDays size={12} className="text-sky-500"/> 시설별 상세 분석
              </div>
              <div className="flex-grow overflow-y-auto scrollbar-thin">
                <table className="w-full text-left" style={{fontSize:9,tableLayout:'fixed'}}>
                  <thead className="bg-slate-50 text-slate-400 sticky top-0 font-black border-b z-10">
                    <tr>
                      <th className="p-2 border-r" style={{width:'15%'}}>시설</th>
                      <th className="p-2 border-r text-center" style={{width:'10%'}}>이용</th>
                      <th className="p-2 border-r text-center" style={{width:'15%'}}>남/여</th>
                      <th className="p-2 border-r text-center" style={{width:'15%'}}>중/말</th>
                      <th className="p-2 text-center" style={{width:'45%'}}>교급</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700 font-bold">
                    {DISPLAY_ORDER.map(id=>{const r=ROOM_DEFS.find(x=>x.id===id);if(!r)return null;const d=stats.roomDetails[r.name];if(!d)return null;return(
                      <tr key={r.id} className="hover:bg-blue-50/40 transition-colors" style={{height:32}}>
                        <td className="p-1 px-3 font-black text-slate-800 border-r">{r.name}</td>
                        <td className="p-1 text-center font-black border-r bg-slate-50/50">{d.total}</td>
                        <td className="p-1 text-center border-r"><span className="text-blue-600">{d.male}</span>/<span className="text-pink-600">{d.female}</span></td>
                        <td className="p-1 text-center border-r font-medium text-slate-500">{d.weekday}/{d.weekend}</td>
                        <td className="p-1"><div className="flex gap-1 justify-center flex-wrap">
                          {CATEGORIES.map(c=><span key={c} className={`px-1.5 rounded font-black ${d.cats[c]>0?'bg-sky-400 text-white shadow-sm':'bg-slate-100 text-slate-300'}`} style={{fontSize:8}}>{c[0]}:{d.cats[c]}</span>)}
                        </div></td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 시간대 히트맵 + 일별 */}
            <div className="grid grid-cols-2 gap-2 shrink-0 pb-1" style={{height:112}}>
              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <span className="font-black text-slate-400 block mb-1" style={{fontSize:8}}>시간대별 히트맵</span>
                <div className="flex-grow grid grid-cols-12 gap-1 content-center">
                  {stats.hourly.map((h,i)=>(
                    <div key={i} title={`${i}시`} className={`rounded-md flex items-center justify-center font-black transition-all ${h>0?'bg-sky-400 text-white shadow-sm scale-105':'bg-slate-50 text-slate-200'}`} style={{fontSize:9,height:24}}>{h}</div>
                  ))}
                </div>
                <div className="flex justify-between text-slate-300 mt-0.5 font-black px-1" style={{fontSize:7}}><span>0시</span><span>12시</span><span>23시</span></div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <span className="font-black text-slate-400 block mb-1" style={{fontSize:8}}>일별 이용 추이</span>
                <div className="flex-grow overflow-y-auto scrollbar-thin space-y-1">
                  {Object.entries(stats.daily).length>0 ? Object.entries(stats.daily).sort((a,b)=>new Date(b[0])-new Date(a[0])).map(([d,c])=>(
                    <div key={d} className="flex justify-between border-b border-slate-50 py-0.5 font-bold items-center" style={{fontSize:9}}>
                      <span className="text-slate-600">{d}</span>
                      <span className="text-blue-600 bg-blue-50 px-2 rounded-full flex items-center" style={{height:16}}>{c}명</span>
                    </div>
                  )) : <div className="text-slate-300 italic text-center py-2" style={{fontSize:9}}>데이터 없음</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 설정 ── */}
        {tab==='settings' && (
          <div className="max-w-xs mx-auto py-12 space-y-4 text-center">
            <div className="text-center space-y-1 mb-6 border-b border-slate-100 pb-6">
              <label className="text-xs font-black text-slate-700 flex items-center justify-center gap-2">🔐 관리자 설정</label>
              <p className="text-slate-400 font-bold" style={{fontSize:10}}>{APP_VERSION}</p>
            </div>
            <div className="shadow-sm p-4 rounded-2xl bg-white border border-slate-100 space-y-4">
              <div className="space-y-1.5 text-left">
                <span className="font-black text-slate-400 ml-1 flex items-center gap-1.5" style={{fontSize:10}}>현재 비밀번호</span>
                <input type="password" placeholder="현재 비밀번호" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-100 font-bold"
                  value={curPw} onChange={e=>setCurPw(e.target.value)}/>
              </div>
              <div className="space-y-1.5 text-left">
                <span className="font-black text-slate-400 ml-1 flex items-center gap-1.5" style={{fontSize:10}}>새 비밀번호</span>
                <input type="password" placeholder="새 비밀번호" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-100 font-bold"
                  value={newPw} onChange={e=>setNewPw(e.target.value)}/>
              </div>
              <button onClick={()=>{
                if(curPw===password){setPassword(newPw);dbSaveSetting('adminPw',newPw);showToast('비밀번호 변경 완료','success');setCurPw('');setNewPw('');}
                else showToast('비밀번호 불일치','error');
              }} className="w-full py-3 bg-sky-400 text-white rounded-lg font-black text-xs shadow-xl active:scale-95 transition-all">변경하기</button>
            </div>
            <div className="mt-10 p-5 border border-red-100 rounded-2xl bg-red-50/40 space-y-3 shadow-inner">
              <div className="flex items-center justify-center gap-2 text-red-600 font-black" style={{fontSize:10}}><Trash2 size={16}/> 데이터 초기화</div>
              <p className="text-slate-500 leading-relaxed font-bold" style={{fontSize:9}}>모든 전체 로그 데이터가 삭제됩니다. 삭제 전 CSV 백업을 권장합니다.</p>
              <button onClick={resetStats} className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-black shadow-lg active:scale-95 transition-all" style={{fontSize:9}}>전체 데이터 초기화</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   메인 앱
   ═══════════════════════════════════════════════ */
export default function App() {
  const [rooms, setRooms] = useState(ROOM_DEFS.map(r=>({...r,status:'open',disabledReason:'',occupants:[],waitlist:[]})));
  const [logs, setLogs] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPw, setAdminPw] = useState('1234');
  const [showLogin, setShowLogin] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [captureImage, setCaptureImage] = useState(null);
  const captureRef = useRef(null);
  const clickCnt = useRef(0);
  const clickTmr = useRef(null);

  const showToast = useCallback((text,type='info')=>{
    setToast({text,type});
    setTimeout(()=>setToast(null),2500);
  },[]);

  const handleLogoClick = useCallback(()=>{
    clickCnt.current++;
    if(clickCnt.current>=5){setShowLogin(true);clickCnt.current=0;}
    clearTimeout(clickTmr.current);
    clickTmr.current=setTimeout(()=>{clickCnt.current=0;},2000);
  },[]);

  /* ── IndexedDB: 로드 ── */
  useEffect(()=>{
    (async()=>{
      try {
        const savedLogs = await dbLoadLogs();
        if(savedLogs.length) setLogs(savedLogs);
        const savedPw = await dbLoadSetting('adminPw');
        if(savedPw) setAdminPw(savedPw);
        // rooms 복원 (이용자, 대기자, 상태)
        const savedRooms = await dbLoadSetting('rooms');
        if(savedRooms) {
          setRooms(prev => prev.map(room => {
            const saved = savedRooms.find(r => r.id === room.id);
            if(saved) return { ...room, occupants: saved.occupants||[], waitlist: saved.waitlist||[], status: saved.status||'open', disabledReason: saved.disabledReason||'' };
            return room;
          }));
        }
      } catch(e){console.error('DB load error:',e);}
    })();
  },[]);

  /* ── IndexedDB: 저장 (logs 변경 시) ── */
  const logsSaveTimer = useRef(null);
  useEffect(()=>{
    clearTimeout(logsSaveTimer.current);
    logsSaveTimer.current = setTimeout(()=>{
      dbSaveLogs(logs).catch(e=>console.error('DB save error:',e));
    }, 500);
  },[logs]);

  /* ── IndexedDB: rooms 저장 (변경 시) ── */
  const roomsSaveTimer = useRef(null);
  useEffect(()=>{
    clearTimeout(roomsSaveTimer.current);
    roomsSaveTimer.current = setTimeout(()=>{
      const toSave = rooms.map(r=>({id:r.id, occupants:r.occupants, waitlist:r.waitlist, status:r.status, disabledReason:r.disabledReason}));
      dbSaveSetting('rooms', toSave).catch(e=>console.error('DB rooms save error:',e));
    }, 500);
  },[rooms]);

  /* ── 자동 퇴실 & 승계 (10초) ── */
  const promoteWaitlist = useCallback((room, curOcc)=>{
    if(!room.waitlist.length) return {...room,occupants:curOcc};
    const next = room.waitlist[0];
    const wl = room.waitlist.slice(1);
    const st = new Date();
    const et = new Date(st.getTime()+3600000);
    const newOcc = {...next,startTime:st.toISOString(),endTime:et.toISOString()};
    logActivity(room,next);
    showToast(`${room.name} 대기팀(${maskName(next.name)}) 이용 시작!`,'success');
    return {...room,occupants:[...curOcc,newOcc],waitlist:wl};
  },[showToast]);

  useEffect(()=>{
    const iv = setInterval(()=>{
      const now = new Date();
      setRooms(prev=>prev.map(room=>{
        const remaining = room.occupants.filter(o=>new Date(o.endTime)>now);
        if(remaining.length<room.occupants.length && room.waitlist.length>0 && !room.multi){
          return promoteWaitlist(room,remaining);
        }
        return {...room,occupants:remaining};
      }));
    },10000);
    return ()=>clearInterval(iv);
  },[promoteWaitlist]);

  /* ── 로그 기록 ── */
  const logActivity = useCallback((room,data)=>{
    const now = new Date();
    const isWeekend = now.getDay()===0||now.getDay()===6;
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const genders=[]; const cats=[];
    for(let i=0;i<parseInt(data.maleCount||0);i++) genders.push('남');
    for(let i=0;i<parseInt(data.femaleCount||0);i++) genders.push('여');
    CATEGORIES.forEach(c=>{for(let i=0;i<parseInt(data.categoryCounts?.[c]||0);i++) cats.push(c);});
    const newLogs=[];
    for(let i=0;i<Math.min(genders.length,cats.length);i++){
      newLogs.push({date:now.toLocaleDateString('ko-KR'),monthKey,time:now.getHours(),room:room.name,gender:genders[i],category:cats[i]||'일반',type:isWeekend?'주말':'주중'});
    }
    setLogs(prev=>[...prev,...newLogs]);
  },[]);

  /* ── 이용 신청 ── */
  const handleRegister = useCallback((room,formData)=>{
    const m=parseInt(formData.maleCount||0), f=parseInt(formData.femaleCount||0), gT=m+f;
    const cT=Object.values(formData.categoryCounts).reduce((a,b)=>a+parseInt(b||0),0);
    if(gT<=0) return showToast('이용 인원을 입력하세요.','error');
    if(gT!==cT) return showToast('성별 합계와 교급별 합계가 불일치합니다.','error');
    if(!room.mixed&&m>0&&f>0) return showToast('혼성 불가 시설입니다.','error');

    const st=new Date(), et=new Date(st.getTime()+3600000);
    const entry={...formData,startTime:st.toISOString(),endTime:et.toISOString()};

    if(room.multi){
      updateRoom(room.id,{occupants:[...room.occupants,entry]});
      logActivity(room,formData);
      showToast(`${room.name} 등록 완료`,'success');
    } else {
      if(room.occupants.length===0){
        updateRoom(room.id,{occupants:[entry]});
        logActivity(room,formData);
        showToast(`${room.name} 이용 시작`,'success');
      } else if(room.waitable&&room.waitlist.length<2){
        updateRoom(room.id,{waitlist:[...room.waitlist,formData]});
        showToast(`${room.name} 대기 등록`,'success');
      } else {
        showToast('정원 초과','error');
      }
    }
    setSelectedRoom(null);
  },[showToast,logActivity]);

  const updateRoom = useCallback((id,updates)=>setRooms(p=>p.map(r=>r.id===id?{...r,...updates}:r)),[]);

  const handleEarlyCheckout = useCallback((roomId,idx)=>{
    const room = rooms.find(r=>r.id===roomId);
    if(!room) return;
    setConfirmModal({title:'퇴실 확인',message:`${room.name} 이용을 중단하시겠습니까?`,onConfirm:()=>{
      setRooms(prev=>prev.map(r=>{
        if(r.id!==roomId) return r;
        const upd=r.occupants.filter((_,i)=>i!==idx);
        if(!r.multi&&r.waitlist.length>0) return promoteWaitlist(r,upd);
        showToast(`${r.name} 퇴실 완료`,'success');
        return {...r,occupants:upd};
      }));
      setConfirmModal(null);
    }});
  },[rooms,promoteWaitlist,showToast]);

  /* ── 화면 캡처 (이미지 팝업으로 표시) ── */
  const captureScreen = useCallback(()=>{
    const target = captureRef.current;
    if(!target) return showToast('캡처 대상 없음','error');

    if(!window.html2canvas){
      showToast('캡처 모듈 로딩 중... 잠시 후 다시 시도','error');
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      document.head.appendChild(s);
      return;
    }

    showToast('캡처 중...','info');

    // overflow 임시 해제
    const saved=[];
    document.querySelectorAll('*').forEach(el=>{
      const cs=window.getComputedStyle(el);
      if(cs.overflow==='hidden'||cs.overflowY==='hidden'){
        saved.push({el,ov:el.style.overflow,ovY:el.style.overflowY,h:el.style.height,maxH:el.style.maxHeight});
        el.style.overflow='visible';el.style.overflowY='visible';el.style.height='auto';el.style.maxHeight='none';
      }
    });

    setTimeout(()=>{
      window.html2canvas(target,{backgroundColor:'#f0f9ff',scale:2,useCORS:true,logging:false}).then(canvas=>{
        const imgData = canvas.toDataURL('image/png');
        setCaptureImage(imgData);
        // 다운로드도 시도
        try{const a=document.createElement('a');a.download=`고령현황_${Date.now()}.png`;a.href=imgData;a.click();}catch(e){}
        showToast('캡처 완료! 이미지를 꾹 눌러 저장하세요','success');
      }).catch(()=>showToast('캡처 실패','error')).finally(()=>{
        saved.forEach(({el,ov,ovY,h,maxH})=>{el.style.overflow=ov;el.style.overflowY=ovY;el.style.height=h;el.style.maxHeight=maxH;});
      });
    },200);
  },[showToast]);

  /* html2canvas 로드 (여러 방법 시도) */
  useEffect(()=>{
    const loadScript = ()=>{
      if(window.html2canvas) return;
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.async=true;
      s.onload=()=>console.log('html2canvas loaded');
      document.head.appendChild(s);
    };
    loadScript();
    // 3초 후 재시도
    const retry=setTimeout(()=>{if(!window.html2canvas)loadScript();},3000);
    return ()=>clearTimeout(retry);
  },[]);

  return (
    <div className="min-h-screen text-slate-800 pb-2 overflow-hidden flex flex-col" style={{fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',background:'#f0f9ff'}}>
      <GlobalCSS/>

      {/* 헤더 */}
      <header className="p-2 px-4 shadow-lg flex justify-between items-center sticky top-0 z-40 shrink-0" style={{height:52,background:'linear-gradient(135deg, #1e3a5f, #2c5282)'}}>
        <div className="flex items-center gap-3">
          <div onClick={handleLogoClick}
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black cursor-pointer select-none shadow-lg"
            style={{fontSize:16,background:'white',color:'#1e3a5f'}} title="관리자 로그인 (5번 클릭)">GY</div>
          <div>
            <h1 className="font-bold leading-tight text-white" style={{fontSize:16}}>고령군청소년문화의집</h1>
            <p className="font-semibold text-sky-200" style={{fontSize:10}}>{APP_VERSION} | 이용현황 시스템</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {isAdmin && (
            <>
              <button onClick={captureScreen} className="bg-sky-400 hover:bg-sky-300 text-white p-1.5 px-3 rounded-lg transition-colors flex items-center gap-1.5 border border-sky-300 shadow-sm">
                <Camera size={14}/><span className="font-bold" style={{fontSize:11}}>캡처</span>
              </button>
              <button onClick={()=>{setIsAdmin(false);showToast('관리자 모드 종료');}}
                className="text-white border-sky-300 px-3 py-1 rounded-lg font-bold border flex items-center gap-1.5 shadow-sm" style={{fontSize:11,background:'#38bdf8'}}>
                <LogOut size={12}/> 관리종료
              </button>
            </>
          )}
        </div>
      </header>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-16 left-1/2 z-50 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 anim-top
          ${toast.type==='error'?'bg-sky-400':'bg-sky-500'} text-white font-bold`} style={{fontSize:12,transform:'translateX(-50%)'}}>
          {toast.type==='error'?'⚠':'✅'} {toast.text}
        </div>
      )}

      {/* 메인 */}
      <main className="flex-grow max-w-screen-2xl mx-auto p-1.5 w-full overflow-hidden flex flex-col" ref={captureRef}>
        {isAdmin ? (
          <AdminDashboard rooms={rooms} updateRoom={updateRoom} logs={logs} setLogs={setLogs}
            password={adminPw} setPassword={setAdminPw} showToast={showToast} setConfirmModal={setConfirmModal}/>
        ) : (
          <div className="grid grid-cols-5 gap-1.5 pr-1 scrollbar-thin h-full" style={{gridTemplateRows:'repeat(3, 1fr)'}}>
            {DISPLAY_ORDER.map(id=>{const room=rooms.find(r=>r.id===id);if(!room)return null;return(
              <RoomCard key={room.id} room={room} isAdmin={isAdmin} onClick={()=>room.status==='open'&&setSelectedRoom(room)} onEarlyCheckout={handleEarlyCheckout}/>
            );})}
          </div>
        )}
      </main>

      {/* 신청 모달 */}
      {selectedRoom && <RegistrationModal room={selectedRoom} onClose={()=>setSelectedRoom(null)} onSubmit={data=>handleRegister(selectedRoom,data)} showToast={showToast}/>}

      {/* 확인 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 text-slate-700" style={{background:'rgba(0,0,0,.5)',backdropFilter:'blur(2px)'}}>
          <div className="bg-white rounded-xl shadow-2xl p-5 max-w-xs w-full anim-zoom border border-slate-200">
            <h2 className="font-black mb-2 flex items-center gap-2 text-slate-800" style={{fontSize:14}}>⚠ {confirmModal.title}</h2>
            <p className="text-slate-500 mb-5 leading-relaxed font-bold" style={{fontSize:13}}>{confirmModal.message}</p>
            <div className="flex gap-2">
              <button onClick={()=>setConfirmModal(null)} className="flex-1 py-2 bg-slate-100 rounded-lg font-black hover:bg-slate-200 transition-colors" style={{fontSize:12}}>취소</button>
              <button onClick={confirmModal.onConfirm} className="flex-1 py-2 text-white rounded-lg font-black shadow-lg active:scale-95 transition-all bg-sky-500 hover:bg-sky-600" style={{fontSize:12}}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 로그인 */}
      {showLogin && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 text-slate-700" style={{background:'rgba(0,0,0,.4)',backdropFilter:'blur(2px)'}}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full border border-sky-100 anim-zoom" style={{maxWidth:280}}>
            <h2 className="font-bold mb-4 flex items-center gap-2 text-slate-800" style={{fontSize:15}}>🔐 관리자 인증</h2>
            <input type="password" autoFocus className="w-full p-3 border-2 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-sky-200 border-slate-200"
              style={{fontSize:14}} placeholder="비밀번호 입력" value={pwInput} onChange={e=>setPwInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'){if(pwInput===adminPw){setIsAdmin(true);setShowLogin(false);setPwInput('');}else showToast('비밀번호 불일치','error');}}}/>
            <div className="flex gap-2">
              <button onClick={()=>{setShowLogin(false);setPwInput('');}} className="flex-1 py-2 bg-slate-100 rounded-lg font-bold" style={{fontSize:12}}>취소</button>
              <button onClick={()=>{if(pwInput===adminPw){setIsAdmin(true);setShowLogin(false);setPwInput('');}else showToast('비밀번호 불일치','error');}}
                className="flex-1 py-2 text-white rounded-lg font-bold transition-colors shadow-sm bg-sky-500 hover:bg-sky-600" style={{fontSize:12}}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 캡처 이미지 팝업 */}
      {captureImage && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{background:'rgba(0,0,0,.7)'}} onClick={()=>setCaptureImage(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-auto p-2 anim-zoom" style={{maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2 px-2">
              <span className="font-black text-slate-700" style={{fontSize:11}}>📸 캡처 완료 (이미지를 꾹 눌러 저장)</span>
              <button onClick={()=>setCaptureImage(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <img src={captureImage} alt="캡처 이미지" className="w-full rounded-lg border border-slate-200"/>
          </div>
        </div>
      )}
    </div>
  );
}
