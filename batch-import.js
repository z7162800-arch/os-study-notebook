import {parseHTML,combineHTML} from './batch-parser.js';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],generation=0,timer,busy=false;
const status=s=>$('#status').textContent=s;
function reset(){generation++;rows=[];$('#save').disabled=true;$('#preview').replaceChildren();clearTimeout(timer);timer=setTimeout(compare,350);}
async function compare(){
 const version=generation,subject=$('#subject').value,unit=$('#unit').value;
 if(!subject||!/^\d{1,2}$/.test(unit)||Number(unit)<1){status('請先選擇科目與第 1～99 單元。');return;}
 if(!$('#questions-html').value.trim()||!$('#answers-html').value.trim()){status('請放入題目 HTML 與答案 HTML。');return;}
 status('正在解析並比對最新題庫…');
 try{
  const questions=parseHTML($('#questions-html').value),answers=parseHTML($('#answers-html').value);
  if(!questions.length||!answers.length)throw Error('無法辨識題目或答案格式，尚未新增。請提供包含題目文字與「正確答案：」的完整 HTML。');
  const response=await window.localQuestionBank.load();if(!response.ok)throw Error('無法讀取題庫，請稍後再試。');
  const shared=await response.json();if(version!==generation)return;
  rows=combineHTML(questions,answers,[...(window.QUESTION_BANK||[]),...shared.questions],subject,unit);
  $('#preview').innerHTML=rows.map((q,i)=>`<article><label><input type="checkbox" data-row="${i}" ${q.status==='new'?'checked':'disabled'}><span><strong class="${q.status}">${({new:'可新增',duplicate:'已收錄',pending:'待確認'})[q.status]}</strong> · ${i+1}<pre>${esc(q.question)}</pre></span></label><small>${esc(q.reason)}</small>${q.options.length?'<ol>'+q.options.map(o=>`<li class="${q.answers.includes(o)?'correct':''}">${esc(o)}${q.answers.includes(o)?' ✓':''}</li>`).join('')+'</ol>':''}${q.answers.length?'<p>正確答案：'+q.answers.map(esc).join(' ／ ')+'</p>':''}</article>`).join('');
  status(`辨識 ${rows.length} 題：可新增 ${rows.filter(q=>q.status==='new').length} 題、已收錄 ${rows.filter(q=>q.status==='duplicate').length} 題、待確認 ${rows.filter(q=>q.status==='pending').length} 題。待確認不會匯入。`);updateButton();
 }catch(e){if(version===generation)status(e.message);}
}
function updateButton(){$('#save').disabled=busy||!$('#preview input:checked');}
$('#preview').addEventListener('change',updateButton);
for(const s of ['#subject','#unit','#questions-html','#answers-html'])$(s).addEventListener('input',reset);
for(const side of ['questions','answers'])$(`#${side}-file`).addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;if(f.size>5*1024*1024){status('每份 HTML 上限 5 MB。');return;}const text=await f.text();$(`#${side}-html`).value=text;$(`#${side}-html`).dispatchEvent(new Event('input',{bubbles:true}));});
$('#save').addEventListener('click',async()=>{
 const selected=[...$('#preview').querySelectorAll('input:checked')].map(el=>({el,q:rows[+el.dataset.row]}));if(!selected.length||busy)return;
 busy=true;const controls=[...document.querySelectorAll('input,select,textarea,button')].map(e=>[e,e.disabled]);for(const [el] of controls)el.disabled=true;let added=0,duplicates=0;
 try{
  for(const {el,q} of selected){
   status(`正在匯入… 已新增 ${added} 題，已略過 ${duplicates} 題。`);
   const response=await window.localQuestionBank.add([q]);
   const result=await response.json();if(!response.ok)throw Error(result.error||'匯入失敗');
   added+=result.added.length;duplicates+=result.duplicates;q.status='duplicate';el.checked=false;
   el.closest('article').querySelector('strong').textContent=result.added.length?'已新增':'已收錄';
  }
  status(`匯入完成：新增 ${added} 題、略過 ${duplicates} 題。題目已儲存在目前瀏覽器，回首頁即可查詢與練習。`);
 }catch(e){status(`已新增 ${added} 題、略過 ${duplicates} 題。${e.message} 未完成的題目保留勾選，可重試。`);}
 finally{busy=false;for(const [el,disabled] of controls)el.disabled=disabled;$('#preview').querySelectorAll('input').forEach(e=>e.disabled=rows[+e.dataset.row].status!=='new');updateButton();}
});
