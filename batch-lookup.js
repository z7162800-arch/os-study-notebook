import {parseHTML,lookupKey} from './batch-parser.js';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function findQuestions(question,bank){const k=lookupKey(question);return bank.filter(q=>[q.question,...(q.aliases||[])].some(s=>lookupKey(s)===k));}
let activeMode='lookup',inlineImportOpen=false,lastCopiedHTML=null;
function updateImportEntry(){
 const lookup=activeMode==='lookup';
 $('#lookup-panel').hidden=!lookup;
 $('#lookup-import-entry').hidden=!lookup;
 $('#import-panel').hidden=lookup&&!inlineImportOpen;
 $('#lookup-import-toggle').setAttribute('aria-expanded',String(inlineImportOpen));
 $('#lookup-import-toggle').textContent=inlineImportOpen?'收合匯入':'展開匯入';
 for(const mode of ['lookup','import'])$('#'+mode+'-tab').setAttribute('aria-pressed',String(mode===activeMode));
 const source=$('#lookup-html').value;
 $('#reuse-lookup-html').hidden=!lookup||!source.trim()||source===$('#questions-html').value;
}
function copyLookupHTML(){
 const source=$('#lookup-html').value;
 if(!source.trim()||source===$('#questions-html').value)return;
 $('#questions-html').value=lastCopiedHTML=source;
 $('#questions-file').value='';
 $('#questions-html').dispatchEvent(new Event('input',{bubbles:true}));
}
function syncLookupHTML(){
 const draft=$('#questions-html').value;
 if(activeMode==='lookup'&&inlineImportOpen&&(!draft.trim()||draft===lastCopiedHTML))copyLookupHTML();
 updateImportEntry();
}
for(const mode of ['lookup','import'])$('#'+mode+'-tab').addEventListener('click',()=>{activeMode=mode;syncLookupHTML();});
$('#lookup-import-toggle').addEventListener('click',()=>{inlineImportOpen=!inlineImportOpen;syncLookupHTML();});
$('#reuse-lookup-html').addEventListener('click',()=>{copyLookupHTML();updateImportEntry();$('#questions-html').focus();});
$('#questions-html').addEventListener('input',updateImportEntry);
let generation=0,timer;
function queue(){generation++;clearTimeout(timer);$('#lookup-results').replaceChildren();timer=setTimeout(search,350);}
async function search(){const version=generation,raw=$('#lookup-html').value;if(!raw.trim()){$('#lookup-status').textContent='放入 HTML 後自動查題。';return;}
 try{
 $('#lookup-status').textContent='正在搜尋全部科目與單元…';
 const questions=parseHTML(raw);if(!questions.length)throw Error('無法辨識題目，請放入含「妖獸 1.」「題目：」或編號題目的 HTML。');
 const response=await window.localQuestionBank.load();if(!response.ok)throw Error('題庫載入失敗，請重新貼上再試。');const data=await response.json();if(version!==generation)return;
 const map=new Map((window.QUESTION_BANK||[]).map(q=>[q.id,q]));for(const q of [...data.questions,...(data.overrides||[])])map.set(q.id,q);const bank=[...map.values()];let found=0;
 $('#lookup-results').innerHTML=questions.map((q,i)=>{
 const matches=findQuestions(q.question,bank);if(matches.length)found++;
 const versions=matches.flatMap(m=>[{...m},...(m.variants||[]).map(v=>({...m,...v,id:m.id}))]);
 const conflict=new Set(versions.map(m=>JSON.stringify([...(m.answers||[])].sort()))).size>1;
 return `<article><h3>${esc(q.number??i+1)}. ${esc(q.question)}</h3>${!matches.length?'<p class="pending">尚未收錄：找不到相同題目。</p>':`${conflict?'<p class="pending">找到多種答案，請對照科目、單元與選項確認。</p>':''}${versions.map(m=>`<div class="answer-result"><small>${m.subject==='algorithm'?'演算法':'作業系統'} · 第 ${esc(m.unit)} 單元</small>${m.pending?'<p class="pending">這題資料待補，尚無可確認答案。</p>':`<p class="new"><strong>題庫正確答案</strong></p><ul>${(m.answers||[]).map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`}<a class="question-open" href="./?question=${encodeURIComponent(m.id)}" target="_blank" rel="noopener">查看這題<span class="muted">（新分頁）</span></a></div>`).join('')}`}</article>`;
 }).join('');$('#lookup-status').textContent=`共 ${questions.length} 題：找到 ${found} 題、未收錄 ${questions.length-found} 題。答案依題庫內容顯示；選項換順序不影響查詢。`;
 }catch(e){if(version===generation)$('#lookup-status').textContent=e.message;}}
$('#lookup-html').addEventListener('input',()=>{queue();syncLookupHTML();});$('#lookup-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;if(f.size>5*1024*1024){$('#lookup-status').textContent='HTML 上限 5 MB。';return;}$('#lookup-html').value=await f.text();queue();syncLookupHTML();});
