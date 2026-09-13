import test from "node:test";
import assert from "node:assert/strict";
import {searchWeb,cleanSources,sourceUrl} from "../web-search.js";
import {readChats} from "../chat-state.js";
test("general search uses keyless API without domain restriction or credentials",async()=>{
 let sent;
 const results=await searchWeb("Cómo funciona el Sol",{fetcher:async(url,options)=>{
 sent={url,...options};return {ok:true,json:async()=>({results:[{title:"Fuente",url:"https://example.org/article",content:"Extracto"}]})};
 }});
 assert.equal(sent.url,"https://api.tavily.com/search");
 assert.equal(sent.headers["X-Tavily-Access-Mode"],"keyless");
 assert.equal(sent.headers.Authorization,undefined);
 assert.equal(sent.credentials,"omit");
 const body=JSON.parse(sent.body);
 assert.equal(body.query,"Cómo funciona el Sol");
 assert.equal(body.include_domains,undefined);
 assert.equal(body.include_answer,false);
 assert.equal(sourceUrl(results[0]),"https://example.org/article");
});
test("unsafe links and credentials are removed",()=>{
 const s=url=>({title:"test",extract:"test",url});
 assert.deepEqual(cleanSources([s("javascript:alert(1)"),s("data:text/html,hello"),s("https://user:pass@example.org")]),[]);
});
test("free quota and invalid responses fail explicitly",async()=>{
 await assert.rejects(searchWeb("x",{fetcher:async()=>({ok:false,status:429})}),/gratuitas/);
 await assert.rejects(searchWeb("x",{fetcher:async()=>({ok:false,status:500})}),/500/);
 await assert.rejects(searchWeb("x",{fetcher:async()=>({ok:true,json:async()=>({message:"register"})})}),/válidos/);
 assert.deepEqual(await searchWeb("x",{fetcher:async()=>({ok:true,json:async()=>({results:[]})})}),[]);
});
test("cancelling passes abort signal to general web request",async()=>{
 const c=new AbortController();c.abort();
 await assert.rejects(searchWeb("x",{signal:c.signal,fetcher:async(_,o)=>o.signal.throwIfAborted()}),{name:"AbortError"});
});
test("web sources survive history without model-invented links",()=>{
 const sources=[{title:"Fuente",extract:"Texto",url:"https://example.org/"}];
 const chats=readChats({getItem:()=>JSON.stringify([{id:"a",title:"a",messages:[{role:"assistant",content:"a",sources}]}])});
 assert.deepEqual(chats[0].messages[0].sources,sources);
});
