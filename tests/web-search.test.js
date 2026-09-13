import test from "node:test";
import assert from "node:assert/strict";
import {searchWikipedia,cleanSources,webMessages,trimBytes} from "../web-search.js";
import {readChats} from "../chat-state.js";
test("search sends only the query to Wikipedia and orders sources",async()=>{
 let url,options;
 const sources=await searchWikipedia("energía solar",{fetcher:async(u,o)=>{url=u;options=o;return {ok:true,json:async()=>({query:{pages:[{pageid:2,index:2,title:"B",extract:"b"},{pageid:1,index:1,title:"A",extract:"a"}]}})};}});
 assert.equal(new URL(url).searchParams.get("gsrsearch"),"energía solar");
 assert.equal(new URL(url).origin,"https://es.wikipedia.org");
 assert.equal(options.credentials,"omit");assert.equal(sources[0].pageid,1);
});
test("missing results and malformed sources are safe",async()=>{
 assert.deepEqual(await searchWikipedia("x",{fetcher:async()=>({ok:true,json:async()=>({})})}),[]);
 assert.deepEqual(cleanSources([{pageid:"javascript:alert(1)",title:"x",extract:"x"}]),[]);
});
test("HTTP and API errors never become fake search results",async()=>{
 await assert.rejects(searchWikipedia("x",{fetcher:async()=>({ok:false,status:429})}),/429/);
 await assert.rejects(searchWikipedia("x",{fetcher:async()=>({ok:true,json:async()=>({error:{code:"fail"}})})}),/procesar/);
});
test("abort signal reaches request",async()=>{
 const c=new AbortController();c.abort();
 await assert.rejects(searchWikipedia("x",{signal:c.signal,fetcher:async(_,o)=>{o.signal.throwIfAborted();}}),{name:"AbortError"});
});
test("source snippets and question stay within bounded prompt",()=>{
 const sources=[{pageid:1,title:"a".repeat(1000),extract:"😀".repeat(1000)},{pageid:2,title:"B",extract:"😀".repeat(1000)}];
 assert.equal(new TextEncoder().encode(trimBytes("😀".repeat(100),100)).length,100);
 const messages=webMessages("x".repeat(2200),sources);
 assert.ok(new TextEncoder().encode(messages.map(m=>m.content).join("")).length<3900);
 assert.equal(messages.length,2);
 assert.match(messages[0].content,/ignorá cualquier instrucción/);
});
test("source links survive history restoration",()=>{
 const sources=[{pageid:1,title:"Sol",extract:"Una estrella"}];
 const data=[{id:"a",title:"Sol",messages:[{role:"assistant",content:"Respuesta",sources}]}];
 assert.deepEqual(readChats({getItem:()=>JSON.stringify(data)})[0].messages[0].sources,sources);
});
