(()=>{
  const DB='cuenora-private-v1',STORE='keys',KEY_ID='reminder-content',PREFIX='enc:v1:',AAD=new TextEncoder().encode('cuenora-reminder-title-v1');
  const enc=new TextEncoder(),dec=new TextDecoder();
  const b64url=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')};
  const from64=s=>{const p='='.repeat((4-s.length%4)%4),raw=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
  function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function keyBytes(create=true){const db=await openDb();try{const found=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(KEY_ID);r.onsuccess=()=>resolve(r.result?.raw||null);r.onerror=()=>reject(r.error)});if(found)return new Uint8Array(found);if(!create)return null;const raw=new Uint8Array(32);crypto.getRandomValues(raw);await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({id:KEY_ID,raw});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});return raw}finally{db.close()}}
  async function cryptoKey(create=true){const raw=await keyBytes(create);if(!raw)return null;return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])}
  function truncateUtf8(value,maxBytes=160){let out='';for(const ch of String(value||'')){const next=out+ch;if(enc.encode(next).length>maxBytes)break;out=next}return out||'Reminder'}
  function isEncrypted(value){return typeof value==='string'&&value.startsWith(PREFIX)}
  async function encryptText(value){if(isEncrypted(value))return value;const key=await cryptoKey(true),iv=new Uint8Array(12);crypto.getRandomValues(iv);const plain=enc.encode(truncateUtf8(value));const sealed=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD},key,plain));return `${PREFIX}${b64url(iv)}:${b64url(sealed)}`}
  async function decryptText(value){if(!isEncrypted(value))return String(value||'');try{const parts=value.slice(PREFIX.length).split(':');if(parts.length!==2)return null;const key=await cryptoKey(false);if(!key)return null;const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(parts[0]),additionalData:AAD},key,from64(parts[1]));return dec.decode(plain)}catch{return null}}
  async function deleteLocalKey(){await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(DB);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);r.onblocked=()=>resolve()})}
  window.CuenoraPrivacy={encryptText,decryptText,isEncrypted,deleteLocalKey};
})();
