(()=>{
  const K='cuenora-beta-v1',q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
  let state={tasks:[],reminders:[],memories:[],settings:{theme:'calm',textSize:'16',motion:false}};
  let startTaskId=null;
  try{state={...state,...JSON.parse(localStorage.getItem(K)||'{}')}}catch{}
  function normalize(){state.tasks=state.tasks||[];state.reminders=state.reminders||[];state.memories=state.memories||[];state.settings={theme:'calm',textSize:'16',motion:false,...(state.settings||{})}}
  normalize();
  const save=()=>{localStorage.setItem(K,JSON.stringify(state));window.dispatchEvent(new CustomEvent('cuenora-state-saved',{detail:{key:K}}))};
  const id=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();
  const fmt=d=>new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'numeric',minute:'2-digit',day:'numeric',month:'short'}).format(d);
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const friendly={
    now:[
      'You do not need to solve the whole day. One useful next move is enough.',
      'Starting counts, even when the step looks tiny.',
      'A changed plan is information, not failure.',
      'You can begin from where you are, not where you hoped to be.',
      'Small progress still changes what happens next.'
    ],
    dump:[
      'Messy thoughts are welcome here. Put them down before deciding what they mean.',
      'You do not have to remember it and organise it at the same time.',
      'A thought can be stored without becoming another obligation.',
      'Get it out of your head first. Decisions can come later.',
      'Nothing here has to be tidy to be worth capturing.'
    ],
    task:[
      'A task can be ten minutes, two minutes, or one tap.',
      'If a task feels heavy, the first step may still be too large.',
      'Useful beats perfect. Small beats stuck.',
      'You are allowed to lower the size of the next step without lowering the goal.',
      'A realistic task is more useful than an impressive one.'
    ],
    start:[
      'You only need to do this step — not promise the rest.',
      'Momentum can begin with something almost too small to count.',
      'Stopping after the first step is allowed. Starting still counts.',
      'Make the doorway easier, not yourself harder.',
      'The goal right now is movement, not completion.'
    ]
  };
  function friendlyLine(type,shift=0){const list=friendly[type]||friendly.now;const day=Math.floor(Date.now()/86400000);const seed=[...type].reduce((n,c)=>n+c.charCodeAt(0),0);return list[(day+seed+shift)%list.length]}
  function theme(){const t=state.settings.theme;let a='#58736c',bg='#f5f7f6',text='#1f2926',p2='#edf3f1',panel='#fff',line='#d9e2df';if(t==='focus'){a='#385f8c';bg='#f4f7fb';p2='#e9f0f8'}if(t==='energy'){a='#9b5b29';bg='#fff8f1';p2='#fff0e4'}if(t==='mono'){a='#3f3f46';bg='#f5f5f5';p2='#ededed'}if(t==='night'){a='#8b99d4';bg='#191c25';text='#edf0f7';p2='#262b38';panel='#202532';line='#343a49'}let r=document.documentElement.style;r.setProperty('--accent',a);r.setProperty('--bg',bg);r.setProperty('--text',text);r.setProperty('--panel2',p2);r.setProperty('--panel',panel);r.setProperty('--line',line);document.documentElement.style.fontSize=state.settings.textSize+'px';document.documentElement.style.scrollBehavior=state.settings.motion?'auto':'smooth'}
  function show(v){qa('.view').forEach(x=>x.classList.toggle('active',x.id===v));qa('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.v===v));scrollTo(0,0);if(v==='dump')q('#dumpText')?.focus({preventScroll:true})}
  q('#nav').onclick=e=>{let b=e.target.closest('[data-v]');if(b)show(b.dataset.v)};
  document.addEventListener('click',e=>{const b=e.target.closest('[data-jump]');if(b)show(b.dataset.jump)});
  function activeTasks(){return state.tasks.filter(t=>t.status!=='done')}
  function priorityRank(p){return p==='high'?0:p==='low'?2:1}
  function pick(list=activeTasks()){let a=list.filter(t=>t.status!=='later');if(!a.length)a=list;if(window.CuenoraPlanning)return window.CuenoraPlanning.prioritise(a)[0];return [...a].sort((x,y)=>priorityRank(x.priority)-priorityRank(y.priority)||(x.minutes||10)-(y.minutes||10))[0]}
  function firstStep(t,smaller=false){if(!t)return'';let s=t.title.toLowerCase();if(smaller){if(s.includes('laundry'))return'Put both feet on the floor. That is enough for this step.';if(s.includes('eat')||s.includes('food')||s.includes('lunch'))return'Look toward the kitchen or the easiest food you can reach.';if(s.includes('email')||s.includes('reply')||s.includes('message'))return'Unlock the device you would use. Do not open the message yet.';if(s.includes('clean'))return'Look at one item. You do not need to pick it up yet.';if(s.includes('call')||s.includes('phone'))return'Put the phone where you can reach it. No dialling yet.';if(s.includes('appointment'))return'Open the calendar or message that has the appointment details.';return'Touch or open the first thing you would need. Nothing more yet.'}if(s.includes('laundry'))return'Stand up and walk to the laundry. Nothing else yet.';if(s.includes('eat')||s.includes('lunch')||s.includes('food'))return'Go to the kitchen. Choose the easiest thing you can eat.';if(s.includes('email')||s.includes('reply')||s.includes('message'))return'Open the message. Do not write anything yet.';if(s.includes('clean'))return'Pick up one item. Put only that item where it belongs.';if(s.includes('call')||s.includes('phone'))return'Open the contact or number. You do not need to call yet.';if(s.includes('appointment'))return'Open the appointment details and check only the time.';return'Open what you need and do only the first visible action.'}
  function showStartFor(t){if(!t)return;startTaskId=t.id;const box=q('#startHelp');box.innerHTML=`<div class="gentle-label">LET'S MAKE THE DOORWAY SMALLER</div><div class="support-quote">${esc(friendlyLine('start'))}</div><div class="start-step"><strong>Only this:</strong> ${esc(firstStep(t))}</div><button class="btn tiny" id="smallerStart" type="button">Make it smaller</button>`;box.classList.remove('hidden')}
  function render(){
    normalize();theme();
    if(q('#nowNudge'))q('#nowNudge').textContent=friendlyLine('now');if(q('#dumpNudge'))q('#dumpNudge').textContent=friendlyLine('dump');if(q('#taskNudge'))q('#taskNudge').textContent=friendlyLine('task');
    const t=pick();q('#oneTask').textContent=t?t.title:'Nothing urgent right now.';q('#oneMeta').textContent=t?`About ${t.minutes||10} min · ${t.priority==='high'?'important':t.priority==='low'?'low pressure':'normal priority'}`:'Add a task or use Brain Dump.';
    q('#tasks').innerHTML=state.tasks.length?state.tasks.map(t=>`<div class="item ${t.status==='done'?'done':''}"><div class="item-main"><strong>${esc(t.title)}</strong><div class="muted tiny">${t.minutes||10} min · ${esc(t.priority==='low'?'low pressure':t.priority||'normal')}${t.status==='later'?' · later':''}</div></div><div class="row task-actions">${t.status!=='done'?`<button class="btn tiny" data-task="${t.id}" data-act="start">Help me start</button>`:''}<button class="btn tiny" data-task="${t.id}" data-act="done">${t.status==='done'?'Undo':'Done'}</button>${t.status!=='done'?`<button class="btn tiny" data-task="${t.id}" data-act="later">${t.status==='later'?'Bring back':'Later'}</button>`:''}</div></div>`).join(''):'<div class="empty-friendly"><strong>Nothing on the task list.</strong><span>If something is circling in your head, Brain Dump can hold it first.</span></div>';
    const rs=[...state.reminders].filter(r=>r.status!=='done').sort((a,b)=>new Date(a.when)-new Date(b.when)),n=rs[0];q('#nextCue').textContent=n?n.title:'No reminders waiting.';q('#nextCueMeta').textContent=n?fmt(new Date(n.when)):'';
    q('#reminders').innerHTML=state.reminders.length?[...state.reminders].sort((a,b)=>new Date(a.when)-new Date(b.when)).map(r=>`<div class="item ${r.status==='done'?'done':''}"><div><strong>${esc(r.title)}</strong><div class="muted tiny">${fmt(new Date(r.when))}${r.repeat!=='none'?' · '+esc(r.repeat):''}</div></div><div class="row"><button class="btn tiny" data-rem="${r.id}" data-ract="done">Done</button><button class="btn tiny" data-rem="${r.id}" data-ract="snooze">+5m</button></div></div>`).join(''):'<div class="muted">No reminders yet.</div>';
    const openMem=state.memories.filter(m=>m.status!=='done');q('#memoryCount').textContent=openMem.length?`${openMem.length} thing${openMem.length===1?'':'s'} safely held`:'Nothing to hold.';q('#memoryPreview').textContent=openMem[0]?.text||'Put loose thoughts here without turning them into tasks.';
    q('#memories').innerHTML=state.memories.length?[...state.memories].reverse().map(m=>`<div class="item ${m.status==='done'?'done':''}"><div><strong>${esc(m.text)}</strong><div class="muted tiny">${m.when?'Comes back '+fmt(new Date(m.when)):'Held in Memory Inbox'}${m.status==='done'?' · cleared':''}</div></div><div class="row">${m.status!=='done'?`<button class="btn tiny" data-memory="${m.id}" data-mact="task">Make task</button><button class="btn tiny" data-memory="${m.id}" data-mact="done">Clear</button>`:`<button class="btn tiny" data-memory="${m.id}" data-mact="undo">Bring back</button>`}</div></div>`).join(''):'<div class="muted">Memory Inbox is empty.</div>';
    q('#theme').value=state.settings.theme;q('#textSize').value=state.settings.textSize;q('#motion').checked=state.settings.motion;save();
  }
  function commitForm(form,kind,title,mutate,reset){
    const before=JSON.parse(JSON.stringify(state));
    try{mutate();render()}catch(error){state=before;try{render()}catch{};alert('This could not be saved on this device. Your thought is still here. Please try again.');return false}
    reset();form.dispatchEvent(new CustomEvent('cuenora-item-saved',{detail:{kind,title}}));return true;
  }
  q('#taskForm').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form),title=String(f.get('title')||'').trim();if(!title)return;commitForm(form,'task',title,()=>state.tasks.unshift({id:id(),title,minutes:+f.get('minutes')||10,priority:f.get('priority'),status:'active'}),()=>{form.reset();form.minutes.value=10})};
  q('#tasks').onclick=e=>{let b=e.target.closest('[data-task]');if(!b)return;let t=state.tasks.find(x=>x.id===b.dataset.task);if(!t)return;if(b.dataset.act==='start'){show('now');showStartFor(t);return}if(b.dataset.act==='done')t.status=t.status==='done'?'active':'done';else t.status=t.status==='later'?'active':'later';render()};
  function dumpLines(){return q('#dumpText').value.split(/\n+/).map(x=>x.trim()).filter(Boolean)}
  function commitDump(target,mutate){
    const before=JSON.parse(JSON.stringify(state));
    const dump=q('#dumpText'),beforeText=dump.value;
    const lines=dumpLines();
    if(!lines.length)return false;
    try{
      mutate(lines);
      render();
      dump.value='';
      dump.dispatchEvent(new Event('input',{bubbles:true}));
      show(target);
      return true;
    }catch(error){
      state=before;dump.value=beforeText;
      try{render()}catch{}
      alert('This could not be saved on this device. Your thoughts are still here. Please try again.');
      return false;
    }
  }
  q('#dumpBtn').onclick=()=>commitDump('now',lines=>lines.forEach(title=>{const insight=window.CuenoraPlanning?.analyse(title);state.tasks.push({id:id(),title,minutes:insight?.effortMinutes||10,priority:insight?.priority||'normal',status:'active'})}));
  q('#dumpMemoryBtn').onclick=()=>commitDump('memory',lines=>lines.forEach(text=>state.memories.push({id:id(),text,createdAt:new Date().toISOString(),status:'open',when:null,reminderId:null})));
  q('#clearDump').onclick=()=>q('#dumpText').value='';
  q('#doneOne').onclick=()=>{let t=pick();if(t){t.status='done';startTaskId=null;q('#startHelp').classList.add('hidden');render()}};q('#snoozeOne').onclick=()=>{let t=pick();if(t){t.status='later';render()}};
  q('#startOne').onclick=()=>showStartFor(pick());
  document.addEventListener('click',e=>{if(e.target.id!=='smallerStart')return;let t=state.tasks.find(x=>x.id===startTaskId)||pick();if(!t)return;q('#startHelp').innerHTML=`<div class="gentle-label">EVEN SMALLER</div><div class="support-quote">${esc(friendlyLine('start',1))}</div><div class="start-step"><strong>Only this:</strong> ${esc(firstStep(t,true))}</div>`});
  function setReminderDefault(){let d=new Date(Date.now()+10*60000);d.setSeconds(0,0);let z=n=>String(n).padStart(2,'0');q('#reminderForm').when.value=`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
  setReminderDefault();
  function createReminder(input={}){const title=String(input.title||'').trim(),date=new Date(input.when),repeat=['none','daily','weekdays','weekly'].includes(input.repeat)?input.repeat:'none';if(!title)return{ok:false,reason:'title'};if(!Number.isFinite(date.getTime())||date.getTime()<=Date.now())return{ok:false,reason:'when'};const when=date.toISOString(),reminder={id:id(),title,when,anchor:when,repeat,status:'active',lastFired:null,...(input.persistence?{persistence:'repeat',repeatInterval:10,maxRepeats:6,repeatCount:0}:{})},before=JSON.parse(JSON.stringify(state));try{state.reminders.push(reminder);render();return{ok:true,reminder}}catch{state=before;try{render()}catch{};return{ok:false,reason:'storage'}}}
  q('#reminderForm').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form),title=String(f.get('title')||'').trim(),result=createReminder({title,when:f.get('when'),repeat:f.get('repeat'),persistence:form.querySelector('#persistentNudge')?.checked});if(!result.ok){if(result.reason==='storage')alert('This could not be saved on this device. Your thought is still here. Please try again.');return}if(form.querySelector('#persistentNudge'))form.querySelector('#persistentNudge').checked=false;form.reset();setReminderDefault();form.dispatchEvent(new CustomEvent('cuenora-item-saved',{detail:{kind:'reminder',title}}))};
  q('#reminders').onclick=e=>{let b=e.target.closest('[data-rem]');if(!b)return;let r=state.reminders.find(x=>x.id===b.dataset.rem);if(!r)return;if(b.dataset.ract==='snooze'){r.when=new Date(Date.now()+5*60000).toISOString();r.status='active';r.lastFired=null}else{if(r.repeat==='none')r.status='done';else{let d=new Date(r.when);if(r.repeat==='daily')d.setDate(d.getDate()+1);else if(r.repeat==='weekly')d.setDate(d.getDate()+7);else{do{d.setDate(d.getDate()+1)}while([0,6].includes(d.getDay()))}r.when=d.toISOString();r.anchor=r.when;r.lastFired=null}}render()};
  q('#memoryForm').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form),text=String(f.get('text')||'').trim(),rawWhen=String(f.get('when')||''),memoryId=id();if(!text)return;const date=rawWhen?new Date(rawWhen):null;if(date&&(!Number.isFinite(date.getTime())||date.getTime()<=Date.now()))return;const when=date?date.toISOString():null,reminderId=when?`memory-${memoryId}`:null;commitForm(form,'memory',text,()=>{if(when)state.reminders.push({id:reminderId,title:`Remember: ${text.slice(0,180)}`,when,anchor:when,repeat:'none',status:'active',lastFired:null});state.memories.push({id:memoryId,text,createdAt:new Date().toISOString(),status:'open',when,reminderId})},()=>form.reset())};
  q('#memories').onclick=e=>{const b=e.target.closest('[data-memory]');if(!b)return;const m=state.memories.find(x=>x.id===b.dataset.memory);if(!m)return;if(b.dataset.mact==='task'){state.tasks.unshift({id:id(),title:m.text,minutes:10,priority:'normal',status:'active'});m.status='done'}else if(b.dataset.mact==='done'){m.status='done';if(m.reminderId){const r=state.reminders.find(x=>x.id===m.reminderId);if(r)r.status='done'}}else m.status='open';render()};
  async function fire(r){r.lastFired=new Date().toISOString();save();if('Notification'in window&&Notification.permission==='granted'){try{new Notification('Cuenora',{body:r.title,tag:r.id})}catch{alert('Reminder: '+r.title)}}else alert('Reminder: '+r.title)}
  setInterval(()=>{let now=Date.now();state.reminders.filter(r=>r.status!=='done'&&!r.lastFired&&new Date(r.when).getTime()<=now).forEach(fire)},5000);
  qa('.cap').forEach(b=>b.onclick=()=>{let m=+b.dataset.m,box=q('#resetStart');if(!m){q('#resetResult').textContent='You are done planning today. Anything non-essential can wait.';box.classList.add('hidden');return}const plan=window.CuenoraPlanning?.planForCapacity(activeTasks(),m),t=plan?.task;q('#resetResult').textContent=t?(plan.mode==='first-step'?`Use up to ${plan.minutes} minutes to start: ${t.title}. You do not need to finish it now.`:`Protect one thing: ${t.title}. The rest can wait.`):'Nothing needs rescuing. Use the time for food, water, rest or preparation.';if(t){box.innerHTML=`<div class="support-quote">${esc(friendlyLine('start'))}</div><strong>First step:</strong> ${esc(firstStep(t))}`;box.classList.remove('hidden')}else box.classList.add('hidden')});
  q('#theme').onchange=e=>{state.settings.theme=e.target.value;render()};q('#textSize').onchange=e=>{state.settings.textSize=e.target.value;render()};q('#motion').onchange=e=>{state.settings.motion=e.target.checked;render()};
  q('#exportBtn').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='cuenora-backup.json';a.click();URL.revokeObjectURL(a.href)};
  function restoreShape(raw){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Backup root must be an object');
    const keys=['tasks','reminders','memories'];
    keys.forEach(key=>{if(raw[key]!==undefined&&!Array.isArray(raw[key]))throw new Error(`${key} must be an array`)});
    if(raw.settings!==undefined&&(!raw.settings||typeof raw.settings!=='object'||Array.isArray(raw.settings)))throw new Error('settings must be an object');
    const oneOf=(value,values)=>value===undefined||values.includes(value);
    const text=(value)=>typeof value==='string'&&value.trim().length>0;
    const date=(value)=>typeof value==='string'&&Number.isFinite(new Date(value).getTime());
    const validateRow=(key,row)=>{
      if(row===null||typeof row!=='object'||Array.isArray(row))throw new Error(`Invalid ${key} row`);
      if(key==='tasks'){
        if(!text(row.title)|| (row.minutes!==undefined&&(!Number.isFinite(row.minutes)||row.minutes<1)) || !oneOf(row.priority,['high','normal','low']) || !oneOf(row.status,['active','done','later']))throw new Error('Invalid task row');
      }
      if(key==='reminders'){
        if(!text(row.title)||!date(row.when)||!oneOf(row.repeat,['none','daily','weekdays','weekly'])||!oneOf(row.status,['active','done']))throw new Error('Invalid reminder row');
      }
      if(key==='memories'){
        if(!text(row.text)||!oneOf(row.status,['open','done'])||(row.createdAt!==undefined&&!date(row.createdAt))||(row.when!==undefined&&row.when!==null&&!date(row.when))|| (row.reminderId!==undefined&&row.reminderId!==null&&!text(row.reminderId)))throw new Error('Invalid memory row');
      }
    };
    const rows={};
    for(const key of keys){
      rows[key]=Array.isArray(raw[key])?raw[key]:[];
      for(const row of rows[key])validateRow(key,row);
    }
    const settings=raw.settings||{};
    if(!oneOf(settings.theme,['calm','focus','energy','mono','night'])||!oneOf(settings.textSize,['16','18','20'])||(settings.motion!==undefined&&typeof settings.motion!=='boolean'))throw new Error('Invalid settings');
    return{...rows,settings:{theme:'calm',textSize:'16',motion:false,...settings}};
  }
  function readFileText(file){
    if(typeof file.text==='function')return file.text();
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error('Could not read backup'));reader.readAsText(file)});
  }
  async function importBackup(input,file){
    const before=JSON.parse(JSON.stringify(state));
    try{
      const candidate=restoreShape(JSON.parse(await readFileText(file)));
      state=candidate;normalize();
      try{render()}catch(error){state=before;render();throw error}
      input.value='';alert('Backup restored.');
    }catch{
      state=before;try{render()}catch{};input.value='';alert('That backup could not be read. Your current data has not been changed.');
    }
  }
  q('#importFile').onchange=e=>{const input=e.currentTarget,f=input.files[0];if(f)void importBackup(input,f)};
  q('#clearDone').onclick=()=>{state.tasks=state.tasks.filter(t=>t.status!=='done');state.reminders=state.reminders.filter(r=>r.status!=='done');state.memories=state.memories.filter(m=>m.status!=='done');render()};
  window.CuenoraBeta={getState:()=>state,setState:s=>{state=s;normalize();render()},validateBackup:raw=>{try{restoreShape(raw);return true}catch{return false}},createReminder,save,render};
  render();
})();
