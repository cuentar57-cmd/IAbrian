import {renderMessage} from "./render-message.js?v=6";
import {todayContext, prepareQuestion, validateSchedule, calendarAnswer} from "./answer-context.js?v=6";
import {STORAGE_KEY, readChats, contextMessages} from "./chat-state.js?v=6";
import {searchWeb, webMessages, cleanSources, sourceUrl} from "./web-search.js?v=6";
const $ = id => document.getElementById(id);
let savedChats = [];
try { savedChats = readChats(localStorage); } catch { /* Storage may be disabled. */ }
let chats = savedChats, current = chats[0]?.id || null;
let engine, worker, busy = false, loading = false, cancelLoad;
let searchController, stopped=false, generating=false;
function activeChat(){ return chats.find(c=>c.id===current); }
function status(message){ $("status").textContent = message; if(loading)$("load-status").textContent=message; }
function persist(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0,30))); }
  catch { status("No se pudo guardar el historial. Esta conversación seguirá disponible mientras mantengas abierta la página."); }
}
function controls(){
  $("mode").disabled=busy;
  $("model").disabled=loading||!!engine;
  $("send").disabled = busy || loading;
  $("stop").hidden = !busy;
  $("new-chat").disabled = busy;
  $("clear-history").disabled = busy;
  $("activate").disabled = loading || busy;
  $("cancel-load").hidden = !loading;
  $("messages").setAttribute("aria-busy",String(busy));
  document.querySelectorAll("#history button").forEach(b=>b.disabled=busy);
}
function closeMenu(){ $("sidebar").classList.remove("open"); $("menu-overlay").hidden=true; $("menu").setAttribute("aria-expanded","false"); }
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
  const body=document.createElement("div"); body.className="content"; renderMessage(body,message.content);
  el.append(label,body);
  if(message.role==="assistant"){
    const copy=document.createElement("button"); copy.textContent="Copiar";
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(message.content); status("Respuesta copiada.");}catch{status("No se pudo copiar. Podés seleccionar el texto manualmente.");}};
    el.append(copy);
    if(message===activeChat()?.messages.at(-1)){
      const retry=document.createElement("button");retry.textContent="Volver a responder";retry.disabled=busy;
      retry.onclick=()=>{if(busy)return;const chat=activeChat();const last=chat.messages.at(-2);if(last?.role!=="user")return;chat.messages.splice(-2);$("prompt").value=last.content;render();$("composer").requestSubmit();};el.append(retry);
    }
  }
  appendSources(el,message.sources);
  $("messages").append(el); return body;
}
function appendSources(el,sources){
  const safe=cleanSources(sources);if(!safe.length)return;
  const section=document.createElement("details");section.className="sources";
  const summary=document.createElement("summary");summary.textContent="Fuentes consultadas · Web";section.append(summary);
  safe.forEach((source,i)=>{
    const card=document.createElement("div");card.className="source-card";
    const link=document.createElement("a");link.href=sourceUrl(source);link.target="_blank";link.rel="noopener noreferrer";link.textContent="["+(i+1)+"] "+source.title;
    const domain=document.createElement("span");domain.className="source-domain";domain.textContent=new URL(link.href).hostname;
    const excerpt=document.createElement("details");const title=document.createElement("summary");title.textContent="Ver extracto";
    const p=document.createElement("p");p.textContent=source.extract;excerpt.append(title,p);card.append(domain,link,excerpt);section.append(card);
  });
  if(safe.some(s=>s.pageid)){
  const credit=document.createElement("a");credit.href="https://creativecommons.org/licenses/by-sa/4.0/";credit.target="_blank";credit.rel="noopener noreferrer";credit.textContent="Extractos de Wikipedia · CC BY-SA 4.0 · Autores e historial en cada artículo";section.append(credit);
  }
  el.append(section);
}
$("mode").onchange=()=>status($("mode").value==="local"?"Solo IA local: tu pregunta no se envía al buscador.":"Las búsquedas se envían a Tavily; en repreguntas se incluye contexto reciente. Gratis con límites.");
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
$("menu").onclick=()=>{const open=$("sidebar").classList.toggle("open");$("menu").setAttribute("aria-expanded",String(open));$("menu-overlay").hidden=!open;if(open)$("new-chat").focus();};
$("menu-overlay").onclick=closeMenu;
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeMenu();}});
$("settings").onclick=()=>$("info").showModal();
$("prompt").addEventListener("input",()=>{$("prompt").style.height="auto";$("prompt").style.height=Math.min(120,$("prompt").scrollHeight)+"px";});
$("about").onclick=()=>$("info").showModal();
document.querySelectorAll("[data-prompt]").forEach(button=>button.onclick=()=>{
  $("prompt").value=button.dataset.prompt;$("prompt").focus();
});
$("cancel-load").onclick=()=>cancelLoad?.();
$("activate").onclick=async()=>{
  if(loading||engine||busy)return;
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
      if(!adapter)throw new Error("No hay una GPU compatible. Podés usar Buscar en la web sin activar la IA. Para conversar localmente, probá otro dispositivo o activá la aceleración gráfica.");
      const precision=adapter.features.has("shader-f16")?"q4f16_1":"q4f32_1";
      const model="Qwen2.5-"+$("model").value+"-Instruct-"+precision+"-MLC";
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
    $("activation").hidden=true;$("info").close();$("badge").textContent="● IA lista";$("badge").classList.add("ready");
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
$("stop").onclick=()=>{if(busy){stopped=true;searchController?.abort();if(generating)engine.interruptGenerate();status("Deteniendo…");}};
$("prompt").addEventListener("keydown",event=>{
  if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing){event.preventDefault();$("composer").requestSubmit();}
});
$("composer").onsubmit=async event=>{
  event.preventDefault();
  if(busy)return;
  
  const text=$("prompt").value.trim();if(!text)return;
  if(new TextEncoder().encode(text).length>2200){status("El mensaje es muy largo para este modelo pequeño. Acortalo y volvé a enviarlo.");return;}
  const requestContext=prepareQuestion(text,activeChat()?.messages||[],todayContext());
  const useWeb=$("mode").value==="web"||($("mode").value==="auto"&&requestContext.current);
  if(!engine&&!useWeb){status("Para conversar o escribir, activá la IA. También podés elegir Buscar en la web sin descargarla.");$("info").showModal();return;}
  if(!current){current=crypto.randomUUID();chats.unshift({id:current,title:text.slice(0,60),messages:[]});chats=chats.slice(0,30);}
  const chat=activeChat();
  if(requestContext.current&&!useWeb){
    status("Esta pregunta necesita datos actuales. Elegí Automático o Buscar en la web para consultarlos.");
    $("mode").focus();return;
  }
  // Drop an unanswered user turn after an interrupted or failed request.
  if(chat.messages.at(-1)?.role==="user")chat.messages.pop();
  chat.messages.push({role:"user",content:text});$("prompt").value="";
  const query=requestContext.query;
  stopped=false;busy=true;render();persist();status("IAbrian está pensando…");
  const reply={role:"assistant",content:""};
  const body=appendMessage(reply);
  try {
    let requestMessages;
    if(useWeb){
      status("Buscando en la web…");
      searchController=new AbortController();
      const timer=setTimeout(()=>searchController?.abort(),15000);
      try { reply.sources=await searchWeb(query,{signal:searchController.signal}); }
      catch(error){if(error.name==="AbortError")throw new Error(stopped?"Consulta cancelada.":"La consulta tardó demasiado. Revisá tu conexión.");throw error;}
      finally{clearTimeout(timer);searchController=null;}
      if(stopped)throw new Error("Consulta cancelada.");
      if(!reply.sources.length)throw new Error("No encontré páginas con extractos. Probá con una búsqueda más concreta.");
      appendSources(body.parentElement,reply.sources);
      if(requestContext.schedule){
        const calendar=calendarAnswer(text,reply.sources,requestContext);
        if(calendar){reply.content=calendar;body.textContent=calendar;status("Calendario consultado. Los horarios pueden cambiar.");return;}
        // A small model must not invent a fixture when no dated row can be identified.
        reply.content="No encontré un próximo partido con fecha y rival que pueda identificar con seguridad. Las fuentes de abajo pueden ayudarte a comprobar el calendario.";
        body.textContent=reply.content;status("No se pudo extraer una fecha fiable de estos resultados.");return;
      }
      if(!engine){
        reply.content="Extractos de la web (sin resumen de IA):\n\n"+reply.sources.slice(0,3).map((s,i)=>"["+(i+1)+"] "+s.title+"\n"+s.extract.slice(0,450)+(s.extract.length>450?"…":"")).join("\n\n");
        body.textContent=reply.content;status("Fuentes encontradas. Activá la IA para obtener un resumen conversacional.");return;
      }
      requestMessages=webMessages(text,reply.sources,requestContext);
      status("Leyendo las fuentes y preparando la respuesta…");
    }else{
      requestMessages=[{role:"system",content:"Fecha actual: "+requestContext.clock.date+". Zona horaria: "+requestContext.clock.timeZone+". Sos IAbrian. Respondé en español, de forma clara y breve. Admití cuando no sabés algo. En este mensaje no se consultó internet. No inventes fuentes."},...contextMessages(chat.messages)];
    }
    if(stopped)throw new Error("Consulta cancelada.");
    generating=true;
    const stream=await engine.chat.completions.create({
      messages:requestMessages,
      stream:true,max_tokens:512,temperature:useWeb?0.1:0.6
    });
    let pinned=true;
    for await(const chunk of stream){
      pinned=$("scroll-area").scrollHeight-$("scroll-area").scrollTop-$("scroll-area").clientHeight<130;
      reply.content+=chunk.choices[0]?.delta?.content||"";
      if(!requestContext.schedule)body.textContent=reply.content;
      else body.textContent="Verificando la fecha con las fuentes…";
      if(pinned)scroll();
    }
    if(!reply.content.trim())throw new Error("No se generó una respuesta. Probá enviar la pregunta de nuevo.");
    if(requestContext.schedule){reply.content=validateSchedule(reply.content,reply.sources||[],requestContext.clock);body.textContent=reply.content;}
    status(requestContext.schedule&&reply.content.startsWith("No puedo confirmar")?"No se pudo confirmar el próximo partido. Abrí las fuentes para revisar los datos.":stopped?"Respuesta detenida.":useWeb?"Respuesta basada en extractos de la web. Abrí las fuentes para verificarla.":"Respuesta terminada. Se usa solamente la parte reciente del chat como contexto.");
  }catch(error){
    status("No se pudo completar la respuesta. "+(error.message||"Probá recargar la página."));
    if(!reply.content.trim()){$("prompt").value=text;body.parentElement.remove();}
  }finally{
    
    if(reply.content.trim())chat.messages.push(reply);
    chat.messages=chat.messages.slice(-100);
    generating=false;busy=false;controls();persist();render();
  }
};
render();
