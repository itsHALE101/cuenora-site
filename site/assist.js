(()=>{
  const FOCUS_KEY='cuenora-focus-v1';
  const $=s=>document.querySelector(s);
  const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')||f}catch{return f}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const api=()=>window.CuenoraBeta;

  function addStyles(){
    const style=document.createElement('style');
    style.textContent=`
      .cuenora-assist{margin:12px 0;padding:14px;border:1px solid var(--line);border-radius:17px;background:var(--panel2)}
      .cuenora-assist strong{display:block;margin-bottom:4px}.cuenora-assist .row{margin-top:10px}
      .cuenora-assist-status{font-size:.92rem;color:var(--muted)}
      .cuenora-persistent{margin:16px 0 14px;padding:14px;border:2px solid var(--accent);border-radius:16px;background:var(--panel2)}
      .cuenora-persistent .persistent-title{font-weight:900;letter-spacing:.04em;font-size:.78rem;margin-bottom:8px}
      .cuenora-persistent label{display:flex;gap:12px;align-items:flex-start;font-weight:850;cursor:pointer}
      .cuenora-persistent input{width:24px;height:24px;min-width:24px;margin-top:1px;accent-color:var(--accent)}
      .cuenora-persistent .persistent-copy{display:block;line-height:1.35}
      .cuenora-persistent .persistent-help{display:block;margin-top:5px;font-size:.8rem;color:var(--muted);font-weight:500}
    `;
    document.head.appendChild(style);
  }

  function currentTask(){
    const s=api()?.getState?.();
    if(!s?.tasks)return null;
    const active=s.tasks.filter(t=>t.status!=='done');
    const usable=active.filter(t=>t.status!=='later');
    const list=usable.length?usable:active;
    const rank=p=>p==='high'?0:p==='low'?2:1;
    return [...list].sort((a,b)=>rank(a.priority)-rank(b.priority)||(a.minutes||10)-(b.minutes||10))[0]||null;
  }

  function installFocus(){
    const one=$('#oneTask')?.closest('.card');
    if(!one||$('#cuenoraFocus'))return;
    const box=document.createElement('div');
    box.id='cuenoraFocus';box.className='cuenora-assist';
    box.innerHTML=`<strong>Time Anchor</strong><div class="cuenora-assist-status" id="focusStatus">No countdown. Cuenora can simply check your sense of time.</div><div class="row"><button class="btn" id="focusStart" type="button">Stay with me for 10 min</button><button class="btn hidden" id="focusContinue" type="button">Another 10 min</button><button class="btn hidden" id="focusStop" type="button">End check-in</button></div>`;
    one.appendChild(box);
    $('#focusStart').onclick=()=>{
      const t=currentTask();
      if(!t){$('#focusStatus').textContent='Add or choose a task first. The time anchor follows one thing at a time.';return}
      const now=Date.now();write(FOCUS_KEY,{taskId:t.id,title:t.title,startedAt:now,nextAt:now+10*60000});renderFocus();
    };
    $('#focusContinue').onclick=()=>{const f=read(FOCUS_KEY,null);if(!f)return;f.nextAt=Date.now()+10*60000;write(FOCUS_KEY,f);renderFocus()};
    $('#focusStop').onclick=()=>{localStorage.removeItem(FOCUS_KEY);renderFocus()};
    renderFocus();
    setInterval(renderFocus,30000);
  }

  function renderFocus(){
    const status=$('#focusStatus');if(!status)return;
    const f=read(FOCUS_KEY,null),start=$('#focusStart'),cont=$('#focusContinue'),stop=$('#focusStop');
    if(!f){status.textContent='No countdown. Cuenora can simply check your sense of time.';start?.classList.remove('hidden');cont?.classList.add('hidden');stop?.classList.add('hidden');return}
    const mins=Math.max(0,Math.floor((Date.now()-f.startedAt)/60000));
    start?.classList.add('hidden');stop?.classList.remove('hidden');
    if(Date.now()>=f.nextAt){status.textContent=`About ${Math.max(10,mins)} minutes have passed with “${f.title}”. Still where you want to be?`;cont?.classList.remove('hidden')}
    else {status.textContent=`Cuenora is staying with “${f.title}”. No countdown — the next gentle check-in is in about ${Math.max(1,Math.ceil((f.nextAt-Date.now())/60000))} min.`;cont?.classList.add('hidden')}
  }

  function installPersistentReminder(){
    const form=$('#reminderForm');if(!form)return;
    let wrap=$('#persistentNudgeBox');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.id='persistentNudgeBox';
      wrap.className='cuenora-persistent';
      wrap.innerHTML=`<div class="persistent-title">IMPORTANT REMINDER</div><label><input id="persistentNudge" type="checkbox"><span class="persistent-copy">Keep nudging me until I tap Done<span class="persistent-help">If you dismiss it, Cuenora will remind you again every 10 minutes, up to 6 times. Use this for things you really do not want to forget.</span></span></label>`;
      const saveButton=form.querySelector('button.primary')||form.querySelector('button');
      if(saveButton)form.insertBefore(wrap,saveButton);else form.appendChild(wrap);
    }

  }

  function supportLocalPersistent(){
    setInterval(()=>{
      const cloud=read('cuenora-cloud-v1',{});if(cloud.connected)return;
      const c=api();const s=c?.getState?.();if(!s?.reminders)return;
      let changed=false;
      for(const r of s.reminders){
        if(r.persistence!=='repeat'||r.status==='done'||!r.lastFired)continue;
        if(r._repeatHandled===r.lastFired)continue;
        const count=Number(r.repeatCount||0)+1;r.repeatCount=count;r._repeatHandled=r.lastFired;
        if(count<Number(r.maxRepeats||6)){r.when=new Date(Date.now()+Number(r.repeatInterval||10)*60000).toISOString();r.lastFired=null;r.status='active'}
        changed=true;
      }
      if(changed)c.setState(s);
    },5000);
  }

  addStyles();installFocus();installPersistentReminder();supportLocalPersistent();
})();
