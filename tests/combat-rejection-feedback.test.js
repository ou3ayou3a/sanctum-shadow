const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../site/combat.js'),'utf8');
const functions=source.slice(source.indexOf('function reportCombatRejection('),source.indexOf('function combatMove('));
test('rejected combat commands explain failure visibly without accepting or committing costs',()=>{
  for(const method of ['acceptSoloCommand','resolveSoloCommand']){
    const logs=[],toasts=[],state={apRemaining:3};const root={combatState:state,gameState:{character:{}},addLog:message=>logs.push(message),window:{__world3d:{toast:message=>toasts.push(message)},ActionPipeline:{command:()=>({}),prepare:()=>({ok:false,reason:'out_of_range'}),resolve:()=>({ok:false,reason:'out_of_range'}),accept:()=>assert.fail('accepted rejected command'),commit:()=>assert.fail('committed rejected command')}}};
    vm.runInNewContext(functions,root);root[method]('spell');assert.match(toasts[0],/Move closer/);assert.match(logs[0],/out_of_range/);assert.equal(state.apRemaining,3);
  }
});
test('rejection feedback remains safe without a 3D world and explains unmapped reasons',()=>{const root={addLog(){},window:{}};vm.runInNewContext(functions,root);assert.doesNotThrow(()=>root.reportCombatRejection('no_target'));let message;root.window.__world3d={toast:text=>message=text};root.reportCombatRejection('no_target');assert.equal(message,'Action unavailable: no target.');});
