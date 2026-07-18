'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const childProcess=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const net=require('node:net');
const os=require('node:os');
const path=require('node:path');
const WebSocket=require('ws');

function freePort(){
  return new Promise((resolve,reject)=>{
    const server=net.createServer();
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      const port=server.address().port;
      server.close(error=>error?reject(error):resolve(port));
    });
  });
}

function waitForHealth(port,child,timeout=6000){
  const started=Date.now();
  return new Promise((resolve,reject)=>{
    const attempt=()=>{
      if(child.exitCode!=null){reject(new Error(`QA server exited with code ${child.exitCode}`));return;}
      const request=http.get({hostname:'127.0.0.1',port,path:'/health',timeout:500},response=>{
        response.resume();
        if(response.statusCode===200){resolve();return;}
        retry();
      });
      request.on('error',retry);
      request.on('timeout',()=>request.destroy());
    };
    const retry=()=>{
      if(Date.now()-started>timeout){reject(new Error('Timed out waiting for QA server'));return;}
      setTimeout(attempt,40);
    };
    attempt();
  });
}

function socketClient(port){
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
    const queues=new Map(),waiters=new Map(),anyWaiters=[],acks=new Map();
    let ackId=0,settled=false,socketId='';
    const dispatch=(event,data)=>{
      const anyIndex=anyWaiters.findIndex(waiter=>waiter.events.has(event));
      if(anyIndex>=0){
        const [waiter]=anyWaiters.splice(anyIndex,1);clearTimeout(waiter.timer);waiter.resolve({event,data});return;
      }
      const list=waiters.get(event)||[];
      const matchIndex=list.findIndex(waiter=>!waiter.predicate||waiter.predicate(data));
      if(matchIndex>=0){
        const [waiter]=list.splice(matchIndex,1);clearTimeout(waiter.timer);waiter.resolve(data);return;
      }
      const queue=queues.get(event)||[];queue.push(data);queues.set(event,queue.slice(-100));
    };
    const once=(event,predicate=null,timeout=4000)=>new Promise((res,rej)=>{
      const queue=queues.get(event)||[];
      const matchIndex=queue.findIndex(data=>!predicate||predicate(data));
      if(matchIndex>=0){const [data]=queue.splice(matchIndex,1);res(data);return;}
      const waiter={predicate,resolve:res,reject:rej,timer:null};
      waiter.timer=setTimeout(()=>{
        const list=waiters.get(event)||[],index=list.indexOf(waiter);if(index>=0)list.splice(index,1);
        rej(new Error(`Timed out waiting for ${event}`));
      },timeout);
      const list=waiters.get(event)||[];list.push(waiter);waiters.set(event,list);
    });
    const api={
      get id(){return socketId;},
      emit(event,payload){ws.send(`42${JSON.stringify([event,payload])}`);},
      request(event,payload,timeout=4000){
        return new Promise((res,rej)=>{
          const id=ackId++,timer=setTimeout(()=>{acks.delete(id);rej(new Error(`Timed out waiting for ${event} acknowledgement`));},timeout);
          acks.set(id,{resolve:value=>{clearTimeout(timer);res(value);}});
          ws.send(`42${id}${JSON.stringify([event,payload])}`);
        });
      },
      once,
      next(events,timeout=4000){
        return new Promise((res,rej)=>{
          const waiter={events:new Set(events),resolve:res,reject:rej,timer:null};
          waiter.timer=setTimeout(()=>{
            const index=anyWaiters.indexOf(waiter);if(index>=0)anyWaiters.splice(index,1);
            rej(new Error(`Timed out waiting for ${events.join(' or ')}`));
          },timeout);
          anyWaiters.push(waiter);
        });
      },
      close(){ws.close();},
    };
    ws.once('error',error=>{if(!settled)reject(error);});
    ws.on('message',raw=>{
      const message=String(raw);
      if(message.startsWith('0')){ws.send('40');return;}
      if(message==='2'){ws.send('3');return;}
      if(message.startsWith('40')){
        try{socketId=JSON.parse(message.slice(2)||'{}').sid||socketId;}catch{}
        if(!settled){settled=true;resolve(api);}return;
      }
      if(message.startsWith('43')){
        const match=message.match(/^43(\d+)(.*)$/);if(!match)return;
        const ack=acks.get(Number(match[1]));if(!ack)return;acks.delete(Number(match[1]));
        const values=JSON.parse(match[2]||'[]');ack.resolve(values[0]);return;
      }
      if(message.startsWith('42')){
        const match=message.match(/^42(?:\d+)?(\[.*)$/s);if(!match)return;
        const [event,data]=JSON.parse(match[1]);dispatch(event,data);
      }
    });
  });
}

function character(index){
  return{
    name:`Hero ${index}`,race:index%2?'elf':'human',class:'ranger',level:5,
    hp:200,maxHp:200,mp:100,maxMp:100,ac:18,atkBonus:100,inventory:['Health Potion'],
    stats:{str:12,dex:20,con:18,int:12,wis:16,cha:14},
  };
}

