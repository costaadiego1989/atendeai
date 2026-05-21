import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

const WIDGET_SCRIPT = `(function(){
  var script=document.currentScript||(function(){var s=document.getElementsByTagName('script');return s[s.length-1];})();
  var token=script.getAttribute('data-token');
  if(!token)return;
  var src=script.src;
  var apiBase=src.substring(0,src.lastIndexOf('/widget.js'));

  var sessionId=null;
  var visitorId=localStorage.getItem('_atai_vid')||null;
  var isOpen=false;
  var collected=false;
  var pollingInterval=null;
  var outboundCount=0;

  if(!visitorId){
    visitorId='v_'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);
    localStorage.setItem('_atai_vid',visitorId);
  }

  function fetchConfig(){
    return fetch(apiBase+'/widget/'+token+'/config')
      .then(function(r){return r.json();})
      .then(function(d){return d.data||d;});
  }

  function escHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function injectCSS(cfg){
    var c=cfg.color||'#3b82f6';
    var bg=cfg.backgroundColor||'#ffffff';
    var side=cfg.position==='bottom-left'?'left':'right';
    var css=[
      '#_atai-btn{position:fixed;bottom:20px;'+side+':20px;z-index:2147483647;width:56px;height:56px;border-radius:50%;background:'+c+';border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;transition:transform .2s;}',
      '#_atai-btn:hover{transform:scale(1.08);}',
      '#_atai-btn svg{width:28px;height:28px;fill:#fff;}',
      '#_atai-panel{position:fixed;bottom:86px;'+side+':20px;z-index:2147483646;width:360px;max-width:calc(100vw - 40px);border-radius:16px;background:'+bg+';box-shadow:0 8px 32px rgba(0,0,0,.18);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '#_atai-panel.open{display:flex;}',
      '#_atai-hdr{background:'+c+';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}',
      '#_atai-hdr img{width:36px;height:36px;border-radius:50%;object-fit:cover;}',
      '#_atai-hdr-icon{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '#_atai-hdr-icon svg{width:20px;height:20px;fill:#fff;}',
      '#_atai-hdr-info{flex:1;min-width:0;}',
      '#_atai-hdr-name{font-weight:600;font-size:15px;}',
      '#_atai-hdr-sub{font-size:12px;opacity:.85;}',
      '#_atai-msgs{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-height:160px;max-height:300px;}',
      '._atai-m{max-width:80%;padding:9px 13px;border-radius:12px;font-size:14px;line-height:1.45;word-break:break-word;}',
      '._atai-m.in{background:#f0f0f0;color:#222;align-self:flex-start;border-bottom-left-radius:3px;}',
      '._atai-m.out{background:'+c+';color:#fff;align-self:flex-end;border-bottom-right-radius:3px;}',
      '#_atai-collect{padding:14px 16px;display:flex;flex-direction:column;gap:8px;}',
      '._atai-lbl{font-size:12px;color:#666;margin-bottom:2px;display:block;}',
      '._atai-fld{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;font-family:inherit;}',
      '._atai-fld:focus{border-color:'+c+';}',
      '._atai-cbtn{background:'+c+';color:#fff;border:none;padding:10px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;width:100%;}',
      '._atai-cbtn:hover{opacity:.9;}',
      '#_atai-footer{padding:10px 12px;border-top:1px solid #eee;display:flex;gap:8px;background:#fff;flex-shrink:0;}',
      '#_atai-inp{flex:1;border:1px solid #ddd;border-radius:20px;padding:8px 14px;font-size:14px;outline:none;resize:none;line-height:1.4;max-height:80px;overflow-y:auto;font-family:inherit;}',
      '#_atai-inp:focus{border-color:'+c+';}',
      '#_atai-snd{background:'+c+';border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}',
      '#_atai-snd:hover{opacity:.9;}',
      '#_atai-snd svg{width:18px;height:18px;fill:#fff;}',
    ].join('');
    var st=document.createElement('style');
    st.textContent=css;
    document.head.appendChild(st);
  }

  function makeField(id,label,type,ac){
    var wrap=document.createElement('div');
    var lbl=document.createElement('label');
    lbl.className='_atai-lbl';
    lbl.htmlFor='_atai-f-'+id;
    lbl.textContent=label;
    var inp=document.createElement('input');
    inp.type=type;
    inp.id='_atai-f-'+id;
    inp.className='_atai-fld';
    inp.autocomplete=ac;
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    return wrap;
  }

  function valOf(id){
    var el=document.getElementById('_atai-f-'+id);
    return el?el.value.trim():'';
  }

  function addMsg(dir,text){
    var msgs=document.getElementById('_atai-msgs');
    if(!msgs)return;
    var d=document.createElement('div');
    d.className='_atai-m '+dir;
    d.textContent=text;
    msgs.appendChild(d);
    msgs.scrollTop=msgs.scrollHeight;
  }

  function initSession(name,phone,email,cpf){
    return fetch(apiBase+'/widget/'+token+'/sessions',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        visitorId:visitorId,
        visitorName:name||undefined,
        visitorPhone:phone||undefined,
        visitorEmail:email||undefined,
        visitorCpf:cpf||undefined,
        pageUrl:window.location.href,
      }),
    })
    .then(function(r){return r.json();})
    .then(function(d){
      var data=d.data||d;
      sessionId=data.sessionId;
      localStorage.setItem('_atai_sid_'+token,sessionId);
      return sessionId;
    });
  }

  function doSend(sid,text){
    fetch(apiBase+'/widget/'+token+'/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sessionId:sid,visitorId:visitorId,text:text}),
    }).catch(function(){});
  }

  function sendMessage(){
    var inp=document.getElementById('_atai-inp');
    var text=inp?inp.value.trim():'';
    if(!text)return;
    inp.value='';
    addMsg('out',text);
    if(sessionId){doSend(sessionId,text);}
    else{initSession('','','','').then(function(sid){doSend(sid,text);});}
  }

  function pollMessages(){
    if(!sessionId||!isOpen)return;
    fetch(apiBase+'/widget/'+token+'/sessions/'+sessionId+'/messages')
      .then(function(r){return r.json();})
      .then(function(d){
        var data=d.data||d;
        var all=(data.messages||[]).filter(function(m){return m.direction==='OUTBOUND';});
        if(all.length>outboundCount){
          all.slice(outboundCount).forEach(function(m){
            var t=m.content&&m.content.text?m.content.text:'';
            if(t)addMsg('in',t);
          });
          outboundCount=all.length;
        }
      }).catch(function(){});
  }

  function openPanel(cfg){
    var panel=document.getElementById('_atai-panel');
    if(panel)panel.classList.add('open');
    isOpen=true;
    if(!sessionId){
      var saved=localStorage.getItem('_atai_sid_'+token);
      if(saved)sessionId=saved;
    }
    if(collected&&!sessionId)initSession('','','','');
    pollingInterval=setInterval(pollMessages,3000);
    var inp=document.getElementById('_atai-inp');
    if(inp)setTimeout(function(){inp.focus();},100);
  }

  function closePanel(){
    var panel=document.getElementById('_atai-panel');
    if(panel)panel.classList.remove('open');
    isOpen=false;
    if(pollingInterval){clearInterval(pollingInterval);pollingInterval=null;}
  }

  function buildUI(cfg){
    // Button
    var btn=document.createElement('button');
    btn.id='_atai-btn';
    btn.setAttribute('aria-label','Abrir chat');
    btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

    // Panel
    var panel=document.createElement('div');
    panel.id='_atai-panel';

    // Header
    var hdr=document.createElement('div');
    hdr.id='_atai-hdr';
    var avatarEl=cfg.avatarUrl
      ?'<img src="'+escHtml(cfg.avatarUrl)+'" alt="" />'
      :'<div id="_atai-hdr-icon"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg></div>';
    hdr.innerHTML=avatarEl+'<div id="_atai-hdr-info"><div id="_atai-hdr-name">'+escHtml(cfg.name||'Atendimento')+'</div><div id="_atai-hdr-sub">Online</div></div>';
    panel.appendChild(hdr);

    // Messages
    var msgs=document.createElement('div');
    msgs.id='_atai-msgs';
    if(cfg.greeting){
      var g=document.createElement('div');
      g.className='_atai-m in';
      g.textContent=cfg.greeting;
      msgs.appendChild(g);
    }
    panel.appendChild(msgs);

    // Collect form
    var needsCollect=cfg.collectName||cfg.collectPhone||cfg.collectEmail||cfg.collectCpf;
    var collectDiv=document.createElement('div');
    collectDiv.id='_atai-collect';
    if(needsCollect){
      if(cfg.collectName)collectDiv.appendChild(makeField('name','Seu nome','text','name'));
      if(cfg.collectPhone)collectDiv.appendChild(makeField('phone','WhatsApp / Telefone','tel','tel'));
      if(cfg.collectEmail)collectDiv.appendChild(makeField('email','E-mail','email','email'));
      if(cfg.collectCpf)collectDiv.appendChild(makeField('cpf','CPF (opcional)','text','off'));
      var cbtn=document.createElement('button');
      cbtn.className='_atai-cbtn';
      cbtn.textContent='Começar conversa';
      cbtn.addEventListener('click',function(){
        if(cfg.collectName&&!valOf('name')){alert('Informe seu nome.');return;}
        if(cfg.collectPhone&&!valOf('phone')){alert('Informe seu telefone.');return;}
        collectDiv.style.display='none';
        footer.style.display='flex';
        collected=true;
        initSession(valOf('name'),valOf('phone'),valOf('email'),valOf('cpf'));
      });
      collectDiv.appendChild(cbtn);
    } else {
      collected=true;
      collectDiv.style.display='none';
    }
    panel.appendChild(collectDiv);

    // Footer
    var footer=document.createElement('div');
    footer.id='_atai-footer';
    if(needsCollect)footer.style.display='none';
    var inp=document.createElement('textarea');
    inp.id='_atai-inp';
    inp.placeholder='Digite sua mensagem...';
    inp.rows=1;
    var snd=document.createElement('button');
    snd.id='_atai-snd';
    snd.setAttribute('aria-label','Enviar');
    snd.innerHTML='<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    footer.appendChild(inp);
    footer.appendChild(snd);
    panel.appendChild(footer);

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    btn.addEventListener('click',function(){isOpen?closePanel():openPanel(cfg);});
    snd.addEventListener('click',sendMessage);
    inp.addEventListener('keydown',function(e){
      if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}
    });

    if(cfg.proactiveDelay&&cfg.proactiveMsg&&cfg.proactiveDelay>0){
      setTimeout(function(){
        if(!isOpen){
          addMsg('in',cfg.proactiveMsg);
          openPanel(cfg);
        }
      },cfg.proactiveDelay);
    }
  }

  function init(){
    fetchConfig()
      .then(function(cfg){injectCSS(cfg);buildUI(cfg);})
      .catch(function(e){console.warn('[AtendeAi widget] config load failed',e);});
  }

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}
  else{init();}
})();`;

@Controller()
export class WidgetScriptController {
  @Get('widget.js')
  serveScript(@Res() res: Response): void {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(WIDGET_SCRIPT);
  }
}
