import {readFileSync} from 'node:fs';
import {after, before, test} from 'node:test';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, collection, query, where, Timestamp} from 'firebase/firestore';
let env;
const school = uid => env.authenticatedContext(uid,{email:`${uid}@triamudomsouth.ac.th`}).firestore();
const product={name:'Book',price:20,cat:'books',desc:'Used',seller:'Seller',room:'6/3',line:'',image:null,uid:'seller',createdAt:Timestamp.now(),approved:true,moderationStatus:'approved'};
before(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-tus-market',firestore:{rules:readFileSync('firestore.rules','utf8')}});
  await env.withSecurityRulesDisabled(async c=>{
    await setDoc(doc(c.firestore(),'products','book'),product);
    await setDoc(doc(c.firestore(),'messages','message'),{participantUids:['buyer','seller'],senderUid:'buyer',sellerUid:'seller',productId:'book',conversationId:'book_buyer_seller',text:'Hello'});
  });
});
after(async()=>{await env?.cleanup()});
test('chat participants can query their messages, outsiders cannot read all chats',async()=>{
  await assertSucceeds(getDocs(query(collection(school('buyer'),'messages'),where('participantUids','array-contains','buyer'))));
  await assertSucceeds(getDoc(doc(school('seller'),'messages','message')));
  await assertFails(getDocs(collection(school('outsider'),'messages')));
  await assertFails(getDoc(doc(school('outsider'),'messages','message')));
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
      participantUids:['buyer','seller'],senderUid:uid,senderEmail:`${uid}@triamudomsouth.ac.th`,senderName:uid,senderPhotoUrl:'',sellerUid:'seller',productId:'book',conversationId:'book_buyer_seller',text:'Hello',createdAt:Timestamp.now()
    }));
  }
});
test('deleting product preserves access to conversation history',async()=>{
  await assertSucceeds(deleteDoc(doc(school('seller'),'products','book')));
  await assertSucceeds(getDocs(query(collection(school('buyer'),'messages'),where('participantUids','array-contains','buyer'))));
});