test('real server supports an eight-player campaign, synchronized dialogue, combat, and reconnects',{timeout:20000},async()=>{
  const port=await freePort();
  const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'sanctum-mp-qa-'));
  const sessionFile=path.join(tempDir,'sessions.json');
  const child=childProcess.spawn(process.execPath,['server.js'],{
    cwd:path.resolve(__dirname,'..'),
    env:{...process.env,PORT:String(port),SESSIONS_FILE:sessionFile,ANTHROPIC_API_KEY:''},
    stdio:['ignore','pipe','pipe'],
  });
  let serverOutput='';
  child.stdout.on('data',chunk=>{serverOutput+=chunk;});
  child.stderr.on('data',chunk=>{serverOutput+=chunk;});
  const clients=[];
  try{
    await waitForHealth(port,child);
    for(let index=0;index<8;index++)clients.push(await socketClient(port));
    const host=clients[0];
    const createdP=host.once('session_created');
    host.emit('create_session',{sessionName:'Eight Player QA',playerName:'Player 1',maxPlayers:8});
    const {code}=await createdP;
    for(let index=1;index<8;index++){
      const joinedP=clients[index].once('session_joined');
      clients[index].emit('join_session',{code,playerName:`Player ${index+1}`});
      await joinedP;
    }
    const allReadyP=host.once('session_update',session=>Object.values(session.players||{}).length===8&&Object.values(session.players).every(player=>player.ready));
    clients.forEach((client,index)=>client.emit('character_ready',{code,character:character(index+1)}));
    const readySession=await allReadyP;
    assert.equal(Object.values(readySession.players).length,8);

    const gameStarts=clients.map(client=>client.once('game_started'));
    host.emit('start_game',{code});
    await Promise.all(gameStarts);

    const speaker=clients[4],observer=clients[0];
    const observedOpen=observer.once('conversation_state');
    const opened=await speaker.request('conversation_open',{code,payload:{npcId:'captain_rhael',npcName:'Captain Rhael',npcTitle:'Captain of the Watch'}});
    assert.equal(opened.ok,true);
    assert.equal((await observedOpen).controllerId,speaker.id);
    const rejected=await clients[1].request('conversation_update',{code,type:'close',payload:{conversationId:opened.conversation.id}});
    assert.equal(rejected.ok,false);
    const observedResponse=observer.once('conversation_update',event=>event.type==='response');
    const response=await speaker.request('conversation_update',{code,type:'response',payload:{conversationId:opened.conversation.id,text:'The Archive doors are watched.',options:[{text:'End conversation',type:'end'}]}});
    assert.equal(response.ok,true);
    assert.equal((await observedResponse).payload.text,'The Archive doors are watched.');
    assert.equal((await speaker.request('conversation_update',{code,type:'close',payload:{conversationId:opened.conversation.id,graceful:true}})).ok,true);

    // A guest resurrection request is routed only to the authoritative host,
    // which will validate the current campaign fate and broadcast the snapshot.
    const resurrectionP=host.once('story_event',message=>message.eventType==='npc_fate_request');
    speaker.emit('story_event',{code,eventType:'npc_fate_request',payload:{npcId:'captain_rhael',fate:'spared',reason:'prayer_resurrection'}});
    const resurrection=await resurrectionP;
    assert.equal(resurrection.payload.npcId,'captain_rhael');
    assert.equal(resurrection.payload.reason,'prayer_resurrection');
    assert.equal(resurrection.fromPlayer,'Player 5');

    const combatStarts=clients.map(client=>client.once('combat_started'));
    host.emit('start_combat',{code,enemies:[{id:'qa_cultist',name:'QA Cultist',hp:1,maxHp:1,ac:1,atk:0,xp:80,tacticalRole:'frontline'}],encounter:{id:'standard'}});
    let combatState=(await Promise.all(combatStarts))[0];
    const oldId=clients[2].id;
    const disconnectedP=host.once('session_update',session=>Object.values(session.players||{}).some(player=>player.name==='Player 3'&&player.connected===false));
    clients[2].close();
    await disconnectedP;

    const intruder=await socketClient(port);clients.push(intruder);
    const fullP=intruder.once('join_error');
    intruder.emit('join_session',{code,playerName:'Ninth Player'});
    assert.match((await fullP).msg,/full/i);

    const reconnected=await socketClient(port);clients.push(reconnected);
    const rejoinP=reconnected.once('session_joined');
    const resumedCombatP=reconnected.once('combat_started');
    reconnected.emit('rejoin_session',{code,playerName:'Player 3',character:character(3)});
    const rejoin=await rejoinP;
    combatState=await resumedCombatP;
    clients[2]=reconnected;
    assert.equal(Object.values(rejoin.session.players).length,8);
    assert.equal(rejoin.session.players[oldId],undefined);
    assert.ok(combatState.turnOrder.includes(reconnected.id));
    assert.ok(!combatState.turnOrder.includes(oldId));

    let ended=null;
    for(let turn=0;turn<60&&!ended;turn++){
      const currentId=combatState.turnOrder[combatState.currentTurnIndex];
      const actor=combatState.combatants[currentId];
      const outcomeP=host.next(['combat_update','combat_ended'],5000);
      if(actor?.isPlayer){
        const client=clients.find(candidate=>candidate.id===currentId);
        assert.ok(client,`connected client exists for ${currentId}`);
        const enemy=Object.values(combatState.combatants).find(combatant=>!combatant.isPlayer&&combatant.hp>0);
        client.emit('combat_action',{code,action:'attack',targetId:enemy.id});
      }else{
        host.emit('enemy_turn',{code,seq:combatState._enemyTurnSeq});
      }
      const outcome=await outcomeP;
      if(outcome.event==='combat_ended')ended=outcome.data;
      else combatState=outcome.data.combatState;
    }
    assert.ok(ended,'combat reached an authoritative result');
    assert.equal(ended.victory,true);
    assert.equal(ended.xpEach,Math.floor(ended.xp/8));
    assert.ok(ended.presentation?.impactDelay>0);
  }catch(error){
    error.message+=`\nServer output:\n${serverOutput.slice(-5000)}`;
    throw error;
  }finally{
    for(const client of new Set(clients))try{client.close();}catch{}
    if(child.exitCode==null)child.kill('SIGTERM');
    await new Promise(resolve=>{if(child.exitCode!=null)resolve();else child.once('exit',resolve);});
    fs.rmSync(tempDir,{recursive:true,force:true});
  }
});
