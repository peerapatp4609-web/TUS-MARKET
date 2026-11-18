import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync('public/app.html','utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^\s*import .*?;$/gm,'');
function harness(){
  const elements=new Map();
  const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',disabled:false,classList:{add(){},remove(){}},querySelectorAll(){return []},querySelector(){return el(id+'Button')}});return elements.get(id)};
  const ctx=vm.createContext({document:{getElementById:el,querySelectorAll:()=>[]},console,initializeApp:()=>({}),getFirestore:()=>({}),getAuth:()=>({}),GoogleAuthProvider:class{},collection:()=>({}),onAuthStateChanged:()=>{},query:()=>({}),where:()=>({}),onSnapshot:()=>()=>{},localStorage:{getItem:()=>null,setItem(){}},setTimeout,clearTimeout});
  vm.runInContext(source,ctx);
  vm.runInContext("user={uid:'buyer',email:'buyer@triamudomsouth.ac.th'}",ctx);
  return {ctx,el};
}
test('deleted products remain in inbox and open read-only history',async()=>{
  const {ctx,el}=harness();
  const button={dataset:{id:'deleted',cid:'conversation',part:'["seller","buyer"]'}};
  el('threads').querySelectorAll=()=>[button];
  ctx.onSnapshot=(_q,cb)=>{ctx.snapshot=cb;return ()=>{}};
  ctx.getDoc=async()=>({exists:()=>false});ctx.doc=()=>({});
  vm.runInContext('loadInbox()',ctx);
  await ctx.snapshot({docs:[{id:'m',data:()=>({productId:'deleted',sellerUid:'seller',participantUids:['seller','buyer'],conversationId:'conversation',text:'Hello',createdAt:{seconds:1}})}]});
  assert.match(el('threads').innerHTML,/สินค้าไม่พร้อมจำหน่าย/);
  vm.runInContext('loadMessages=()=>{};markRead=()=>{}',ctx);
  button.onclick();
  assert.equal(el('chatInput').disabled,true);
  assert.equal(vm.runInContext('chatConversation',ctx),'conversation');
});
test('seller can open an existing conversation and normal products allow sending',()=>{
  const {ctx,el}=harness();
  vm.runInContext("user={uid:'seller'};loadMessages=()=>{};markRead=()=>{};startChat({id:'p',uid:'seller',name:'Book',price:20,seller:'Seller'},['seller','buyer'],'existing')",ctx);
  assert.equal(vm.runInContext('chatConversation',ctx),'existing');
  assert.equal(el('chatInput').disabled,false);
});

test('checkout uses current listing data and releases the submit button on a price change',async()=>{
  const {ctx,el}=harness();
  const writes=[];
  let price=25;
  ctx.confirm=()=>true;
  ctx.doc=(_collection,id)=>id||'new-order';
  ctx.serverTimestamp=()=>'<server time>';
  ctx.runTransaction=async (_db,run)=>run({
    get:async ()=>({data:()=>({uid:'seller',approved:true,name:'Book',price})}),
    set:(id,record)=>writes.push([id,record])
  });
  await vm.runInContext("placeOrder({id:'book',name:'Book',price:20},$('buyItem'))",ctx);
  assert.equal(writes.length,0);
  assert.equal(el('buyItem').disabled,false);
  assert.match(el('toast').textContent,/ข้อมูลสินค้าเปลี่ยน/);
  price=20;
  await vm.runInContext("placeOrder({id:'book',name:'Book',price:20},$('buyItem'))",ctx);
  assert.equal(writes.length,1);
  assert.equal(writes[0][1].buyerUid,'buyer');
  assert.equal(writes[0][1].sellerUid,'seller');
  assert.equal(writes[0][1].price,20);
  assert.equal(writes[0][1].status,'pending');
  assert.equal(el('buyItem').disabled,false);
  clearTimeout(vm.runInContext('showToast.timer',ctx));
});
