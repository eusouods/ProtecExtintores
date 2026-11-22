import assert from 'node:assert/strict';
import {applyOperation} from '../site/offline-rules.mjs';
// Peças só podem ser registradas enquanto houver estoque; o saldo cai a cada peça e volta ao remover.
const actor={role:'employee',id:'employee-test',username:'tecnico',name:'Técnico'},at='2026-11-18T12:00:00Z';
const state={settings:{stages:['Recebido']},types:[],costCatalog:[],inventory:[{name:'Manômetro',qty:2}],
 services:[{id:'service-0001',code:'FS-1',employeeId:actor.id,items:[{type:'ABC',kg:'6'},{type:'ABC',kg:'6'},{type:'ABC',kg:'6'}],history:[]}]};
let n=0;const technical=(itemIndex,parts)=>({id:'operation-'+(++n),deviceId:'device-test',serviceId:'service-0001',kind:'technical',payload:{itemIndex,parts},createdAt:at});
applyOperation(state,actor,technical(0,['Manômetro']),at);
applyOperation(state,actor,technical(1,['Manômetro']),at);
assert.equal(state.inventory[0].qty,0);
assert.throws(()=>applyOperation(state,actor,technical(2,['Manômetro']),at),/Sem estoque de Manômetro/);
assert.deepEqual(state.services[0].items[2].replacedParts||[],[]);
applyOperation(state,actor,technical(0,[]),at);
assert.equal(state.inventory[0].qty,1);
applyOperation(state,actor,technical(2,['Manômetro']),at);
assert.equal(state.inventory[0].qty,0);
// peça sem linha de estoque continua permitida (estoque não controlado)
applyOperation(state,actor,technical(0,['Sifão']),at);
console.log('Estoque de peças: bloqueio sem saldo, baixa e devolução ao trocar verificados.');
