(()=>{
  const q=s=>document.querySelector(s);
  const dump=q('#dumpText');
  const reminderForm=q('#reminderForm');
  const taskForm=q('#taskForm');
  if(!dump||!reminderForm||!taskForm)return;

  const suggestion=document.createElement('div');
  suggestion.id='dumpSuggestion';
  suggestion.className='notice hidden';
  suggestion.style.marginTop='10px';
  suggestion.setAttribute('aria-live','polite');
  dump.insertAdjacentElement('afterend',suggestion);

  const routeStatus=document.createElement('div');
  routeStatus.id='dumpRouteStatus';
  routeStatus.className='notice good hidden';
  routeStatus.style.marginTop='10px';
  routeStatus.setAttribute('aria-live','polite');
  suggestion.insertAdjacentElement('afterend',routeStatus);

  const timePattern=/\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])(?:\:[0-5]\d)?\s?(?:am|pm)\b/i;
  const dayPattern=/\b(?:today|tomorrow|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;
  const shoppingPattern=/^\s*(?:buy|pick up|get)\s+\S+/i;
  const priorityPattern=/\b(?:urgent|asap|important|must\s+do)\b/i;
  const weekdays={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
  const CONTINUITY_KEY='cuenora-brain-dump-continuity-v1';
  let current=null;

  function dumpLines(){return dump.value.split(/\n+/).map(x=>x.trim()).filter(Boolean)}
  function firstUsefulLine(){return dumpLines()[0]||''}
  function tidy(value){return String(value||'').replace(/\s{2,}/g,' ').replace(/\s+([,.!?])/g,'$1').replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g,'').trim()}
  function cleanTitle(line,...matches){let value=line;matches.filter(Boolean).forEach(match=>{value=value.replace(match[0],' ')});return tidy(value)||line}
  function parseCueTime(cue){const raw=String(cue||'').trim().toLowerCase();const ampm=raw.match(/^(\d{1,2})(?::(\d{2}))?\s?(am|pm)$/i);if(ampm){let hour=Number(ampm[1])%12;if(ampm[3].toLowerCase()==='pm')hour+=12;return{hour,minute:Number(ampm[2]||0)}}const twentyFour=raw.match(/^(\d{1,2}):(\d{2})$/);if(twentyFour)return{hour:Number(twentyFour[1]),minute:Number(twentyFour[2])};return null}
  function localValue(d){const z=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
  function nextLocalOccurrence(cue){const parsed=parseCueTime(cue);if(!parsed)return'';const d=new Date();d.setHours(parsed.hour,parsed.minute,0,0);if(d.getTime()<=Date.now())d.setDate(d.getDate()+1);return localValue(d)}
  function isPastToday(dayCue,timeCue){const day=String(dayCue||'').trim().toLowerCase();if(day&&day!=='today')return false;const parsed=parseCueTime(timeCue);if(!parsed)return false;const d=new Date();d.setHours(parsed.hour,parsed.minute,0,0);return d.getTime()<=Date.now()}
  function explicitDayOccurrence(dayCue,timeCue){const parsed=parseCueTime(timeCue);if(!parsed)return'';const raw=String(dayCue||'').trim().toLowerCase();const now=new Date();const d=new Date(now);if(raw==='today'){d.setHours(parsed.hour,parsed.minute,0,0);return d.getTime()<=now.getTime()?'':localValue(d)}if(raw==='tomorrow'){d.setDate(d.getDate()+1);d.setHours(parsed.hour,parsed.minute,0,0);return localValue(d)}const next=raw.startsWith('next '),name=raw.replace(/^next\s+/,'');const target=weekdays[name];if(target===undefined)return'';let delta=(target-now.getDay()+7)%7;const todayAtCue=new Date(now);todayAtCue.setHours(parsed.hour,parsed.minute,0,0);if(delta===0&&(next||todayAtCue.getTime()<=now.getTime()))delta=7;d.setDate(d.getDate()+delta);d.setHours(parsed.hour,parsed.minute,0,0);return localValue(d)}
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function setRouteSource(form,kind,line){form.dataset.cuenoraDumpSource=line;form.dataset.cuenoraDumpKind=kind}
  function clearRouteSource(form){delete form.dataset.cuenoraDumpSource;delete form.dataset.cuenoraDumpKind}
  function removeOneThought(source){const parts=dump.value.split(/\n/);const target=String(source||'').trim();const index=parts.findIndex(part=>part.trim()===target);if(index<0)return false;parts.splice(index,1);dump.value=parts.join('\n').replace(/^\n+|\n+$/g,'');dump.dispatchEvent(new Event('input',{bubbles:true}));return true}
  function rememberRoute(kind,source,title){try{const prior=JSON.parse(localStorage.getItem(CONTINUITY_KEY)||'[]');const rows=Array.isArray(prior)?prior:[];rows.unshift({source:String(source||''),title:String(title||source||''),kind,routedAt:new Date().toISOString()});localStorage.setItem(CONTINUITY_KEY,JSON.stringify(rows.slice(0,200)))}catch{}}
  function completeRoute(kind,source,title){if(!source)return;const removed=removeOneThought(source);if(!removed)return;rememberRoute(kind,source,title);q('#nav [data-v="dump"]')?.click();const left=dumpLines().length;routeStatus.textContent=left?`${kind==='reminder'?'Reminder':'Task'} saved. ${left} thought${left===1?' is':'s are'} still here — I’ll keep ${left===1?'it':'them'} until you decide what happens next.`:`${kind==='reminder'?'Reminder':'Task'} saved. Brain Dump is clear and ready for the next thought.`;routeStatus.classList.remove('hidden');analyse();dump.focus({preventScroll:true})}

  function analyse(){
    const line=firstUsefulLine();current=null;suggestion.classList.add('hidden');suggestion.innerHTML='';if(!line)return;
    const timeMatch=line.match(timePattern);const dayMatch=line.match(dayPattern);
    if(timeMatch){const pastToday=isPastToday(dayMatch?.[0]||'',timeMatch[0]);current={kind:'time',line,title:cleanTitle(line,timeMatch,dayMatch),cue:timeMatch[0],dayCue:dayMatch?.[0]||'',pastToday};if(pastToday){suggestion.innerHTML=`<strong>That time has already passed today.</strong> I won’t silently move it to another day. Choose a new time before saving. <button class="btn tiny" id="reviewDumpReminder" type="button">Choose new time</button>`}else if(dayMatch){suggestion.innerHTML=`<strong>I spotted “${escapeHtml(dayMatch[0])}” and “${escapeHtml(timeMatch[0])}”.</strong> I can put both in for you. You can still change them before saving. <button class="btn tiny" id="reviewDumpReminder" type="button">Review reminder</button>`}else{suggestion.innerHTML=`<strong>I spotted “${escapeHtml(timeMatch[0])}”.</strong> I can put that time in for you. You can still change the day or time before saving. <button class="btn tiny" id="reviewDumpReminder" type="button">Review reminder</button>`}suggestion.classList.remove('hidden');return}
    if(shoppingPattern.test(line)){current={kind:'shopping',line,title:line};suggestion.innerHTML=`<strong>This sounds useful when you’re shopping.</strong> When are you going? Cuenora can remind you then. <button class="btn tiny" id="reviewDumpReminder" type="button">Choose reminder time</button>`;suggestion.classList.remove('hidden');return}
    const priorityMatch=line.match(priorityPattern);
    if(priorityMatch){current={kind:'priority',line,title:cleanTitle(line,priorityMatch),cue:priorityMatch[0]};suggestion.innerHTML=`<strong>You marked this “${escapeHtml(priorityMatch[0])}”.</strong> Want Cuenora to put it near the top? You can change the priority before adding it. <button class="btn tiny" id="reviewDumpTask" type="button">Review task</button>`;suggestion.classList.remove('hidden');return}
    current={kind:'unresolved',line,title:line};const count=dumpLines().length;suggestion.innerHTML=`<strong>${count===1?'This thought is':'These thoughts are'} still here.</strong> Nothing has been filed or removed. You can leave ${count===1?'it':'them'} here until Cuenora or you know what should happen next.`;suggestion.classList.remove('hidden')
  }
  function reviewReminder(){if(!current||!['time','shopping'].includes(current.kind))return;const title=reminderForm.querySelector('[name="title"]');const when=reminderForm.querySelector('[name="when"]');const repeat=reminderForm.querySelector('[name="repeat"]');title.value=current.title;when.value=current.kind==='time'?(current.pastToday?'':(current.dayCue?explicitDayOccurrence(current.dayCue,current.cue):nextLocalOccurrence(current.cue))):'';repeat.value='none';q('#nav [data-v="remind"]')?.click();setRouteSource(reminderForm,'reminder',current.line);when.focus()}
  function reviewTask(){if(!current||current.kind!=='priority')return;taskForm.querySelector('[name="title"]').value=current.title;taskForm.querySelector('[name="minutes"]').value=10;taskForm.querySelector('[name="priority"]').value='high';q('#nav [data-v="plan"]')?.click();setRouteSource(taskForm,'task',current.line);taskForm.querySelector('[name="title"]').focus()}

  dump.addEventListener('input',()=>{routeStatus.classList.add('hidden');analyse()});
  suggestion.addEventListener('click',e=>{if(e.target.closest('#reviewDumpReminder'))reviewReminder();if(e.target.closest('#reviewDumpTask'))reviewTask()});
  q('#nav')?.addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;clearRouteSource(reminderForm);clearRouteSource(taskForm)});
  reminderForm.addEventListener('submit',()=>{const source=reminderForm.dataset.cuenoraDumpSource;if(!source)return;const title=reminderForm.querySelector('[name="title"]')?.value||source;clearRouteSource(reminderForm);queueMicrotask(()=>completeRoute('reminder',source,title))});
  taskForm.addEventListener('submit',()=>{const source=taskForm.dataset.cuenoraDumpSource;if(!source)return;const title=taskForm.querySelector('[name="title"]')?.value||source;clearRouteSource(taskForm);queueMicrotask(()=>completeRoute('task',source,title))});
  analyse();
})();