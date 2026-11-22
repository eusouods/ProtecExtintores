import assert from 'node:assert/strict';
import {applyOperation,stageFlow} from '../site/offline-rules.mjs';
// Opções de avanço de etapa do funcionário (Configurações do admin).
const actor={role:'employee',id:'employee-test',username:'tecnico',name:'Técnico'},at='2026-11-18T12:00:00Z';
const stages=['Solicitado','Recebido','Em manutenção','Pintando','Inspeção final','Concluído'];
const make=(flow,status='Recebido')=>({settings:{stages,stageFlow:flow,teamPricing:{}},types:[],costCatalog:[],inventory:[],services:[{id:'service-0001',code:'FS-1',employeeId:actor.id,status,items:[{type:'ABC',kg:'6',status}],history:[]}]});
let n=0;const op=(kind,payload={})=>({id:'operation-'+(++n),deviceId:'device-test',serviceId:'service-0001',kind,payload,createdAt:at});
const padrao=stageFlow({stages});
assert.deepEqual(padrao.employeeStages,['Recebido','Em manutenção','Pintando','Inspeção final']);
assert.equal(padrao.completeAt,'Inspeção final');assert.equal(padrao.requireCompleteStage,true);assert.equal(padrao.allowSkip,true);
// padrão: pode pular etapas, mas só conclui na última
let s=make(null);
assert.throws(()=>applyOperation(s,actor,op('complete'),at),/atualize a etapa até “Inspeção final”/);
applyOperation(s,actor,op('stage',{status:'Inspeção final'}),at);
assert.equal(s.services[0].status,'Inspeção final');
// sem pular: uma etapa por vez
s=make({allowSkip:false});
assert.throws(()=>applyOperation(s,actor,op('stage',{status:'Inspeção final'}),at),/uma etapa por vez/);
applyOperation(s,actor,op('stage',{status:'Em manutenção'}),at);
applyOperation(s,actor,op('stage',{status:'Pintando'}),at);
// o admin pode limitar as etapas do funcionário e escolher onde concluir
s=make({employeeStages:['Recebido','Em manutenção','Inspeção final'],completeAt:'Em manutenção'});
assert.throws(()=>applyOperation(s,actor,op('stage',{status:'Pintando'}),at),/Etapa inválida/);
assert.throws(()=>applyOperation(s,actor,op('complete'),at),/atualize a etapa até “Em manutenção”/);
applyOperation(s,actor,op('stage',{status:'Em manutenção'}),at);
assert.doesNotThrow(()=>{try{applyOperation(s,actor,op('complete'),at)}catch(e){if(/etapa até/.test(e.message))throw e}});
// concluir sem exigir etapa final
s=make({requireCompleteStage:false});
assert.doesNotThrow(()=>{try{applyOperation(s,actor,op('complete'),at)}catch(e){if(/etapa até/.test(e.message))throw e}});
console.log('Opções de etapa: avanço livre ou uma por vez, etapas permitidas e etapa mínima para concluir verificados.');
