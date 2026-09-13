(()=>{
  // Chrono supplies candidate dates, never intent or permission to schedule.
  const duration=/\bin\s+(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half an)\s+(?:minutes?|hours?)\b/i;
  const clock=/\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s?(?:am|pm)\b|\bnoon\b/i;
  const namedDate=/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i;
  const guarded=/\b(?:every|before|after|by|between|until|or|maybe|sometime|morning|afternoon|evening)\b|\d{1,2}[/-]\d{1,2}/i;
  let loader=null;
  function eligible(text){
    if(!window.CuenoraPlanning?.hasReminderIntent(text))return false;
    if(guarded.test(text.replace(/day after tomorrow/ig,'')))return false;
    return duration.test(text)||(clock.test(text)&&(namedDate.test(text)||/\bday after tomorrow\b/i.test(text)||/\bnoon\b/i.test(text)&&/\b(?:today|tomorrow)\b/i.test(text)));
  }
  async function suggest(text,reference=new Date()){
    if(typeof text!=='string'||text.length>2000||!eligible(text))return null;
    let timer;
    try{
      loader ||= import('./vendor/chrono-gb.mjs').catch(error=>{loader=null;throw error});
      const module=await Promise.race([loader,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1500)})]);
      if(!module)return null;
      const matches=module.GB.parse(text,reference,{forwardDate:false});
      if(matches.length!==1||matches[0].end)return null;
      const match=matches[0];
      if(!match.start.isCertain('hour'))return null;
      const date=match.start.date();
      if(!Number.isFinite(date.getTime())||date<=reference)return null;
      // Absolute dates still need an explicit clock. Relative minute/hour offsets
      // carry time from the review reference, rather than inventing a default.
      if(!duration.test(match.text)&&!clock.test(match.text))return null;
      return{date:date.toISOString(),matchedText:match.text,origin:'chrono-node-2.10.1-en-GB',requiresConfirmation:true};
    }catch{return null}finally{clearTimeout(timer)}
  }
  window.CuenoraDates={suggest};
})();
