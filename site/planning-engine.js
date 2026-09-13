(()=>{
  const actionPattern=/^(?:please\s+)?(?:need to\s+|remember to\s+|remind me to\s+|must\s+|should\s+|could\s+)?(?:call|phone|ring|email|reply|message|book|arrange|attend|submit|send|pay|buy|pick up|get|take|put|clean|wash|write|finish|start|check|collect|order|make|do|renew|cancel|return|bring|ask|prepare|study|read|fill|complete)\b/i;
  const temporalPattern=/\b(?:today|tomorrow|tmr|tonight|morning|afternoon|evening|noon|midnight|later|next\s+(?:week|month|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)|(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day)?|\d{1,2}(?::\d{2})?\s?(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d|\d{1,2}[/-]\d{1,2})\b/i;
  const urgentPattern=/\b(?:urgent|asap|immediately|right now|must do|overdue|deadline|today|tonight)\b/i;
  const lowPressurePattern=/\b(?:maybe|someday|idea|consider|could|when I can|no rush)\b/i;
  const shortPattern=/\b(?:quick|brief|tiny|one email|one call|reply|text|message|phone|ring)\b/i;
  const longPattern=/\b(?:report|essay|application|deep clean|research|presentation|assignment|project)\b/i;

  // A time-shaped token is not enough: require a future action or event.
  const eventWords='(?:dentist|dental|doctor|dr|gp|vet|hospital|clinic|consultant|nurse|physio|optician|appointment|appt|meeting|session|check-up|follow-up|booking)';
  const eventPattern=new RegExp(`^(?:(?:my|our|the)\\s+)?${eventWords}\\b`,'i');
  const firstPersonEventPattern=new RegExp(`^(?:i(?:['’]ve| have)\\s+got|i(?:['’]m| am)\\s+(?:due(?:\\s+(?:to(?:\\s+see)?|at))?|seeing|going\\s+to)|got)\\s+(?:(?:a|an|the)\\s+)?${eventWords}\\b`,'i');
  const temporalFirstEventPattern=new RegExp(`^(?:on\\s+)?(?:today|tomorrow|tmr|tonight|next\\s+(?:week|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)|(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day)?|\\d{1,2}[/-]\\d{1,2})\\b.{0,32}\\b${eventWords}\\b`,'i');
  const reminderManagementPattern=/^(?:please\s+)?(?:cancel|delete|remove|stop|disable|turn off|snooze|change|edit|move|reschedule)\s+(?:(?:my|the|that)\s+)?(?:reminder|notification|alarm)s?\b/i;
  const pastOrCancelledPattern=/\b(?:yesterday|last\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|said|recommended|told|was|were|already|cancelled|canceled|moved\s+(?:us\s+)?from)\b|\b(?:do not|don't|don’t|no need to)\s+remind\b/i;
  const dateAsTopicPattern=/\b(?:about|named|called|entitled)\s+(?:(?:next|this)\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b/i;
  const eventAsTopicPattern=new RegExp(`\\babout\\s+(?:the\\s+)?${eventWords}\\b`,'i');
  const referenceNumberPattern=/\b(?:page|chapter|version|ratio|score|serial|reference|code|room|bus number)\s+(?:(?:is|was|ends|number)\s+)*\d{1,2}[:/]\d{1,2}\b|\b\d{1,2}:\d{2}\s+(?:long|duration)\b/i;
  const broadTimePattern=/\b(?:tonight|morning|afternoon|evening|noon|midnight|weekend|fortnight|next\s+(?:week|month)|in\s+(?:a|an|\d+|one|two|three|four|five|six|seven|eight|nine|ten|half an)\s+(?:minutes?|hours?|days?|weeks?)|after\s+lunch|end of (?:the )?day|every(?:\s+other)?\s+(?:weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
  function hasReminderIntent(text){
    const value=clean(text);
    if(pastOrCancelledPattern.test(value)||dateAsTopicPattern.test(value)||eventAsTopicPattern.test(value)||referenceNumberPattern.test(value)||reminderManagementPattern.test(value))return false;
    const action=value.replace(/^(?:i\s+)?(?:need to|have to|want to)\s+/i,'');
    return actionPattern.test(action)||eventPattern.test(action)||firstPersonEventPattern.test(action)||temporalFirstEventPattern.test(action)||/^(?:(?:please\s+)?remind me|phone|ring|join|put)\b/i.test(action);
  }

  function clean(text){return String(text||'').replace(/\s+/g,' ').trim()}
  function effort(text){const value=clean(text);if(shortPattern.test(value))return 5;if(/\b(?:call|book|pay|order|collect|take medicine)\b/i.test(value))return 10;if(longPattern.test(value))return 30;if(/\b(?:clean|shop|prepare|study|write|finish)\b/i.test(value))return 20;return 10}
  function priority(text){const value=clean(text);if(urgentPattern.test(value))return'high';if(lowPressurePattern.test(value))return'low';return'normal'}
  function firstStep(text){const value=clean(text),lower=value.toLowerCase();if(/\b(?:email|reply|message)\b/.test(lower))return'Open the message or contact. You do not need to write yet.';if(/\b(?:call|phone|ring)\b/.test(lower))return'Open the contact or number. You do not need to call yet.';if(/\b(?:book|appointment|dentist|doctor|gp|vet)\b/.test(lower))return'Open the calendar or booking details and check only what is needed.';if(/\b(?:pay|bill|renew|cancel)\b/.test(lower))return'Open the account or letter. Check the amount or date first.';if(/\b(?:clean|wash|laundry)\b/.test(lower))return'Choose one visible item and move only that.';if(/\b(?:write|report|essay|form|application)\b/.test(lower))return'Open the document and write one rough line.';if(/\b(?:buy|pick up|get|collect|shop)\b/.test(lower))return'Check what you already have, then keep the list short.';return'Open or touch the first thing this needs. One step is enough.'}
  function analyse(text){
    const source=clean(text),hasAction=actionPattern.test(source),hasTime=temporalPattern.test(source),urgency=priority(source),minutes=effort(source);
    const suggestedKind=(hasTime||broadTimePattern.test(source))&&hasReminderIntent(source)?'reminder':hasAction?'task':'memory';
    const signals=[hasAction&&'action language',hasTime&&'time language',urgency==='high'&&'urgent wording',urgency==='low'&&'low-pressure wording'].filter(Boolean);
    return{version:1,source,suggestedKind,priority:urgency,effortMinutes:minutes,firstStep:firstStep(source),hasTemporalSignal:hasTime,confidence:hasAction?(hasTime?0.88:0.78):0.55,signals,requiresConfirmation:true,origin:'rules'};
  }
  function scoreTask(task,now=Date.now()){
    const p={high:40,normal:20,low:5}[task.priority]??20,duration=Math.max(1,Number(task.minutes)||10),quick=Math.max(0,15-Math.min(duration,15)),later=task.status==='later'?-30:0;
    const when=task.when?new Date(task.when).getTime():NaN,due=Number.isFinite(when)?(when<now?35:when-now<86400000?25:0):0;
    return p+quick+later+due;
  }
  function prioritise(tasks,now=Date.now()){return [...(Array.isArray(tasks)?tasks:[])].map((task,index)=>({task,index,score:scoreTask(task,now)})).sort((a,b)=>b.score-a.score||a.index-b.index).map(row=>row.task)}
  function planForCapacity(tasks,minutes){
    const budget=Number(minutes);
    if(!Number.isFinite(budget)||budget<=0)return{mode:'rest',task:null,minutes:0};
    const active=(Array.isArray(tasks)?tasks:[]).filter(task=>task&&task.status!=='done');
    const fits=active.filter(task=>(Number(task.minutes)||10)<=budget);
    const task=prioritise(fits.length?fits:active)[0]||null;
    if(!task)return{mode:'rest',task:null,minutes:0};
    return{mode:fits.length?'task':'first-step',task,minutes:fits.length?(Number(task.minutes)||10):Math.min(5,budget)};
  }
  function validateModelSuggestion(value){
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    if(!['memory','task','reminder'].includes(value.suggestedKind))return null;
    if(!['high','normal','low'].includes(value.priority))return null;
    const effortMinutes=Number(value.effortMinutes);if(!Number.isFinite(effortMinutes)||effortMinutes<1||effortMinutes>480)return null;
    const first=clean(value.firstStep);if(!first||first.length>240)return null;
    return{suggestedKind:value.suggestedKind,priority:value.priority,effortMinutes:Math.round(effortMinutes),firstStep:first,confidence:Math.max(0,Math.min(1,Number(value.confidence)||0))};
  }
  async function analyseWithAdapter(text,adapter){
    const baseline=analyse(text);if(typeof adapter!=='function')return baseline;
    try{const checked=validateModelSuggestion(await adapter({text:baseline.source,baseline,schemaVersion:1}));return checked?{...baseline,...checked,origin:'model',requiresConfirmation:true}:baseline}catch{return baseline}
  }
  window.CuenoraPlanning={analyse,analyseWithAdapter,prioritise,planForCapacity,validateModelSuggestion,hasReminderIntent,hasBroadTime:text=>broadTimePattern.test(clean(text))};
})();
