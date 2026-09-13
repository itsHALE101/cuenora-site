(()=>{
  const q=s=>document.querySelector(s);
  const dump=q('#dumpText');
  const reminderForm=q('#reminderForm');
  const taskForm=q('#taskForm');
  const memoryForm=q('#memoryForm');
  const planning=window.CuenoraPlanning;
  if(!dump||!reminderForm||!taskForm||!memoryForm)return;

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
  const dayPattern=/\b(?:today|tomorrow|tmr|(?:next\s+|this\s+)?(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))\b/i;
  const appointmentPattern=/\b(?:dentist|dental|doctor|dr|gp|vet|hospital|clinic|consultant|nurse|physio|optician|appointment|appt|meeting|session|check-up|follow-up|booking|book|arrange|call|attend)\b/i;
  const historicalPattern=/\b(?:yesterday|last\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|said|recommended|told)\b/i;
  const shoppingPattern=/^\s*(?:buy|pick up|get)\s+\S+/i;
  const priorityPattern=/\b(?:urgent|asap|important|must\s+do)\b/i;
  const weekdays={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
  const CONTINUITY_KEY='cuenora-brain-dump-continuity-v1';
  const DRAFT_KEY='cuenora-brain-dump-draft-v1';
  let current=null;
  let ignoredLine=null;
  const numericDatePattern=/(?<![\w/.-])\d{1,2}([/-])\d{1,2}(?:\1\d{2,4})?(?![\w/.-])/;
  const reminderIntent=line=>planning?.hasReminderIntent(line)??false;
  const complexTimePattern=/\b(?:day after tomorrow|every|before|after|by|between|until|half past|quarter past|quarter to|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
  function ambiguousTiming(line){
    // A first regex match cannot choose between alternatives or resolve a range.
    const times=line.match(new RegExp(timePattern.source,'gi'))||[];
    const days=line.match(new RegExp(dayPattern.source,'gi'))||[];
    const uncertain=/\b(?:or|maybe|perhaps|possibly|not sure|i think)\b/i.test(line);
    const range=/\b\d{1,2}(?::[0-5]\d)?\s*(?:am|pm)?\s*(?:[-–—]|to)\s*\d{1,2}(?::[0-5]\d)?\s*(?:am|pm)\b/i.test(line);
    return times.length>1||days.length>1||range||uncertain&&(times.length>0||days.length>0||planning?.hasBroadTime(line));
  }
  function numericDateMessage(cue){
    const parts=cue.split(/[/-]/).map(Number),[day,month,year]=parts;
    const days=[31,year===undefined||year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
    if(month<1||month>12||day<1||day>days[month-1])return 'That date needs checking. Choose the intended date and time.';
    if(day<=12&&month<=12&&day!==month)return 'That date could be read two ways. Confirm the day, month and time.';
    return 'I spotted a date. Confirm the date and time before saving; I won’t guess missing details.';
  }
  function offerCorrection(){suggestion.insertAdjacentHTML('beforeend',' <button class="btn tiny" id="keepDumpThought" type="button">Keep as a thought</button>')}

  try{if(!dump.value.trim()){const draft=localStorage.getItem(DRAFT_KEY);if(draft)dump.value=draft}}catch{}

  function dumpLines(){return dump.value.split(/\n+/).map(x=>x.trim()).filter(Boolean)}
  function firstUsefulLine(){const lines=dumpLines();if(ignoredLine&&lines.includes(ignoredLine))return ignoredLine;return lines.find(line=>reminderIntent(line)&&(timePattern.test(line)||dayPattern.test(line)||numericDatePattern.test(line)||planning?.hasBroadTime(line)))||lines[0]||''}
  function canonicalDay(cue){const raw=String(cue||'').trim().toLowerCase();if(raw==='tmr')return'tomorrow';return raw.replace(/^(this\s+)/,'').replace(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)$/,name=>({mon:'monday',tue:'tuesday',tues:'tuesday',wed:'wednesday',thu:'thursday',thur:'thursday',thurs:'thursday',fri:'friday',sat:'saturday',sun:'sunday'}[name]))}
  function tidy(value){return String(value||'').replace(/\s{2,}/g,' ').replace(/\s+([,.!?])/g,'$1').replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g,'').trim()}
  function cleanTitle(line,...matches){let value=line;matches.filter(Boolean).forEach(match=>{value=value.replace(match[0],' ')});return tidy(value)||line}
  function parseCueTime(cue){const raw=String(cue||'').trim().toLowerCase();const ampm=raw.match(/^(\d{1,2})(?::(\d{2}))?\s?(am|pm)$/i);if(ampm){let hour=Number(ampm[1])%12;if(ampm[3].toLowerCase()==='pm')hour+=12;return{hour,minute:Number(ampm[2]||0)}}const twentyFour=raw.match(/^(\d{1,2}):(\d{2})$/);if(twentyFour)return{hour:Number(twentyFour[1]),minute:Number(twentyFour[2])};return null}
  function localValue(d){const z=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
  function nextLocalOccurrence(cue){const parsed=parseCueTime(cue);if(!parsed)return'';const d=new Date();d.setHours(parsed.hour,parsed.minute,0,0);if(d.getTime()<=Date.now())d.setDate(d.getDate()+1);return localValue(d)}
  function isPastToday(dayCue,timeCue){const day=String(dayCue||'').trim().toLowerCase();if(day&&day!=='today')return false;const parsed=parseCueTime(timeCue);if(!parsed)return false;const d=new Date();d.setHours(parsed.hour,parsed.minute,0,0);return d.getTime()<=Date.now()}
  function explicitDayOccurrence(dayCue,timeCue){const parsed=parseCueTime(timeCue);if(!parsed)return'';const raw=canonicalDay(dayCue);const now=new Date();const d=new Date(now);if(raw==='today'){d.setHours(parsed.hour,parsed.minute,0,0);return d.getTime()<=now.getTime()?'':localValue(d)}if(raw==='tomorrow'){d.setDate(d.getDate()+1);d.setHours(parsed.hour,parsed.minute,0,0);return localValue(d)}const next=raw.startsWith('next '),name=raw.replace(/^next\s+/,'');const target=weekdays[name];if(target===undefined)return'';let delta=(target-now.getDay()+7)%7;const todayAtCue=new Date(now);todayAtCue.setHours(parsed.hour,parsed.minute,0,0);if(delta===0&&(next||todayAtCue.getTime()<=now.getTime()))delta=7;d.setDate(d.getDate()+delta);d.setHours(parsed.hour,parsed.minute,0,0);return localValue(d)}
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function setRouteSource(form,kind,line){form.dataset.cuenoraDumpSource=line;form.dataset.cuenoraDumpKind=kind}
  function clearRouteSource(form){delete form.dataset.cuenoraDumpSource;delete form.dataset.cuenoraDumpKind}
  function removeOneThought(source){const parts=dump.value.split(/\n/);const target=String(source||'').trim();const index=parts.findIndex(part=>part.trim()===target);if(index<0)return false;parts.splice(index,1);dump.value=parts.join('\n').replace(/^\n+|\n+$/g,'');dump.dispatchEvent(new Event('input',{bubbles:true}));return true}
  function rememberRoute(kind,source,title){try{const prior=JSON.parse(localStorage.getItem(CONTINUITY_KEY)||'[]');const rows=Array.isArray(prior)?prior:[];rows.unshift({source:String(source||''),title:String(title||source||''),kind,routedAt:new Date().toISOString()});localStorage.setItem(CONTINUITY_KEY,JSON.stringify(rows.slice(0,200)))}catch{}}
  function routeLabel(kind){return kind==='reminder'?'Reminder':kind==='memory'?'Memory':'Task'}
  function completeRoute(kind,source,title){if(!source)return;const removed=removeOneThought(source);if(!removed)return;rememberRoute(kind,source,title);q('#nav [data-v="dump"]')?.click();const left=dumpLines().length;routeStatus.textContent=left?`${routeLabel(kind)} saved. ${left} thought${left===1?' is':'s are'} still here — I’ll keep ${left===1?'it':'them'} until you decide what happens next.`:`${routeLabel(kind)} saved. Brain Dump is clear and ready for the next thought.`;routeStatus.classList.remove('hidden');analyse();dump.focus({preventScroll:true})}

  function showUnresolved(line){
    const insight=planning?.analyse(line);current={kind:'unresolved',line,title:line,insight};const count=dumpLines().length,help=insight?.suggestedKind==='task'?` This sounds actionable; a gentle starting estimate is ${insight.effortMinutes} minutes at ${insight.priority==='low'?'low pressure':insight.priority+' priority'}.`:'';suggestion.innerHTML=`<strong>${count===1?'This thought is':'These thoughts are'} still here.</strong> Nothing has been filed or removed.${help} For “${escapeHtml(line)}”, choose only if one option feels right: <button class="btn tiny" id="reviewDumpTask" type="button">${insight?.suggestedKind==='task'?'Plan this':'Maybe a task'}</button> <button class="btn tiny" id="reviewDumpMemory" type="button">Just remember it</button>`;suggestion.classList.remove('hidden')
  }
  function analyse(){
    const line=firstUsefulLine();current=null;suggestion.classList.add('hidden');suggestion.innerHTML='';if(!line)return;
    if(line===ignoredLine){showUnresolved(line);return}
    if(!reminderIntent(line)&&!priorityPattern.test(line)){showUnresolved(line);return}
    const numericMatch=line.match(numericDatePattern);
    if(numericMatch&&reminderIntent(line)){
      current={kind:'numericDate',line,title:line};
      suggestion.innerHTML=`<strong>I spotted “${escapeHtml(numericMatch[0])}”.</strong> ${numericDateMessage(numericMatch[0])} <button class="btn tiny" id="reviewDumpReminder" type="button">Choose date and time</button>`;
      suggestion.classList.remove('hidden');offerCorrection();return;
    }
    const timeMatch=line.match(timePattern);const dayMatch=line.match(dayPattern);const historical=historicalPattern.test(line);
    if(reminderIntent(line)&&ambiguousTiming(line)){
      current={kind:'clarify',line,title:line,manualOnly:true};
      suggestion.innerHTML='<strong>Let’s check the timing.</strong> There may be more than one option here. Choose when this reminder should come back. Your original words will stay intact. <button class="btn tiny" id="reviewDumpReminder" type="button">Choose date and time</button>';
      suggestion.classList.remove('hidden');offerCorrection();return;
    }
    if(reminderIntent(line)&&((timeMatch&&complexTimePattern.test(line))||(!timeMatch&&planning?.hasBroadTime(line)))){
      current={kind:'clarify',line,title:line};
      suggestion.innerHTML='<strong>Let’s check the timing.</strong> Choose the date, time and repeat rule you mean. Your original words will stay intact. <button class="btn tiny" id="reviewDumpReminder" type="button">Choose date and time</button>';
      suggestion.classList.remove('hidden');offerCorrection();return;
    }
    if(timeMatch&&reminderIntent(line)&&!historical){const pastToday=isPastToday(dayMatch?.[0]||'',timeMatch[0]);current={kind:'time',line,title:line,cue:timeMatch[0],dayCue:dayMatch?.[0]||'',pastToday};if(pastToday){suggestion.innerHTML=`<strong>That time has already passed today.</strong> I won’t silently move it to another day. Choose a new time before saving. <button class="btn tiny" id="reviewDumpReminder" type="button">Choose new time</button>`}else if(dayMatch){suggestion.innerHTML=`<strong>I spotted “${escapeHtml(dayMatch[0])}” and “${escapeHtml(timeMatch[0])}”.</strong> I can put both in for you. You can still change them before saving. <button class="btn tiny" id="reviewDumpReminder" type="button">Review reminder</button>`}else{suggestion.innerHTML=`<strong>I spotted “${escapeHtml(timeMatch[0])}”.</strong> I can put that time in for you. You can still change the day or time before saving. <button class="btn tiny" id="reviewDumpReminder" type="button">Review reminder</button>`}suggestion.classList.remove('hidden');offerCorrection();return}
    if(dayMatch&&reminderIntent(line)&&!historical){current={kind:'day',line,title:line,dayCue:dayMatch[0]};suggestion.innerHTML=`<strong>This sounds like something to remember on ${escapeHtml(dayMatch[0])}.</strong> Want a reminder? I’ll ask for the time, without guessing. <button class="btn tiny" id="reviewDumpReminder" type="button">Choose reminder time</button>`;suggestion.classList.remove('hidden');offerCorrection();return}
    if(shoppingPattern.test(line)){current={kind:'shopping',line,title:line};suggestion.innerHTML=`<strong>This sounds useful when you’re shopping.</strong> When are you going? Cuenora can remind you then. <button class="btn tiny" id="reviewDumpReminder" type="button">Choose reminder time</button>`;suggestion.classList.remove('hidden');offerCorrection();return}
    const priorityMatch=line.match(priorityPattern);
    if(priorityMatch){current={kind:'priority',line,title:cleanTitle(line,priorityMatch),cue:priorityMatch[0]};suggestion.innerHTML=`<strong>You marked this “${escapeHtml(priorityMatch[0])}”.</strong> Want Cuenora to put it near the top? You can change the priority before adding it. <button class="btn tiny" id="reviewDumpTask" type="button">Review task</button>`;suggestion.classList.remove('hidden');offerCorrection();return}
    showUnresolved(line)
  }
  function reviewReminder(){if(!current||!['time','shopping','day','numericDate','clarify'].includes(current.kind))return;const title=reminderForm.querySelector('[name="title"]'),when=reminderForm.querySelector('[name="when"]'),repeat=reminderForm.querySelector('[name="repeat"]'),value=current.kind==='time'?(current.pastToday?'':(current.dayCue?explicitDayOccurrence(current.dayCue,current.cue):nextLocalOccurrence(current.cue))):'';title.value=current.title;when.value=value;repeat.value='none';clearRouteSource(reminderForm);suggestion.innerHTML=`<form id="dumpReminderReview" novalidate><strong>Check this reminder beside your original thought.</strong><div class="muted tiny">Nothing will be scheduled until you save it.</div><p id="dumpDeliveryStatus" class="muted tiny" aria-live="polite"></p><div class="field"><label for="dumpReminderTitle">What should come back?</label><input id="dumpReminderTitle" name="title" required value="${escapeHtml(current.title)}"></div><div class="field"><label for="dumpReminderWhen">When?</label><input id="dumpReminderWhen" name="when" type="datetime-local" required value="${escapeHtml(value)}"></div><div class="field"><label for="dumpReminderRepeat">Repeat</label><select id="dumpReminderRepeat" name="repeat"><option value="none">Once</option><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekly">Every week</option></select></div><div class="row"><button class="btn primary" type="submit">Save reminder</button><button class="btn" id="keepDumpThought" type="button">Keep as a thought</button></div></form>`;updateDeliveryStatus();const inlineForm=q('#dumpReminderReview'),inlineWhen=inlineForm.elements.when;inlineWhen.min=localValue(new Date());(value?inlineForm.elements.title:inlineWhen).focus();if(current.kind==='clarify')void enrichReview(inlineForm,current.line);else inlineForm.dataset.timeState='ready'}
  function reviewTask(){if(!current||!['priority','unresolved'].includes(current.kind))return;const insight=planning?.analyse(current.title);taskForm.querySelector('[name="title"]').value=current.title;taskForm.querySelector('[name="minutes"]').value=insight?.effortMinutes||10;taskForm.querySelector('[name="priority"]').value=current.kind==='priority'?'high':insight?.priority||'normal';q('#nav [data-v="plan"]')?.click();setRouteSource(taskForm,'task',current.line);taskForm.querySelector('[name="title"]').focus()}
  function reviewMemory(){if(!current||current.kind!=='unresolved')return;memoryForm.querySelector('[name="text"]').value=current.title;memoryForm.querySelector('[name="when"]').value='';q('#nav [data-v="memory"]')?.click();setRouteSource(memoryForm,'memory',current.line);memoryForm.querySelector('[name="text"]').focus()}
  function syncAfterDumpMutation(){queueMicrotask(()=>{routeStatus.classList.add('hidden');analyse()})}
  async function enrichReview(form,source){
    if(current?.manualOnly){form.dataset.timeState='ready';return}
    form.dataset.timeState='loading';let edited=false;
    const markEdited=()=>{edited=true};form.addEventListener('input',markEdited);
    const candidate=await window.CuenoraDates?.suggest(source,new Date());
    form.removeEventListener('input',markEdited);
    // A slow parser must not overwrite the user's edits or a different thought.
    if(!form.isConnected||current?.line!==source)return;
    if(candidate&&!edited&&!form.elements.when.value){
      // datetime-local stores minutes; round up so relative reminders never fire early.
      const reviewDate=new Date(Math.ceil(new Date(candidate.date).getTime()/60000)*60000);
      const value=localValue(reviewDate);
      form.elements.when.value=value;reminderForm.elements.when.value=value;
      const explanation=document.createElement('p');explanation.className='muted tiny';
      explanation.textContent=`I read “${candidate.matchedText}” as ${reviewDate.toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'})}. Check this before saving.`;
      form.elements.when.insertAdjacentElement('afterend',explanation);
    }
    form.dataset.timeState='ready';
  }
  function updateDeliveryStatus(){
    const target=q('#dumpDeliveryStatus');if(!target)return;
    const status=q('#cloudStatus')?.textContent?.trim()||'Connection not verified';
    target.textContent=`Notification connection: ${status}. Saving a reminder does not enable notifications. Use the reminder button at the top to set them up.`;
  }
  const deliveryStatus=q('#cloudStatus');
  if(deliveryStatus)new MutationObserver(updateDeliveryStatus).observe(deliveryStatus,{childList:true,characterData:true,subtree:true});

  dump.addEventListener('input',()=>{ignoredLine=null;try{if(dump.value.trim())localStorage.setItem(DRAFT_KEY,dump.value);else localStorage.removeItem(DRAFT_KEY)}catch{};routeStatus.classList.add('hidden');analyse()});
  suggestion.addEventListener('click',e=>{if(e.target.closest('#keepDumpThought')){ignoredLine=current?.line||null;analyse();suggestion.querySelector('#reviewDumpMemory')?.focus();return}if(e.target.closest('#reviewDumpReminder'))reviewReminder();if(e.target.closest('#reviewDumpTask'))reviewTask();if(e.target.closest('#reviewDumpMemory'))reviewMemory()});
  suggestion.addEventListener('submit',e=>{const form=e.target.closest('#dumpReminderReview');if(!form)return;e.preventDefault();const fields=new FormData(form),titleInput=form.elements.title,title=String(fields.get('title')||'').trim(),when=form.elements.when,date=new Date(when.value);titleInput.setCustomValidity('');when.setCustomValidity('');if(!title){titleInput.setCustomValidity('Say what should come back.');titleInput.reportValidity();return}if(!Number.isFinite(date.getTime())||date.getTime()<=Date.now()){when.setCustomValidity('Choose a future date and time so Cuenora does not guess.');when.reportValidity();return}const source=current?.line,result=window.CuenoraBeta?.createReminder({title,when:when.value,repeat:fields.get('repeat')});if(!result?.ok){alert('This could not be saved on this device. Your thought is still here. Please try again.');return}completeRoute('reminder',source,title)});
  q('#dumpBtn')?.addEventListener('click',syncAfterDumpMutation);
  q('#dumpMemoryBtn')?.addEventListener('click',syncAfterDumpMutation);
  q('#clearDump')?.addEventListener('click',()=>{try{localStorage.removeItem(DRAFT_KEY)}catch{};syncAfterDumpMutation()});
  q('#nav')?.addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;clearRouteSource(reminderForm);clearRouteSource(taskForm);clearRouteSource(memoryForm)});
  [reminderForm,taskForm,memoryForm].forEach(form=>form.addEventListener('cuenora-item-saved',event=>{const source=form.dataset.cuenoraDumpSource;if(!source)return;clearRouteSource(form);completeRoute(event.detail.kind,source,event.detail.title)}));
  analyse();
})();
