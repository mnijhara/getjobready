// Runtime compatibility guard for the React voice interview.
// The legacy handler uses the global `resultIndex` name while iterating SpeechRecognition results.
// Keep that value synchronized with the browser event so interim/final transcripts are processed safely.
(()=>{
  const Native=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Native||window.__gjrVoiceRuntimeFixed)return;
  window.__gjrVoiceRuntimeFixed=true;
  const Wrapped=function(){
    const recognition=new Native();
    return new Proxy(recognition,{set(target,prop,value){
      if(prop==='onresult'&&typeof value==='function'){
        target.onresult=e=>{window.resultIndex=Number(e?.resultIndex)||0;return value(e)};
      }else target[prop]=value;
      return true;
    }});
  };
  Wrapped.prototype=Native.prototype;
  if(window.SpeechRecognition)window.SpeechRecognition=Wrapped;
  if(window.webkitSpeechRecognition)window.webkitSpeechRecognition=Wrapped;
})();
