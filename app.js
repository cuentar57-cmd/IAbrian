import {STORAGE_KEY, readChats, contextMessages} from "./chat-state.js";
const $ = id => document.getElementById(id);
let savedChats = [];
try { savedChats = readChats(localStorage); } catch { /* Storage may be disabled. */ }
let chats = savedChats, current = chats[0]?.id || null;
let engine, worker, busy = false, loading = false, cancelLoad;
function activeChat(){ return chats.find(c=>c.id===current); }
function status(message){ $("status").textContent = message; }
function persist(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0,30))); }
  catch { status("No se pudo guardar el historial. Esta conversación seguirá disponible mientras mantengas abierta la página."); }
}
function controls(){
  $("send").disabled = !engine || busy || loading;
  $("stop").hidden = !busy;
  $("new-chat").disabled = busy;
  $("clear-history").disabled = busy;
  $("activate").disabled = loading;
  $("cancel-load").hidden = !loading;
  $("messages").setAttribute("aria-busy",String(busy));
  document.querySelectorAll("#history button").forEach(b=>b.disabled=busy);
}
function closeMenu(){ $("sidebar").classList.remove("open"); $("menu").setAttribute("aria-expanded","false"); }
function renderHistory(){
  $("history").replaceChildren();
  if(!chats.length){ const p=document.createElement("small"); p.textContent="Tus ideas empiezan acá."; p.style.color="#9b9eac"; $("history").append(p); }
  for(const chat of chats){
    const b=document.createElement("button"); b.textContent=chat.title; b.className=chat.id===current?"active":"";
    b.disabled=busy;
    b.onclick=()=>{ if(busy)return; current=chat.id; render(); closeMenu(); };
    $("history").append(b);
  }
}
function appendMessage(message){
  const el=document.createElement("article"); el.className="message "+message.role;
  const label=document.createElement("div"); label.className="label"; label.textContent=message.role==="user"?"VOS":"✦ IABRIAN";
  const body=document.createElement("div"); body.className="content"; body.textContent=message.content;
  el.append(label,body);
  if(message.role==="assistant"){
    const copy=document.createElement("button"); copy.textContent="Copiar";
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(body.textContent); status("Respuesta copiada.");}catch{status("No se pudo copiar. Podés seleccionar el texto manualmente.");}};
    el.append(copy);
  }
  $("messages").append(el); return body;
}
function scroll(){ $("scroll-area").scrollTop=$("scroll-area").scrollHeight; }
function render(){
  const messages=activeChat()?.messages||[];
  $("welcome").hidden=!!messages.length;
  $("messages").replaceChildren(); messages.forEach(appendMessage);
  renderHistory(); controls(); scroll();
}
$("new-chat").onclick=()=>{if(busy)return; current=null;render();closeMenu();$("prompt").focus();};
$("clear-history").onclick=()=>{
  if(busy || !confirm("¿Borrar todas las conversaciones guardadas en este navegador?"))return;
  chats=[];current=null;persist();render();
};
$("menu").onclick=()=>{$("menu").setAttribute("aria-expanded",String($("sidebar").classList.toggle("open")));};
$("about").onclick=()=>$("info").showModal();
document.querySelectorAll("[data-prompt]").forEach(button=>button.onclick=()=>{
  $("prompt").value=button.dataset.prompt;$("prompt").focus();
});
$("cancel-load").onclick=()=>cancelLoad?.();
$("activate").onclick=async()=>{
  if(loading||engine)return;
  loading=true;controls();$("progress").hidden=false;
  $("badge").textContent="● Preparando IA";
  status("Comprobando compatibilidad…");
  let timer, cancelled=false;
  const abortPromise=new Promise((_,reject)=>{
    cancelLoad=()=>{cancelled=true;worker?.terminate();reject(new Error("Carga cancelada. Podés volver a intentarlo."));};
    timer=setTimeout(()=>{cancelled=true;worker?.terminate();reject(new Error("La carga demoró demasiado. Revisá tu conexión y volvé a intentarlo."));},600000);
  });
  try {
    const task=(async()=>{
      if(!isSecureContext || !navigator.gpu)throw new Error("Este navegador no tiene WebGPU disponible. Probá un navegador actualizado con aceleración gráfica, en HTTPS.");
      const adapter=await navigator.gpu.requestAdapter();
      if(!adapter)throw new Error("No se encontró una GPU compatible. Probá otro dispositivo o activá la aceleración gráfica del navegador.");
      const precision=adapter.features.has("shader-f16")?"q4f16_1":"q4f32_1";
      const model="Qwen2.5-0.5B-Instruct-"+precision+"-MLC";
      status("Preparando descarga. La primera vez puede tardar varios minutos…");
      const {CreateWebWorkerMLCEngine}=await import("https://esm.run/@mlc-ai/web-llm@0.2.85");
      if(cancelled)throw new Error("Carga cancelada.");
      worker=new Worker(new URL("./worker.js",import.meta.url),{type:"module"});
      const enginePromise=CreateWebWorkerMLCEngine(worker,model,{
        initProgressCallback:report=>{
          if(cancelled)return;
          $("progress").value=Math.max(0,Math.min(1,report.progress||0));
          status("Cargando IA · "+Math.round((report.progress||0)*100)+"%. Mantené esta pestaña abierta.");
        }
      },{context_window_size:4096});
      const workerFailure=new Promise((_,reject)=>{
        worker.addEventListener("error",()=>reject(new Error("No se pudo cargar el motor de IA. Revisá la conexión, los bloqueadores o probá otro navegador.")),{once:true});
      });
      return await Promise.race([enginePromise,workerFailure]);
    })();
    engine=await Promise.race([task,abortPromise]);
    $("activation").hidden=true;$("badge").textContent="● IA lista";$("badge").classList.add("ready");
    status("Todo listo. Las respuestas se generan en este dispositivo.");$("prompt").focus();
  }catch(error){
    worker?.terminate();worker=null;engine=null;
    $("badge").textContent="● IA sin activar";$("progress").value=0;
    $("activate").textContent="Reintentar ↗";
    status(error.message || "No se pudo activar la IA. Revisá tu conexión y la memoria disponible.");
  }finally{
    clearTimeout(timer);cancelLoad=null;loading=false;$("progress").hidden=true;controls();
  }
};
$("stop").onclick=()=>{if(engine&&busy){engine.interruptGenerate();status("Deteniendo respuesta…");}};
$("prompt").addEventListener("keydown",event=>{
  if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing){event.preventDefault();$("composer").requestSubmit();}
});
$("composer").onsubmit=async event=>{
  event.preventDefault();
  if(busy)return;
  if(!engine){status("Primero activá la IA para poder enviar tu pregunta.");return;}
  const text=$("prompt").value.trim();if(!text)return;
  if(new TextEncoder().encode(text).length>2200){status("El mensaje es muy largo para este modelo pequeño. Acortalo y volvé a enviarlo.");return;}
  if(!current){
    current=crypto.randomUUID();chats.unshift({id:current,title:text.slice(0,60),messages:[]});chats=chats.slice(0,30);
  }
  const chat=activeChat();
  // Drop an unanswered user turn after an interrupted or failed request.
  if(chat.messages.at(-1)?.role==="user")chat.messages.pop();
  chat.messages.push({role:"user",content:text});$("prompt").value="";
  busy=true;render();persist();status("IAbrian está pensando…");
  const reply={role:"assistant",content:""};
  const body=appendMessage(reply);
  try {
    const stream=await engine.chat.completions.create({
      messages:[{role:"system",content:"Sos IAbrian, un asistente útil. Respondé en español, de forma clara y breve. Admití cuando no sabés algo. No tenés acceso a internet, noticias en vivo ni herramientas. No inventes fuentes."},...contextMessages(chat.messages)],
      stream:true,max_tokens:512,temperature:0.6
    });
    let pinned=true;
    for await(const chunk of stream){
      pinned=$("scroll-area").scrollHeight-$("scroll-area").scrollTop-$("scroll-area").clientHeight<130;
      reply.content+=chunk.choices[0]?.delta?.content||"";
      body.textContent=reply.content;if(pinned)scroll();
    }
    if(!reply.content.trim())throw new Error("No se generó una respuesta. Probá enviar la pregunta de nuevo.");
    status("Respuesta terminada. Se usa solamente la parte reciente del chat como contexto.");
  }catch(error){
    status("No se pudo completar la respuesta. "+(error.message||"Probá recargar la página."));
    if(!reply.content.trim()){$("prompt").value=text;body.parentElement.remove();}
  }finally{
    if(reply.content.trim())chat.messages.push(reply);
    chat.messages=chat.messages.slice(-100);
    busy=false;controls();persist();$("prompt").focus();
  }
};
render();
