(()=>{
  const STATE_KEY='cuenora-beta-v1';
  const CLOUD_KEY='cuenora-cloud-v1';
  const DEVICE_KEY='cuenora-cloud-device-v1';
  const OUTBOX_KEY='cuenora-reminder-outbox-v1';
  const config=window.CUENORA_CLOUD||{};
  const privacy=window.CuenoraPrivacy;
  const button=document.getElementById('notifyBtn');
  const statusEl=document.getElementById('cloudStatus');
  const noticeEl=document.getElementById('reminderNotice');
  const deleteButton=document.getElementById('deleteCloudBtn');
  let syncing=false,debounceTimer=null,connecting=false,suppressTracking=false;
  let cloud={connected:false,...readJson(CLOUD_KEY,{})};
  function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
  function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
  function b64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
  function getDevice(){let d=readJson(DEVICE_KEY,null);if(d?.id&&d?.secret)return d;const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);d={id:crypto.randomUUID?crypto.randomUUID():`c-${Date.now()}-${Math.random().toString(36).slice(2)}`,secret:b64url(bytes)};writeJson(DEVICE_KEY,d);return d}
  function keyBytes(s){const p='='.repeat((4-s.length%4)%4),raw=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
  function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
  function standalone(){return matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true}
  function setStatus(text,bad=false){if(statusEl){statusEl.textContent=text;statusEl.classList.toggle('bad',bad);statusEl.classList.toggle('good',!bad)}if(button){button.textContent=cloud.connected?'Reliable reminders on':(isIOS()&&!standalone()?'Install for reminders':'Enable reminders')}}
  async function api(action,payload={}){
    if(!config.backendUrl)throw new Error('Cloud backend is not configured.');
    const d=getDevice(),controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const res=await fetch(config.backendUrl,{method:'POST',signal:controller.signal,headers:{'content-type':'application/json'},body:JSON.stringify({action,device_id:d.id,device_secret:d.secret,...payload})});
      const body=await res.json();
      if(!res.ok||body?.ok===false)throw new Error(body?.error||`Backend returned ${res.status}`);
      if(action==='get-reminders'?!Array.isArray(body?.reminders):body?.ok!==true)throw new Error('The reminder service returned an incomplete response.');
      return body;
    }catch(e){if(e.name==='AbortError')throw new Error('The reminder service took too long. Please try again.');throw e}
    finally{clearTimeout(timeout)}
  }
  async function registerSW(){if(!('serviceWorker'in navigator))throw new Error('This browser cannot run background reminders.');return navigator.serviceWorker.register('./sw.js',{scope:'./'})}
  function localState(){const s=readJson(STATE_KEY,{tasks:[],reminders:[],settings:{}});s.reminders=s.reminders||[];return s}
  function syncFingerprint(r){return JSON.stringify({title:r.title||'',when:r.when||'',anchor:r.anchor||r.when||'',repeat:r.repeat||'none',persistence:r.persistence||'once',repeatInterval:Number(r.repeatInterval||10),maxRepeats:Number(r.maxRepeats||6),status:r.status==='done'?'done':'active'})}
  function reminderMap(){return new Map(localState().reminders.filter(r=>r?.id).map(r=>[r.id,syncFingerprint(r)]))}
  let trackedReminders=reminderMap();
  function readOutbox(){const q=readJson(OUTBOX_KEY,{});return{upserts:q?.upserts&&typeof q.upserts==='object'?q.upserts:{},deletes:q?.deletes&&typeof q.deletes==='object'?q.deletes:{}}}
  function writeOutbox(q){if(Object.keys(q.upserts).length||Object.keys(q.deletes).length)writeJson(OUTBOX_KEY,q);else localStorage.removeItem(OUTBOX_KEY)}
  function pendingIds(){const q=readOutbox();return new Set([...Object.keys(q.upserts),...Object.keys(q.deletes)])}
  function deletionToken(){return `${Date.now()}-${Math.random().toString(36).slice(2)}`}
  function trackLocalMutations(){
    if(suppressTracking)return;
    const current=reminderMap(),q=readOutbox();
    for(const [id,fingerprint] of current){
      if(trackedReminders.get(id)!==fingerprint){q.upserts[id]=fingerprint;delete q.deletes[id]}
    }
    for(const id of trackedReminders.keys()){
      if(!current.has(id)){q.deletes[id]=deletionToken();delete q.upserts[id]}
    }
    trackedReminders=current;writeOutbox(q)
  }
  function primeOutbox(){
    const q=readOutbox();
    for(const [id,fingerprint] of reminderMap())if(!q.deletes[id])q.upserts[id]=fingerprint;
    writeOutbox(q)
  }
  async function privateTitle(title){if(privacy?.encryptText)return privacy.encryptText(title||'Reminder');return'Private reminder'}
  async function readableTitle(title){if(!privacy?.isEncrypted?.(title))return title||'Reminder';return await privacy.decryptText(title)||'Private reminder'}
  async function cloudReminder(r){const when=new Date(r.when);return{client_id:r.id,title:await privateTitle(r.title||'Reminder'),remind_at:when.toISOString(),occurrence_anchor:new Date(r.anchor||r.when).toISOString(),recurrence:['daily','weekdays','weekly'].includes(r.repeat)?r.repeat:'none',persistence:r.persistence==='repeat'?'repeat':'once',repeat_interval_min:Number(r.repeatInterval||10),max_repeats:Number(r.maxRepeats||6),status:r.status==='done'?'done':'active',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}}
  async function syncAll(strict=false){
    if(!cloud.connected||syncing){if(strict)throw new Error('Reminders are still syncing. Please try again.');return}
    syncing=true;let succeeded=false;
    try{
      const q=readOutbox(),state=localState(),byId=new Map(state.reminders.map(r=>[r.id,r]));
      for(const [id,token] of Object.entries(q.deletes)){
        await api('delete-reminder',{client_id:id});
        const latest=readOutbox();if(latest.deletes[id]===token){delete latest.deletes[id];writeOutbox(latest)}
      }
      const selected=Object.entries(q.upserts).map(([id,fingerprint])=>({row:byId.get(id),id,fingerprint})).filter(x=>x.row?.when);
      if(selected.length){
        const rows=await Promise.all(selected.map(x=>cloudReminder(x.row)));
        await api('sync-reminders',{reminders:rows});
        const latest=readOutbox();
        for(const x of selected)if(latest.upserts[x.id]===x.fingerprint)delete latest.upserts[x.id];
        writeOutbox(latest)
      }
      cloud.lastSync=new Date().toISOString();cloud.privateReminderText=true;cloud.outboxReady=true;writeJson(CLOUD_KEY,cloud);succeeded=true
    }catch(e){
      if(strict)throw e;
      setStatus('Reminder sync failed. Reconnect to try again.',true);if(button)button.textContent='Reconnect reminders';
      console.warn('Cuenora cloud sync failed',e)
    }finally{syncing=false;if(succeeded&&pendingIds().size){clearTimeout(debounceTimer);debounceTimer=setTimeout(syncAll,0)}}
  }
  async function reconcile(strict=false){
    if(!cloud.connected)return;
    try{
      // Snapshot only the rows we may merge, before any asynchronous work.
      const before=reminderMap();
      const remote=await api('get-reminders');
      const decoded=await Promise.all(remote.reminders.map(async rr=>({row:rr,title:await readableTitle(rr.title)})));
      // Capture, settings, and edits may have changed while fetching/decrypting.
      // Read them again, then finish this merge without another await.
      const s=localState(),byId=new Map(s.reminders.map(r=>[r.id,r])),pending=pendingIds();
      for(const {row:rr,title} of decoded){
        if(!rr.client_id||!rr.remind_at||!Number.isFinite(new Date(rr.remind_at).getTime()))continue;
        if(pending.has(rr.client_id))continue;
        let r=byId.get(rr.client_id);
        const previous=before.get(rr.client_id);
        if(previous!==undefined&&(!r||syncFingerprint(r)!==previous)){
          const q=readOutbox();
          if(r){q.upserts[rr.client_id]=syncFingerprint(r);delete q.deletes[rr.client_id]}
          else{q.deletes[rr.client_id]=deletionToken();delete q.upserts[rr.client_id]}
          writeOutbox(q);pending.add(rr.client_id);continue
        }
        if(previous===undefined&&r){const q=readOutbox();q.upserts[rr.client_id]=syncFingerprint(r);delete q.deletes[rr.client_id];writeOutbox(q);pending.add(rr.client_id);continue}
        if(!r){
          r={id:rr.client_id,title,when:rr.remind_at,anchor:rr.occurrence_anchor||rr.remind_at,repeat:rr.recurrence||'none',status:rr.status==='done'?'done':'active',lastFired:rr.last_sent_at||null};
          s.reminders.push(r);byId.set(r.id,r);
        }else{
          if(title&&title!=='Private reminder')r.title=title;
          r.repeat=rr.recurrence||r.repeat||'none';
          if(rr.status==='done')r.status='done';
          if(new Date(rr.remind_at).getTime()!==new Date(r.when).getTime()){
            r.when=rr.remind_at;r.anchor=rr.occurrence_anchor||rr.remind_at;r.lastFired=null;
          }
          if(rr.status==='waiting'&&rr.last_sent_at)r.lastFired=rr.last_sent_at;
        }
      }
      suppressTracking=true;
      try{writeJson(STATE_KEY,s);window.CuenoraBeta?.setState(s);trackedReminders=reminderMap()}
      finally{suppressTracking=false}
    }catch(e){if(strict)throw e;console.warn('Cuenora cloud reconcile failed',e)}
  }
  function connectionFailed(error){
    cloud.connected=false;
    try{writeJson(CLOUD_KEY,cloud)}catch{}
    setStatus(`Reminders need reconnecting: ${error.message}`,true);
    if(button)button.textContent='Reconnect reminders';
    if(noticeEl)noticeEl.textContent='The reminder connection could not be confirmed. Your saved reminders are still here. Reconnect to try again.';
  }
  async function connect(interactive){
    if(connecting)return;
    connecting=true;
    if(button)button.disabled=true;
    if(deleteButton)deleteButton.disabled=true;
    try{
      if(!config.backendUrl||!config.vapidPublicKey)throw new Error('Cloud reminder configuration is missing.');
      if(isIOS()&&!standalone())throw new Error('Add Cuenora to the Home Screen, open it from the icon, then enable reminders.');
      if(!('Notification'in window))throw new Error('Notifications are not supported by this browser.');
      // Request permission directly from the click, before other asynchronous work.
      let permission=Notification.permission;
      if(permission==='default'&&interactive)permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error(permission==='denied'?'Notifications are blocked. Allow Cuenora notifications in your device or browser settings, then reconnect.':'Tap Enable reminders and allow notifications to connect.');
      setStatus('Checking reminder connection…');
      if(button)button.textContent='Connecting…';
      const reg=await registerSW();
      if(!reg.pushManager)throw new Error('Background notifications are not supported by this browser.');
      let sub=await reg.pushManager.getSubscription();
      if(sub?.expirationTime!=null&&sub.expirationTime<=Date.now()){
        if(!interactive)throw new Error('Your notification subscription expired. Tap Reconnect reminders.');
        if(!await sub.unsubscribe())throw new Error('The expired subscription could not be replaced. Please try again.');
        sub=null;
      }
      if(!sub){
        if(!interactive)throw new Error('Your notification subscription is missing. Tap Reconnect reminders.');
        sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(config.vapidPublicKey)});
      }
      await api('register-device');
      await api('subscribe',{subscription:sub.toJSON()});
      cloud.connected=true;
      if(!cloud.outboxReady)primeOutbox();
      await reconcile(true);
      await syncAll(true);
      cloud.connectedAt=new Date().toISOString();
      writeJson(CLOUD_KEY,cloud);
      setStatus('Reminders connected · private text encrypted');
      if(noticeEl)noticeEl.textContent='The reminder service has confirmed this device and its saved reminders. Reminder text is encrypted before cloud sync. Check delivery with a harmless test reminder.';
    }catch(e){connectionFailed(e)}
    finally{connecting=false;if(button)button.disabled=false;if(deleteButton)deleteButton.disabled=false}
  }
  function enable(){return connect(true)}
  function verify(){return connect(false)}
  async function deleteCloudData(){if(connecting)return;if(!cloud.connected&&!readJson(DEVICE_KEY,null)){setStatus('No connected cloud reminder data on this device.');return}if(!confirm('Delete this device’s cloud reminder data? Local tasks, Brain Dump, memories and reminders will stay on this device.'))return;try{setStatus('Deleting cloud reminder data…');await api('delete-device-data');try{const reg=await navigator.serviceWorker?.ready,sub=await reg?.pushManager?.getSubscription();if(sub)await sub.unsubscribe()}catch{}cloud={connected:false};localStorage.removeItem(CLOUD_KEY);localStorage.removeItem(DEVICE_KEY);localStorage.removeItem(OUTBOX_KEY);trackedReminders=reminderMap();await privacy?.deleteLocalKey?.();setStatus('Cloud reminder data deleted. Local Cuenora data is still on this device.');if(noticeEl)noticeEl.textContent='Cloud reminder data for this device has been deleted. You can reconnect reliable reminders at any time.'}catch(e){setStatus(`Could not delete cloud data: ${e.message}`,true)}}
  async function handleNotificationAction(){const u=new URL(location.href),action=u.searchParams.get('pn_action'),rid=u.searchParams.get('pn_reminder');if(!action||!rid)return;try{const s=localState(),r=s.reminders.find(x=>x.id===rid);if(action==='snooze'){await api('snooze-reminder',{client_id:rid,minutes:5});if(r){r.when=new Date(Date.now()+5*60000).toISOString();r.status='active';r.lastFired=null}}else if(action==='done'){await api('ack-reminder',{client_id:rid});if(r&&r.repeat==='none')r.status='done'}writeJson(STATE_KEY,s);window.CuenoraBeta?.setState(s);if(r?.repeat!=='none')await reconcile()}catch(e){console.warn('Notification action failed',e)}finally{u.searchParams.delete('pn_action');u.searchParams.delete('pn_reminder');u.searchParams.delete('pn_anchor');history.replaceState({},'',u.pathname+u.search+u.hash)}}
  if(button)button.onclick=enable;
  if(deleteButton)deleteButton.onclick=deleteCloudData;
  window.addEventListener('cuenora-state-saved',()=>{trackLocalMutations();if(!cloud.connected)return;clearTimeout(debounceTimer);debounceTimer=setTimeout(syncAll,450)});
  if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type!=='cuenora-push-visible')return;const s=localState(),r=s.reminders.find(x=>x.id===e.data.clientReminderId);if(r){r.lastFired=new Date().toISOString();writeJson(STATE_KEY,s);window.CuenoraBeta?.setState(s)}});
  (async()=>{if(!config.backendUrl){setStatus('Local reminders only.');return}if(cloud.connected)await verify();else setStatus(isIOS()&&!standalone()?'Install for reminders':'Enable reminders');await handleNotificationAction()})();
})();
