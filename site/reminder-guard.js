(()=>{
  const forms=[
    {form:document.querySelector('#reminderForm'),field:'when',message:'That time has already passed. Choose a future time so Cuenora does not guess or silently move the reminder.'},
    {form:document.querySelector('#memoryForm'),field:'when',message:'That bring-back time has already passed. Choose a future time, or leave it blank to keep this safely in Memory.'}
  ];

  function localMinuteValue(date=new Date()){
    const z=n=>String(n).padStart(2,'0');
    return `${date.getFullYear()}-${z(date.getMonth()+1)}-${z(date.getDate())}T${z(date.getHours())}:${z(date.getMinutes())}`;
  }

  function refreshMinimum(){
    const min=localMinuteValue();
    forms.forEach(({form,field})=>form?.elements?.[field]?.setAttribute('min',min));
  }

  function isPastOrInvalid(raw){
    if(!raw)return false;
    const when=new Date(raw);
    return Number.isNaN(when.getTime())||when.getTime()<=Date.now();
  }

  forms.forEach(({form,field,message})=>{
    if(!form)return;
    const input=form.elements[field];
    input?.addEventListener('input',()=>input.setCustomValidity(''));
    input?.addEventListener('invalid',()=>{
      const raw=String(input.value||'').trim();
      if(isPastOrInvalid(raw))input.setCustomValidity(message);
    });
    form.addEventListener('submit',event=>{
      const raw=String(input?.value||'').trim();
      if(!raw)return;
      if(isPastOrInvalid(raw)){
        event.preventDefault();
        event.stopImmediatePropagation();
        input.setCustomValidity(message);
        input.reportValidity();
        input.focus();
        return;
      }
      input.setCustomValidity('');
    },true);
  });

  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshMinimum()});
  window.addEventListener('focus',refreshMinimum);
  refreshMinimum();
})();
