(()=>{
  const RawSpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const isIOS=/iPad|iPhone|iPod/i.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const SpeechRecognition=isIOS?null:RawSpeechRecognition;
  const targets=[
    {selector:'#dumpText',label:'Speak Brain Dump',append:true},
    {selector:'#taskForm [name="title"]',label:'Speak task',append:false},
    {selector:'#memoryForm [name="text"]',label:'Speak memory note',append:true},
    {selector:'#reminderForm [name="title"]',label:'Speak reminder',append:false}
  ];
  let activeRecognition=null;
  let activeButton=null;
  let activeStatus=null;
  let activeTimer=null;

  const style=document.createElement('style');
  style.textContent=`
    .voice-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:7px}
    .voice-status{font-size:.8rem;color:var(--muted)}
    .voice-btn.listening{outline:3px solid color-mix(in srgb,var(--accent) 30%,transparent);background:var(--panel2)}
    .voice-privacy{margin-top:10px;padding:10px 12px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);font-size:.8rem}
  `;
  document.head.appendChild(style);

  function addText(el,text,append){
    const clean=String(text||'').trim();
    if(!clean)return;
    if(append&&el.value.trim()) el.value=`${el.value.trim()}\n${clean}`;
    else el.value=clean;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.focus();
  }

  function clearActive(message){
    if(activeTimer){clearTimeout(activeTimer);activeTimer=null}
    if(activeButton){activeButton.classList.remove('listening');activeButton.textContent='🎙 Speak';activeButton.setAttribute('aria-pressed','false')}
    if(message&&activeStatus)activeStatus.textContent=message;
    activeRecognition=null;activeButton=null;activeStatus=null;
  }

  function stopActive(message='Microphone stopped.'){
    const r=activeRecognition;
    if(!r){clearActive(message);return}
    try{r.stop()}catch{try{r.abort()}catch{}}
    clearActive(message);
  }

  function makeVoiceControl(cfg){
    const el=document.querySelector(cfg.selector);
    if(!el||el.dataset.voiceReady)return;
    el.dataset.voiceReady='1';
    const tools=document.createElement('div');tools.className='voice-tools';
    const button=document.createElement('button');button.type='button';button.className='btn tiny voice-btn';button.setAttribute('aria-label',cfg.label);button.setAttribute('aria-pressed','false');
    const status=document.createElement('span');status.className='voice-status';
    tools.append(button,status);el.insertAdjacentElement('afterend',tools);

    if(!SpeechRecognition){
      button.textContent='🎙 Keyboard mic';
      status.textContent=isIOS?'For reliability on iPhone/iPad, use the microphone on your phone keyboard.':'Use the microphone on your phone keyboard.';
      button.onclick=()=>{el.focus();status.textContent='Keyboard open — tap its microphone to dictate. Cuenora is not listening itself.'};
      return;
    }

    button.textContent='🎙 Speak';
    button.onclick=()=>{
      if(activeRecognition&&activeButton===button){stopActive('Microphone stopped.');return}
      if(activeRecognition)stopActive('Previous voice capture stopped.');
      let recognition;
      try{recognition=new SpeechRecognition()}catch{status.textContent='Voice capture is unavailable here. Use the keyboard microphone.';return}
      recognition.lang=document.documentElement.lang||navigator.language||'en-GB';
      recognition.interimResults=false;
      recognition.continuous=false;
      recognition.maxAlternatives=1;
      activeRecognition=recognition;activeButton=button;activeStatus=status;
      recognition.onstart=()=>{
        button.classList.add('listening');button.textContent='■ Stop listening';button.setAttribute('aria-pressed','true');
        status.textContent='Listening now. Tap Stop listening at any time.';
        if(activeTimer)clearTimeout(activeTimer);
        activeTimer=setTimeout(()=>{if(activeRecognition===recognition)stopActive('Microphone stopped automatically after 12 seconds.')},12000);
      };
      recognition.onresult=e=>{
        let text='';for(let i=e.resultIndex||0;i<e.results.length;i++)if(e.results[i].isFinal!==false)text+=`${e.results[i][0].transcript} `;
        addText(el,text,cfg.append);
        try{recognition.stop()}catch{try{recognition.abort()}catch{}}
        clearActive('Captured. Microphone stopped — you can edit before saving.');
      };
      recognition.onerror=e=>{
        const friendly=e.error==='not-allowed'?'Microphone permission was not allowed.':e.error==='no-speech'?'I did not catch anything. Microphone stopped.':'Voice capture could not finish. Microphone stopped; try again or use the keyboard microphone.';
        try{recognition.abort()}catch{}
        clearActive(friendly);
      };
      recognition.onend=()=>{if(activeRecognition===recognition)clearActive('Microphone stopped.')};
      try{recognition.start()}catch{clearActive('Voice capture is already listening or unavailable.')}
    };
  }

  targets.forEach(makeVoiceControl);
  const dumpCard=document.querySelector('#dump .card');
  if(dumpCard&&!document.querySelector('#voicePrivacy')){
    const note=document.createElement('div');note.id='voicePrivacy';note.className='voice-privacy';
    if(isIOS)note.textContent='On iPhone/iPad, Cuenora deliberately does not use in-app speech recognition because WebKit can leave the microphone session active. Use the microphone on your phone keyboard instead; Cuenora receives only the text you dictate into the field.';
    else if(SpeechRecognition)note.textContent='Voice capture uses the speech-recognition service provided by your browser/device. Depending on the browser, speech may be processed online. Cuenora stops listening after a result or after 12 seconds, and you can stop it manually at any time.';
    else note.textContent='In-app speech recognition is not available in this browser. You can still dictate using the microphone on your phone keyboard.';
    dumpCard.appendChild(note);
  }

  window.addEventListener('pagehide',()=>{if(activeRecognition){try{activeRecognition.abort()}catch{}clearActive()}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&activeRecognition){try{activeRecognition.abort()}catch{}clearActive()}});
})();
