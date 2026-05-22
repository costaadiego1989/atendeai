import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

const WIDGET_SCRIPT = `(function(){
  var s=document.currentScript||(function(){var x=document.getElementsByTagName('script');return x[x.length-1];})();
  var token=s.getAttribute('data-token');
  if(!token)return;
  var apiBase=s.src.substring(0,s.src.lastIndexOf('/widget.js'));

  var visitorId=localStorage.getItem('_atai_vid');
  if(!visitorId){visitorId='v_'+Math.random().toString(36).substr(2,9)+Date.now().toString(36);localStorage.setItem('_atai_vid',visitorId);}
  var sessionId=localStorage.getItem('_atai_sid_'+token)||null;

  var isOpen=false,pollIv=null,outboundCnt=0,typingRow=null,typingTimer=null;
  var state='idle'; // idle|collecting|connecting|chatting
  var collectSteps=[],collectIdx=0,collectData={};
  var sessionProm=null,wCfg=null,qrDismissed=false,sessionResumed=false;

  function $id(id){return document.getElementById(id);}
  function $msgs(){return $id('_atai-msgs');}
  function $inp(){return $id('_atai-inp');}
  function $snd(){return $id('_atai-snd');}

  function injectCSS(cfg){
    var c=cfg.color||'#3b82f6';
    var side=cfg.position==='bottom-left'?'left':'right';
    var opp=side==='left'?'right':'left';
    var css=[
      '#_atai-btn,#_atai-panel,#_atai-btn *,#_atai-panel *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
      '#_atai-btn{position:fixed;bottom:20px;'+side+':20px;'+opp+':auto;z-index:2147483647;width:56px;height:56px;border-radius:50%;background:'+c+';border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;}',
      '#_atai-btn:hover{transform:scale(1.08);box-shadow:0 6px 22px rgba(0,0,0,.3);}',
      '#_atai-btn svg{width:26px;height:26px;fill:#fff;}',
      '#_atai-panel{position:fixed;bottom:86px;'+side+':20px;'+opp+':auto;z-index:2147483646;width:360px;max-width:calc(100vw - 32px);border-radius:18px;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.16);display:none;flex-direction:column;overflow:hidden;transform:translateY(14px);opacity:0;transition:transform .22s ease,opacity .22s ease;}',
      '#_atai-panel.open{display:flex;}#_atai-panel.vis{transform:translateY(0);opacity:1;}',
      '#_atai-hdr{background:'+c+';padding:13px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}',
      '#_atai-hdr img{width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;}',
      '#_atai-hdr-icon{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '#_atai-hdr-icon svg{width:22px;height:22px;fill:#fff;}',
      '#_atai-hdr-info{flex:1;min-width:0;}',
      '#_atai-hdr-name{font-weight:700;font-size:15px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#_atai-hdr-sub{font-size:12px;color:rgba(255,255,255,.8);display:flex;align-items:center;gap:5px;margin-top:2px;}',
      '#_atai-hdr-sub em{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;flex-shrink:0;}',
      '#_atai-xbtn{background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:50%;width:30px;height:30px;flex-shrink:0;transition:background .15s;margin-left:auto;}',
      '#_atai-xbtn:hover{background:rgba(255,255,255,.18);}',
      '#_atai-xbtn svg{width:18px;height:18px;fill:rgba(255,255,255,.9);}',
      '#_atai-rbtn{background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:50%;width:28px;height:28px;flex-shrink:0;transition:background .15s;opacity:.75;}',
      '#_atai-rbtn:hover{background:rgba(255,255,255,.18);opacity:1;}',
      '#_atai-rbtn svg{width:15px;height:15px;fill:#fff;}',
      '#_atai-msgs{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px;min-height:200px;max-height:340px;background:#f6f7f9;}',
      '._row{display:flex;align-items:flex-end;gap:7px;}._row.out{flex-direction:row-reverse;}',
      '._av{width:28px;height:28px;border-radius:50%;flex-shrink:0;overflow:hidden;background:'+c+';display:flex;align-items:center;justify-content:center;}',
      '._av img{width:100%;height:100%;object-fit:cover;}._av svg{width:15px;height:15px;fill:#fff;}',
      '._bub{max-width:78%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.5;word-break:break-word;animation:_pop .17s ease;}',
      '._row.in ._bub{background:#fff;color:#111;border-bottom-left-radius:3px;box-shadow:0 1px 4px rgba(0,0,0,.07);}',
      '._row.out ._bub{background:'+c+';color:#fff;border-bottom-right-radius:3px;}',
      '._typing-bub{display:flex;gap:5px;align-items:center;padding:12px 14px;}',
      '._typing-bub i{width:7px;height:7px;border-radius:50%;background:#bbb;display:inline-block;animation:_bnc 1.1s ease-in-out infinite;}',
      '._typing-bub i:nth-child(2){animation-delay:.18s;}._typing-bub i:nth-child(3){animation-delay:.36s;}',
      '#_atai-footer{padding:10px 12px;border-top:1px solid #eee;display:flex;gap:8px;align-items:flex-end;background:#fff;flex-shrink:0;}',
      '#_atai-inp{flex:1;border:1.5px solid #e5e7eb;border-radius:20px;padding:9px 14px;font-size:14px;outline:none;resize:none;line-height:1.45;max-height:80px;overflow-y:auto;transition:border-color .15s;background:#fff;display:block;}',
      '#_atai-inp:focus{border-color:'+c+';}#_atai-inp:disabled{background:#f4f4f5;cursor:default;color:#999;}',
      '#_atai-snd{background:'+c+';border:none;border-radius:50%;width:38px;height:38px;min-width:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity .15s,transform .1s;flex-shrink:0;}',
      '#_atai-snd:hover{opacity:.88;}#_atai-snd:active{transform:scale(.92);}#_atai-snd:disabled{opacity:.4;cursor:default;}',
      '#_atai-snd svg{width:17px;height:17px;fill:#fff;}',
      '#_atai-qr{padding:8px 12px 4px;display:flex;flex-wrap:wrap;gap:7px;background:#fff;flex-shrink:0;}',
      '#_atai-qr.hidden{display:none;}',
      '._qr-chip{background:#fff;border:1.5px solid '+c+';color:'+c+';border-radius:20px;padding:5px 13px;font-size:13px;cursor:pointer;transition:background .15s,color .15s;white-space:nowrap;}',
      '._qr-chip:hover{background:'+c+';color:#fff;}',
      '#_atai-wm{text-align:center;padding:5px 0 7px;font-size:11px;color:#c8c8c8;flex-shrink:0;background:#fff;}',
      '@keyframes _pop{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}',
      '@keyframes _bnc{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-7px);}}',
    ].join('');
    var el=document.createElement('style');el.textContent=css;document.head.appendChild(el);
  }

  function mkAv(){
    var d=document.createElement('div');d.className='_av';
    if(wCfg&&wCfg.avatarUrl){var img=document.createElement('img');img.src=wCfg.avatarUrl;img.alt='';d.appendChild(img);}
    else d.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';
    return d;
  }

  function typeText(el,txt,cb){
    var i=0,speed=15;
    (function t(){
      if(i<=txt.length){el.textContent=txt.slice(0,i++);var m=$msgs();if(m)m.scrollTop=m.scrollHeight;setTimeout(t,speed);}
      else if(cb)cb();
    })();
  }

  function addRow(dir,txt,opts){
    opts=opts||{};
    var m=$msgs();if(!m)return;
    var row=document.createElement('div');row.className='_row '+dir;
    if(dir==='in')row.appendChild(mkAv());
    var bub=document.createElement('div');bub.className='_bub';
    row.appendChild(bub);m.appendChild(row);m.scrollTop=m.scrollHeight;
    if(opts.type){typeText(bub,txt,function(){m.scrollTop=m.scrollHeight;if(opts.done)opts.done();});}
    else{bub.textContent=txt;if(opts.done)opts.done();}
  }

  function showTyping(){
    hideTyping();
    var m=$msgs();if(!m)return;
    var row=document.createElement('div');row.className='_row in';row.id='_atai-tr';
    row.appendChild(mkAv());
    var b=document.createElement('div');b.className='_bub _typing-bub';
    b.innerHTML='<i></i><i></i><i></i>';
    row.appendChild(b);m.appendChild(row);m.scrollTop=m.scrollHeight;typingRow=row;
    typingTimer=setTimeout(function(){
      hideTyping();
      addRow('in','Não recebi resposta no momento. Tente novamente em instantes.');
      qrDismissed=false;showChips();
    },25000);
  }

  function hideTyping(){
    clearTimeout(typingTimer);typingTimer=null;
    if(typingRow&&typingRow.parentNode)typingRow.parentNode.removeChild(typingRow);
    typingRow=null;var old=$id('_atai-tr');
    if(old&&old.parentNode)old.parentNode.removeChild(old);
  }

  function maskPhone(v){
    var d=v.replace(/\D/g,'').slice(0,11);
    if(!d)return '';
    if(d.length<=2)return '('+d;
    if(d.length<=6)return '('+d.slice(0,2)+') '+d.slice(2);
    if(d.length<=10)return '('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);
    return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);
  }
  function isValidEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());}
  function isValidPhone(p){return p.replace(/\D/g,'').length>=10;}

  function showChips(){
    if(qrDismissed||!wCfg||!wCfg.quickReplies||!wCfg.quickReplies.length)return;
    var c=$id('_atai-qr');if(c)c.classList.remove('hidden');
  }
  function hideChips(){
    qrDismissed=true;
    var c=$id('_atai-qr');if(c)c.classList.add('hidden');
  }

  function agentSay(txt,delay){
    delay=delay==null?350:delay;
    return new Promise(function(res){
      setTimeout(function(){
        showTyping();
        var d=Math.min(Math.max(txt.length*13,700),1800);
        setTimeout(function(){hideTyping();addRow('in',txt,{type:true,done:res});},d);
      },delay);
    });
  }

  function ensureSession(){
    if(sessionProm)return sessionProm;
    sessionProm=fetch(apiBase+'/widget/'+token+'/sessions',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        visitorId:visitorId,
        visitorName:collectData.name||undefined,
        visitorPhone:collectData.phone||undefined,
        visitorEmail:collectData.email||undefined,
        visitorCpf:collectData.cpf||undefined,
        pageUrl:window.location.href,
      }),
    }).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(d){var x=d.data||d;sessionResumed=!!(x.resumed);sessionId=x.sessionId;localStorage.setItem('_atai_sid_'+token,sessionId);return sessionId;})
    .catch(function(e){sessionProm=null;console.warn('[AtendeAi widget] session error',e);return null;});
    return sessionProm;
  }

  function doSend(sid,txt){
    return fetch(apiBase+'/widget/'+token+'/messages',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sessionId:sid,visitorId:visitorId,text:txt}),
    }).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .catch(function(err){
      hideTyping();
      console.warn('[AtendeAi widget] send error',err);
      addRow('in','Ops! Erro ao enviar. Tente novamente em instantes.');
    });
  }

  function startPolling(){
    if(pollIv)return;
    pollIv=setInterval(function(){
      if(!sessionId||!isOpen)return;
      fetch(apiBase+'/widget/'+token+'/sessions/'+sessionId+'/messages')
        .then(function(r){return r.json();})
        .then(function(d){
          var all=((d.data||d).messages||[]).filter(function(m){return m.direction==='OUTBOUND';});
          if(all.length>outboundCnt){
            hideTyping();
            all.slice(outboundCnt).forEach(function(m){
              var t=m.content&&m.content.text?m.content.text:'';
              if(t)addRow('in',t,{type:true});
            });
            outboundCnt=all.length;
          }
        }).catch(function(){});
    },3000);
  }

  function stopPolling(){clearInterval(pollIv);pollIv=null;}

  function loadHistory(cb){
    if(!sessionId){if(cb)cb();return;}
    fetch(apiBase+'/widget/'+token+'/sessions/'+sessionId+'/messages')
      .then(function(r){return r.json();})
      .then(function(d){
        var msgs=((d.data||d).messages||[]);
        var m=$msgs();
        if(m&&msgs.length>0){
          msgs.forEach(function(msg){
            var dir=msg.direction==='OUTBOUND'?'in':'out';
            var t=(msg.content&&msg.content.text)||'';
            if(t)addRow(dir,t);
          });
          outboundCnt=msgs.filter(function(msg){return msg.direction==='OUTBOUND';}).length;
          m.scrollTop=m.scrollHeight;
        }
        if(cb)cb();
      })
      .catch(function(){if(cb)cb();});
  }

  function restartChat(){
    stopPolling();
    var sid=sessionId;
    sessionId=null;sessionProm=null;sessionResumed=false;outboundCnt=0;qrDismissed=false;
    localStorage.removeItem('_atai_sid_'+token);
    if(sid)fetch(apiBase+'/widget/'+token+'/sessions/'+sid,{method:'DELETE'}).catch(function(){});
    var m=$msgs();if(m)m.innerHTML='';
    collectIdx=0;collectData={};
    var i2=$inp(),sb=$snd();
    if(wCfg&&collectSteps.length>0){
      state='collecting';
      if(i2){i2.value='';i2.disabled=true;i2.placeholder='...';}
      if(sb)sb.disabled=true;
      if(wCfg.greeting)addRow('in',wCfg.greeting,{type:true,done:function(){nextStep();}});
      else nextStep();
    } else {
      state='chatting';
      if(i2){i2.value='';i2.disabled=false;i2.placeholder='Digite sua mensagem...';}
      if(sb)sb.disabled=false;
      if(wCfg&&wCfg.greeting)addRow('in',wCfg.greeting,{type:true,done:function(){showChips();}});
      else showChips();
    }
  }

  // ---- COLLECT FLOW ----
  function buildCollectSteps(cfg){
    var steps=[];
    if(cfg.collectName)steps.push({id:'name',q:'Como posso te chamar?',req:true,ph:'Seu nome completo'});
    if(cfg.collectPhone)steps.push({id:'phone',q:'Qual seu WhatsApp ou telefone?',req:true,ph:'(11) 9 9999-9999'});
    if(cfg.collectEmail)steps.push({id:'email',q:'Qual seu e-mail?',req:false,ph:'seu@email.com'});
    if(cfg.collectCpf)steps.push({id:'cpf',q:'Pode me passar seu CPF? (opcional — pressione Enter para pular)',req:false,ph:'000.000.000-00'});
    return steps;
  }

  function nextStep(){
    var i2=$inp(),sb=$snd();
    if(collectIdx>=collectSteps.length){
      // All fields collected — create session now with real data
      state='connecting';
      if(i2){i2.disabled=true;i2.placeholder='Aguarde...';}
      if(sb)sb.disabled=true;
      ensureSession().then(function(sid){
        if(!sid){
          // Session creation failed — reset so user can retry
          sessionProm=null;
          state='collecting';collectIdx=Math.max(0,collectIdx-1);
          if(i2){i2.disabled=false;i2.placeholder='Tente novamente...';}
          if(sb)sb.disabled=false;
          addRow('in','Ops! Falha ao conectar. Verifique sua conexão e tente novamente.');
          return;
        }
        state='chatting';
        if(i2){i2.disabled=false;i2.placeholder='Digite sua mensagem...';}
        if(sb)sb.disabled=false;
        if(sessionResumed){
          loadHistory(function(){showChips();startPolling();});
        } else {
          agentSay('Tudo certo! Como posso te ajudar?',200).then(function(){showChips();startPolling();});
        }
      });
      return;
    }
    var step=collectSteps[collectIdx];
    agentSay(step.q).then(function(){
      if(i2){i2.disabled=false;i2.placeholder=step.ph;i2.focus();}
    });
  }

  function handleCollect(){
    var i2=$inp();if(!i2)return;
    var val=i2.value.trim();
    var step=collectSteps[collectIdx];
    if(step.req&&!val){
      i2.style.borderColor='#ef4444';
      setTimeout(function(){if(i2)i2.style.borderColor='';},900);
      return;
    }
    if(val&&step.id==='phone'&&!isValidPhone(val)){
      i2.style.borderColor='#ef4444';i2.value='';
      agentSay('Número inválido. Digite com DDD, ex: (11) 9 9999-9999');
      return;
    }
    if(val&&step.id==='email'&&!isValidEmail(val)){
      i2.style.borderColor='#ef4444';
      var phBk=i2.placeholder;i2.placeholder='E-mail inválido. Ex: nome@email.com';
      setTimeout(function(){if(i2){i2.style.borderColor='';i2.placeholder=phBk;}},2200);
      return;
    }
    collectData[step.id]=val||null;
    i2.value='';i2.style.height='auto';i2.disabled=true;
    if(val)addRow('out',val);
    else addRow('out','Pular');
    collectIdx++;
    nextStep();
  }

  // ---- SEND ----
  function sendMessage(){
    if(state==='collecting'){handleCollect();return;}
    if(state!=='chatting')return;
    var i2=$inp();if(!i2)return;
    var txt=i2.value.trim();if(!txt)return;
    i2.value='';i2.style.height='auto';
    hideChips();
    addRow('out',txt);
    showTyping();
    ensureSession().then(function(sid){if(sid)doSend(sid,txt);});
  }

  // ---- PANEL ----
  function openPanel(){
    var p=$id('_atai-panel');if(!p)return;
    p.classList.add('open');
    requestAnimationFrame(function(){requestAnimationFrame(function(){p.classList.add('vis');});});
    isOpen=true;
    if(state==='chatting')startPolling();
    var i2=$inp();if(i2&&!i2.disabled)setTimeout(function(){i2.focus();},220);
  }

  function closePanel(){
    var p=$id('_atai-panel');if(!p)return;
    p.classList.remove('vis');
    setTimeout(function(){p.classList.remove('open');},240);
    isOpen=false;stopPolling();
  }

  // ---- DOM ----
  function buildDOM(cfg){
    var c=cfg.color||'#3b82f6';
    var btn=document.createElement('button');btn.id='_atai-btn';btn.setAttribute('aria-label','Abrir chat');
    btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

    var panel=document.createElement('div');panel.id='_atai-panel';

    var hdr=document.createElement('div');hdr.id='_atai-hdr';
    var avh;
    if(cfg.avatarUrl){avh=document.createElement('img');avh.src=cfg.avatarUrl;avh.alt='';}
    else{avh=document.createElement('div');avh.id='_atai-hdr-icon';avh.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';}
    var info=document.createElement('div');info.id='_atai-hdr-info';
    var nm=document.createElement('div');nm.id='_atai-hdr-name';nm.textContent=cfg.name||'Atendimento';
    var sub=document.createElement('div');sub.id='_atai-hdr-sub';sub.innerHTML='<em></em> Online';
    info.appendChild(nm);info.appendChild(sub);
    var xbtn=document.createElement('button');xbtn.id='_atai-xbtn';xbtn.setAttribute('aria-label','Fechar');
    xbtn.innerHTML='<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
    var rbtn=document.createElement('button');rbtn.id='_atai-rbtn';rbtn.setAttribute('aria-label','Reiniciar conversa');rbtn.title='Reiniciar conversa';
    rbtn.innerHTML='<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
    hdr.appendChild(avh);hdr.appendChild(info);hdr.appendChild(rbtn);hdr.appendChild(xbtn);

    var msgs=document.createElement('div');msgs.id='_atai-msgs';

    var qr=document.createElement('div');qr.id='_atai-qr';qr.classList.add('hidden');
    if(cfg.quickReplies&&cfg.quickReplies.length){
      cfg.quickReplies.forEach(function(label){
        var chip=document.createElement('button');chip.className='_qr-chip';chip.textContent=label;
        chip.addEventListener('click',function(){
          if(state!=='chatting')return;
          hideChips();
          var i2=$inp();if(i2){i2.value=label;}
          sendMessage();
        });
        qr.appendChild(chip);
      });
    }

    var ft=document.createElement('div');ft.id='_atai-footer';
    var i2=document.createElement('textarea');i2.id='_atai-inp';i2.rows=1;i2.placeholder='...';i2.disabled=true;
    var sb=document.createElement('button');sb.id='_atai-snd';sb.setAttribute('aria-label','Enviar');
    sb.innerHTML='<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    ft.appendChild(i2);ft.appendChild(sb);

    var wm=document.createElement('div');wm.id='_atai-wm';wm.textContent='Powered by AtendeAi';

    panel.appendChild(hdr);panel.appendChild(msgs);panel.appendChild(qr);panel.appendChild(ft);panel.appendChild(wm);
    document.body.appendChild(btn);document.body.appendChild(panel);

    btn.addEventListener('click',function(){isOpen?closePanel():openPanel();});
    xbtn.addEventListener('click',function(e){e.stopPropagation();closePanel();});
    rbtn.addEventListener('click',function(e){e.stopPropagation();restartChat();});
    sb.addEventListener('click',sendMessage);
    i2.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
    i2.addEventListener('input',function(){
      if(state==='collecting'&&collectSteps[collectIdx]&&collectSteps[collectIdx].id==='phone'){
        var cur=this.selectionStart,raw=this.value,m=maskPhone(raw);
        if(m!==raw){this.value=m;try{var d=m.length-raw.length;this.setSelectionRange(cur+d,cur+d);}catch(e){}}
      }
      this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px';
    });
  }

  // ---- INIT ----
  function init(){
    fetch(apiBase+'/widget/'+token+'/config')
      .then(function(r){return r.json();})
      .then(function(d){return d.data||d;})
      .then(function(cfg){
        wCfg=cfg;
        injectCSS(cfg);
        buildDOM(cfg);
        collectSteps=buildCollectSteps(cfg);
        // Skip collect if we already have an active session in localStorage
        var needsCollect=collectSteps.length>0&&!sessionId;
        if(needsCollect){
          state='collecting';
          if(cfg.greeting){
            addRow('in',cfg.greeting,{type:true,done:function(){nextStep();}});
          } else {
            nextStep();
          }
        } else {
          state='chatting';
          var i2=$inp();if(i2)i2.disabled=false;
          if(sessionId){
            // Resume: skip greeting, just load history
            loadHistory(function(){showChips();startPolling();});
          } else if(cfg.greeting){
            addRow('in',cfg.greeting,{type:true,done:function(){showChips();}});
          } else {
            showChips();
          }
        }
        // Proactive message
        if(cfg.proactiveDelay&&cfg.proactiveMsg&&cfg.proactiveDelay>0){
          setTimeout(function(){
            if(!isOpen){
              if(!needsCollect)addRow('in',cfg.proactiveMsg,{type:true});
              openPanel();
            }
          },cfg.proactiveDelay);
        }
      })
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
