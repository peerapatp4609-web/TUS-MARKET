from pathlib import Path

path = Path('public/app.html')
text = path.read_text(encoding='utf-8')

# Ensure elements using the HTML hidden attribute are actually hidden.
if '[hidden]{display:none!important}' not in text:
    text = text.replace('*{box-sizing:border-box} body{', '*{box-sizing:border-box} [hidden]{display:none!important} body{', 1)

# When opening a conversation from the inbox, the product belongs to the
# current user (the seller). Do not treat that as opening a chat with self;
# the participant list identifies the actual other party.
old_start = "function startChat(p,existingParticipants=null,existingId=null){if(!user){showToast('กรุณาเข้าสู่ระบบก่อน');return}if(p.uid===user.uid){showToast('เปิดกล่องแชทเพื่อดูคนที่ติดต่อคุณ');return}"
new_start = "function startChat(p,existingParticipants=null,existingId=null){if(!user){showToast('กรุณาเข้าสู่ระบบก่อน');return}const hasConversationParticipants=Array.isArray(existingParticipants)&&existingParticipants.length===2&&existingParticipants[0]!==existingParticipants[1]&&existingParticipants.includes(user.uid);if(p.uid===user.uid&&!hasConversationParticipants){showToast('เปิดกล่องแชทเพื่อดูคนที่ติดต่อคุณ');return}"
if old_start not in text:
    raise SystemExit('Could not locate startChat guard')
text = text.replace(old_start, new_start, 1)

start = text.find('  function loadInbox(){')
end = text.find("  $('inboxBtn').onclick=", start)
if start < 0 or end < 0:
    raise SystemExit('Could not locate loadInbox boundaries')

replacement = '''  function loadInbox(){
    if(!user)return;
    if(inboxUnsub)inboxUnsub();
    $('threads').innerHTML='<div class="empty">กำลังโหลด...</div>';
    const q=query(MESSAGES,where('participantUids','array-contains',user.uid));
    inboxUnsub=onSnapshot(q,async snap=>{
      const by=new Map();
      for(const d of snap.docs){
        const m={id:d.id,...d.data()};
        const key=m.conversationId;
        const old=by.get(key)||{latest:null,participants:new Set()};
        const list=Array.isArray(m.participantUids)?m.participantUids:[];
        for(const uid of list)if(typeof uid==='string'&&uid)old.participants.add(uid);
        if(typeof m.sellerUid==='string'&&m.sellerUid)old.participants.add(m.sellerUid);
        if(!old.latest||(m.createdAt?.seconds||0)>(old.latest.createdAt?.seconds||0))old.latest=m;
        by.set(key,old);
      }
      const out=[];
      for(const group of by.values()){
        const latest=group.latest;
        if(!latest)continue;
        let p=products.find(x=>x.id===latest.productId);
        if(!p){
          try{
            const s=await getDoc(doc(db,'products',latest.productId));
            p=s.exists()?{id:s.id,...s.data()}:null;
          }catch{p=null}
        }
        if(!p)continue;
        let part=[...group.participants];
        if(part.length!==2&&latest.sellerUid&&latest.sellerUid!==user.uid)part=[latest.sellerUid,user.uid];
        out.push({latest,p,participants:part});
      }
      out.sort((a,b)=>(b.latest.createdAt?.seconds||0)-(a.latest.createdAt?.seconds||0));
      $('threads').innerHTML=out.length?out.map(({latest,p,participants})=>{
        const av=latest.senderPhotoUrl?`<img class="thread-avatar" src="${esc(latest.senderPhotoUrl)}" alt="">`:'<span class="thread-avatar">👤</span>';
        return `<div class="thread">${av}<div class="thread-main"><strong>${esc(latest.senderName||latest.senderEmail||'ผู้ใช้โรงเรียน')}</strong><span class="muted">${esc(p.name)} · ${esc(latest.text)}</span></div><button class="btn secondary open-thread" data-id="${esc(p.id)}" data-cid="${esc(latest.conversationId)}" data-part="${esc(JSON.stringify(participants))}">เปิด</button></div>`;
      }).join(''):'<div class="empty">ยังไม่มีบทสนทนา</div>';
      for(const b of $('threads').querySelectorAll('.open-thread')){
        b.onclick=()=>{
          let part=[];try{part=JSON.parse(b.dataset.part||'[]')}catch{part=[]}
          const p=products.find(x=>x.id===b.dataset.id);
          if(!p)return;
          if(part.length!==2||part[0]===part[1]||!part.includes(user.uid)){showToast('บทสนทนานี้ไม่มีข้อมูลผู้ร่วมแชตครบ จึงยังเปิดไม่ได้');return}
          startChat(p,part,b.dataset.cid);
        };
      }
    },e=>{$('threads').innerHTML=`<div class="empty">โหลดกล่องแชตไม่ได้: ${esc(e.code||e.message)}</div>`});
  }
'''
text = text[:start] + replacement + text[end:]
path.write_text(text, encoding='utf-8')
