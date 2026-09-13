const CUENORA_PRIVATE_DB='cuenora-private-v1',CUENORA_PRIVATE_STORE='keys',CUENORA_PRIVATE_KEY='reminder-content',CUENORA_PRIVATE_PREFIX='enc:v1:',CUENORA_PRIVATE_AAD=new TextEncoder().encode('cuenora-reminder-title-v1');
function cuenoraFrom64(s){const p='='.repeat((4-s.length%4)%4),raw=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function cuenoraOpenPrivateDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(CUENORA_PRIVATE_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(CUENORA_PRIVATE_STORE))r.result.createObjectStore(CUENORA_PRIVATE_STORE,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function cuenoraPrivateKey(){const db=await cuenoraOpenPrivateDb();try{const raw=await new Promise((resolve,reject)=>{const tx=db.transaction(CUENORA_PRIVATE_STORE,'readonly'),r=tx.objectStore(CUENORA_PRIVATE_STORE).get(CUENORA_PRIVATE_KEY);r.onsuccess=()=>resolve(r.result?.raw||null);r.onerror=()=>reject(r.error)});if(!raw)return null;return crypto.subtle.importKey('raw',new Uint8Array(raw),{name:'AES-GCM'},false,['decrypt'])}finally{db.close()}}
async function cuenoraPrivateBody(value){if(typeof value!=='string'||!value.startsWith(CUENORA_PRIVATE_PREFIX))return value||'';try{const parts=value.slice(CUENORA_PRIVATE_PREFIX.length).split(':');if(parts.length!==2)return null;const key=await cuenoraPrivateKey();if(!key)return null;const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:cuenoraFrom64(parts[0]),additionalData:CUENORA_PRIVATE_AAD},key,cuenoraFrom64(parts[1]));return new TextDecoder().decode(plain)}catch{return null}}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let data={};try{data=event.data?event.data.json():{}}catch{data={body:event.data?event.data.text():''}}
    const reminderId=data.clientReminderId||data.reminderId||'';
    const occurrenceAnchor=data.occurrenceAnchor||'';
    const rawBody=data.body||data.title||'';
    const decrypted=await cuenoraPrivateBody(rawBody);
    const body=decrypted||((typeof rawBody==='string'&&rawBody.startsWith(CUENORA_PRIVATE_PREFIX))?'Private reminder — open Cuenora to view.':'You asked Cuenora not to let you forget this.');
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const visible=windows.some(c=>c.visibilityState==='visible');
    if(visible){for(const c of windows)c.postMessage({type:'cuenora-push-visible',clientReminderId:reminderId,occurrenceAnchor,body});return}
    await self.registration.showNotification(data.notificationTitle||'Cuenora',{
      body,
      tag:reminderId||`cuenora-${Date.now()}`,
      renotify:true,
      requireInteraction:!!data.requireInteraction,
      data:{clientReminderId:reminderId,occurrenceAnchor},
      actions:reminderId?[{action:'done',title:'Done'},{action:'snooze',title:'Snooze 5m'}]:[]
    });
  })())
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const reminderId=event.notification.data?.clientReminderId||'';
  const occurrenceAnchor=event.notification.data?.occurrenceAnchor||'';
  const target=new URL('./',self.registration.scope);
  if(reminderId&&(event.action==='done'||event.action==='snooze')){target.searchParams.set('pn_action',event.action);target.searchParams.set('pn_reminder',reminderId);if(occurrenceAnchor)target.searchParams.set('pn_anchor',occurrenceAnchor)}
  event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const c of windows){if('focus'in c){await c.navigate(target.href);return c.focus()}}return clients.openWindow(target.href)})())
});
