'use strict';
(() => {
 const key='study-question-bank:'+new URL('.',location.href).pathname;
 const identity=s=>s.normalize('NFKC').toLowerCase().replace(/[\s\u200b-\u200f\u2060\ufeff]+/g,'');
 const scoped=(q,text)=>[q.subject||'os',String(q.unit),identity(text)].join('|');
 const read=()=>JSON.parse(localStorage.getItem(key)||'[]');
 window.localQuestionBank={
  async load(){return {ok:true,json:async()=>({questions:read(),overrides:[]})};},
  async add(batch){
   const saved=read();
   const known=new Set([...window.QUESTION_BANK,...saved].flatMap(row=>[row.question,...(row.aliases||[])].map(text=>scoped(row,text))));
   const added=[];
   for(const row of batch){
    const {question,subject,unit,answers,options=[]}=row;
    const fingerprint=scoped(row,question);
    if(known.has(fingerprint))continue;
    known.add(fingerprint);
    added.push({id:'local-'+crypto.randomUUID(),subject,unit:String(unit),question,answers,options,aliases:[],unitName:'第 '+unit+' 單元',group:'本機匯入',type:options.length?(answers.length>1?'multiple':'single'):/\[\s*__\d+__\s*\]/u.test(question)?'fill':'text',acceptedAnswers:answers,explanation:''});
   }
   try{if(added.length)localStorage.setItem(key,JSON.stringify([...saved,...added]));}catch{throw Error('瀏覽器無法儲存題目，請檢查網站儲存空間或瀏覽器設定。');}
   return {ok:true,json:async()=>({added,duplicates:batch.length-added.length})};
  }
 };
})();
