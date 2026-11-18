import {readFileSync} from 'node:fs';
import {after, before, test} from 'node:test';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, collection, query, where, Timestamp, serverTimestamp, writeBatch} from 'firebase/firestore';
let env;
const school = (uid, verified = true) => env.authenticatedContext(uid,{
  email:`${uid}@triamudomsouth.ac.th`, email_verified:verified
}).firestore();
const product={name:'Book',price:20,cat:'books',desc:'Used',seller:'Seller',room:'6/3',line:'',image:null,uid:'seller',createdAt:Timestamp.now(),approved:true,moderationStatus:'approved'};
before(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-tus-market',firestore:{rules:readFileSync('firestore.rules','utf8')}});
  await env.withSecurityRulesDisabled(async c=>{
    await setDoc(doc(c.firestore(),'products','book'),product);
    await setDoc(doc(c.firestore(),'products','orders-book'),product);
    await setDoc(doc(c.firestore(),'products','privacy-book'),product);
    await setDoc(doc(c.firestore(),'messages','message'),{participantUids:['buyer','seller'],senderUid:'buyer',sellerUid:'seller',productId:'book',conversationId:'book_buyer_seller',text:'Hello'});
  });
});
after(async()=>{await env?.cleanup()});
test('chat participants can query their messages, outsiders cannot read all chats',async()=>{
  await assertSucceeds(getDocs(query(collection(school('buyer'),'messages'),where('participantUids','array-contains','buyer'))));
  await assertSucceeds(getDoc(doc(school('seller'),'messages','message')));
  await assertFails(getDocs(collection(school('outsider'),'messages')));
  await assertFails(getDoc(doc(school('outsider'),'messages','message')));
  await assertFails(getDoc(doc(school('buyer',false),'messages','message')));
  await assertFails(getDocs(collection(school('11076',false),'messages')));
  await assertFails(getDocs(query(collection(school('outsider'),'messages'),where('participantUids','array-contains','buyer'))));
  await assertSucceeds(getDocs(collection(school('11076'),'messages')));
});
test('owner edits require moderation; ownership and approval cannot be forged',async()=>{
  const ref=doc(school('seller'),'products','book');
  await assertFails(updateDoc(ref,{name:'Changed'}));
  await assertSucceeds(updateDoc(ref,{name:'Changed',approved:false,moderationStatus:'pending_manual'}));
  await assertSucceeds(updateDoc(ref,{desc:'Updated pending item'}));
  await assertFails(updateDoc(ref,{approved:true}));
  await assertFails(updateDoc(ref,{uid:'outsider'}));
  await assertFails(updateDoc(doc(school('outsider'),'products','book'),{name:'Hijacked',approved:false,moderationStatus:'pending_manual'}));
  await assertSucceeds(updateDoc(doc(school('11076'),'products','book'),{approved:true,moderationStatus:'approved'}));
});
test('buyer and seller can send messages with valid participants',async()=>{
  for(const uid of ['buyer','seller']){
    await assertSucceeds(setDoc(doc(school(uid),'messages',`reply-${uid}`),{
      participantUids:['buyer','seller'],senderUid:uid,senderEmail:`${uid}@triamudomsouth.ac.th`,senderName:uid,senderPhotoUrl:'',sellerUid:'seller',productId:'book',conversationId:'book_buyer_seller',text:'Hello',createdAt:serverTimestamp()
    }));
  }
});
test('deleting product preserves access to conversation history',async()=>{
  await assertSucceeds(deleteDoc(doc(school('seller'),'products','book')));
  await assertSucceeds(getDocs(query(collection(school('buyer'),'messages'),where('participantUids','array-contains','buyer'))));
});

const order = (uid, productId='orders-book') => ({
  productId, productName:product.name, price:product.price, buyerUid:uid,
  sellerUid:'seller', status:'pending', createdAt:serverTimestamp(), updatedAt:serverTimestamp()
});

function placeOrder(db, id, data) {
  const batch=writeBatch(db);
  batch.set(doc(db,'orders',id),data);
  batch.set(doc(db,'orderRequests',data.productId,'buyers',data.buyerUid),{orderId:id});
  return batch.commit();
}

function moveOrder(db, id, status, saleStatus) {
  const batch = writeBatch(db);
  batch.update(doc(db,'orders',id), {status, updatedAt:serverTimestamp()});
  if(saleStatus) {
    batch.update(doc(db,'products','orders-book'), {saleStatus, saleOrderId:saleStatus==='available'?null:id});
  }
  return batch.commit();
}

test('orders keep the listing price and are private to verified buyer and seller', async()=>{
  const buyer=school('buyer');
  const seller=school('seller');
  const ref=doc(buyer,'orders','private-request');
  const data=order('buyer','privacy-book');
  await assertFails(placeOrder(school('buyer',false),'unverified',data));
  await assertFails(placeOrder(seller,'self',order('seller','privacy-book')));
  await assertFails(placeOrder(buyer,'private-request',{...data,price:1}));
  await assertFails(placeOrder(buyer,'private-request',{...data,sellerUid:'outsider'}));
  await assertFails(placeOrder(buyer,'private-request',{...data,status:'accepted'}));
  await assertFails(setDoc(ref,data));
  await assertSucceeds(placeOrder(buyer,'private-request',data));
  await assertFails(placeOrder(buyer,'duplicate',data));
  await assertFails(getDoc(doc(seller,'orderRequests','privacy-book','buyers','buyer')));
  await assertSucceeds(getDocs(query(collection(buyer,'orders'),where('buyerUid','==','buyer'))));
  await assertSucceeds(getDocs(query(collection(seller,'orders'),where('sellerUid','==','seller'))));
  await assertFails(getDoc(doc(school('outsider'),'orders','private-request')));
  await assertFails(getDocs(query(collection(school('outsider'),'orders'),where('buyerUid','==','buyer'))));
  await assertFails(getDoc(doc(school('11076'),'orders','private-request')));
  await assertFails(updateDoc(ref,{price:1,status:'cancelled',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref,{status:'cancelled',updatedAt:serverTimestamp()}));
  await assertSucceeds(placeOrder(buyer,'replacement',data));
});

test('one reservation per listing, with atomic release and completion', async()=>{
  const buyer=school('buyer');
  const other=school('other');
  const seller=school('seller');
  const productRef=doc(seller,'products','orders-book');
  await assertSucceeds(placeOrder(buyer,'request-a',order('buyer')));
  await assertSucceeds(placeOrder(other,'request-b',order('other')));
  await assertFails(moveOrder(buyer,'request-a','accepted','reserved'));
  await assertFails(moveOrder(seller,'request-a','accepted'));
  await assertFails(updateDoc(productRef,{saleStatus:'reserved',saleOrderId:'request-a'}));
  await assertSucceeds(moveOrder(seller,'request-a','accepted','reserved'));
  await assertFails(moveOrder(seller,'request-b','accepted','reserved'));
  await assertFails(deleteDoc(productRef));
  await assertFails(moveOrder(buyer,'request-a','completed','sold'));
  await assertFails(moveOrder(buyer,'request-a','cancelled'));
  await assertSucceeds(moveOrder(buyer,'request-a','cancelled','available'));
  await assertSucceeds(moveOrder(seller,'request-b','accepted','reserved'));
  await assertSucceeds(moveOrder(seller,'request-b','completed','sold'));
  await assertFails(placeOrder(buyer,'request-c',order('buyer')));
  await assertFails(moveOrder(seller,'request-b','cancelled','available'));
  const snapshot=await assertSucceeds(getDoc(productRef));
  if(snapshot.data().saleStatus!=='sold')throw new Error('Completed order must leave listing sold');
});
