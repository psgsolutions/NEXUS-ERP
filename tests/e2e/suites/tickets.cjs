// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
require("@next/env").loadEnvConfig(E2E_ROOT);const admin=require("firebase-admin");admin.initializeApp({credential:admin.credential.cert({projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g,"\n")})});
const db=admin.firestore();const C="COM-NEXUS-01";const KEY=process.env.NEXT_PUBLIC_FIREBASE_API_KEY;let fails=0;const ok=(l,c,x="")=>{if(!c)fails++;console.log(`${c?"PASS":"FAIL"}  ${l} ${c?"":x}`)};
const tok=async(uid)=>(await(await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:await admin.auth().createCustomToken(uid),returnSecureToken:true})})).json()).idToken;
(async()=>{const s=Date.now();const U={sales:"test-tk-sales-"+s,tech:"test-tk-tech-"+s,hr:"test-tk-hr-"+s};
 await db.doc("users/"+U.sales).set({companyId:C,roles:["SALES"],role:"SALES",name:"TEST ขาย",status:"ACTIVE"});await db.doc("users/"+U.tech).set({companyId:C,roles:["TECHNICIAN"],role:"TECHNICIAN",name:"TEST ช่าง",status:"ACTIVE"});await db.doc("users/"+U.hr).set({companyId:C,roles:["HR"],role:"HR",status:"ACTIVE"});
 const mk=(t)=>(url,b)=>fetch(E2E_BASE + ""+url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({companyId:C,...b})}).then(async r=>({status:r.status,body:await r.json()}));
 const sales=mk(await tok(U.sales)),tech=mk(await tok(U.tech)),hr=mk(await tok(U.hr));
 const counters={};for(const id of ["TK","JOB"])counters[id]=(await db.doc(`companies/${C}/counters/${id}`).get()).data()||null;
 const portalRef=db.collection("service_tickets").doc();await portalRef.set({companyId:C,phoneNumber:"0899999999",symptom:"TEST แอร์ไม่เย็น",status:"NEW",source:"CUSTOMER_PORTAL"});
 let tk,tk2,job;
 try{
  const h=await hr("/api/service/tickets",{action:"list"});ok("HR cannot open service",h.status===403);
  const bad=await sales("/api/service/tickets",{action:"create",ticket:{symptom:""}});ok("symptom required",bad.status===400);
  const c=await sales("/api/service/tickets",{action:"create",ticket:{customerName:"TEST ลูกค้า",phone:"0811111111",symptom:"TEST กล้องภาพไม่ขึ้น",priority:"URGENT",category:"REPAIR"}});tk=c.body.ticketNo;
  const d=(await db.doc(`companies/${C}/service_tickets/${tk}`).get()).data();
  const slaH=(Date.parse(d.slaDueAt)-Date.now())/3600000;
  ok("create ticket with 4h SLA for urgent",c.status===200&&d.status==="NEW"&&slaH>3.9&&slaH<=4,JSON.stringify(c.body));
  const ls=await sales("/api/service/tickets",{action:"list"});ok("list shows ticket + portal request",ls.body.tickets.some(t=>t.ticketNo===tk)&&ls.body.portal.some(p=>p.id==="legacy:"+portalRef.id));
  const pc=await sales("/api/service/tickets",{action:"create",ticket:{phone:"0899999999",symptom:"TEST แอร์ไม่เย็น"},portalId:"legacy:"+portalRef.id});tk2=pc.body.ticketNo;
  const pc2=await sales("/api/service/tickets",{action:"create",ticket:{phone:"0899999999",symptom:"x"},portalId:"legacy:"+portalRef.id});
  ok("accept portal request once",pc.status===200&&(await portalRef.get()).data().ticketNo===tk2&&pc2.status===409,JSON.stringify([pc.body,pc2.body]));
  const sn=await sales("/api/service/tickets",{action:"lookupSerial",serial:"NO-SUCH-SN"});ok("serial lookup not found",sn.status===200&&sn.body.found===false);
  const tj=await sales("/api/service/tickets",{action:"toJob",ticketNo:tk,assignees:[U.tech],scheduledDate:"2026-10-20"});job=tj.body.jobNo;
  const jd=(await db.doc(`companies/${C}/jobs/${job}`).get()).data();const d2=(await db.doc(`companies/${C}/service_tickets/${tk}`).get()).data();
  ok("send to technician creates linked job",tj.status===200&&jd.links.ticketId===tk&&jd.status==="ASSIGNED"&&jd.type==="SERVICE"&&d2.status==="SCHEDULED",JSON.stringify(tj.body));
  await tech("/api/jobs",{action:"accept",jobNo:job});
  ok("technician accept -> ticket IN_PROGRESS",(await db.doc(`companies/${C}/service_tickets/${tk}`).get()).data().status==="IN_PROGRESS");
  await tech("/api/jobs",{action:"start",jobNo:job});const cp=await tech("/api/jobs",{action:"complete",jobNo:job,note:"เปลี่ยนสายแล้ว"});
  ok("job complete -> ticket RESOLVED",cp.status===200&&(await db.doc(`companies/${C}/service_tickets/${tk}`).get()).data().status==="RESOLVED",JSON.stringify(cp.body));
  const cl=await sales("/api/service/tickets",{action:"close",ticketNo:tk});ok("close ticket",cl.status===200&&cl.body.status==="CLOSED");
  const nt=await sales("/api/service/tickets",{action:"note",ticketNo:tk,note:"โทรสอบถามความพึงพอใจแล้ว"});ok("add follow-up note",nt.status===200);
  const cx=await sales("/api/service/tickets",{action:"cancel",ticketNo:tk2,note:"x"});ok("cancel needs reason",cx.status===400);
  const cx2=await sales("/api/service/tickets",{action:"cancel",ticketNo:tk2,note:"ลูกค้าแก้ไขเองได้"});ok("cancel ticket",cx2.status===200&&cx2.body.status==="CANCELLED");
 }catch(e){fails++;console.log("ERROR",e)}finally{
  for(const t of [tk,tk2].filter(Boolean))await db.doc(`companies/${C}/service_tickets/${t}`).delete();
  if(job){await db.doc(`companies/${C}/jobs/${job}`).delete();}
  const nq=await db.collection(`companies/${C}/notifications`).where("documentNo","==",job||"none").get();for(const d of nq.docs)await d.ref.delete();
  await portalRef.delete();
  for(const id of Object.keys(counters))counters[id]?await db.doc(`companies/${C}/counters/${id}`).set(counters[id]):await db.doc(`companies/${C}/counters/${id}`).delete();
  for(const u of Object.values(U)){await db.doc("users/"+u).delete();await admin.auth().deleteUser(u).catch(()=>{})}
  console.log(fails?fails+" FAILED":"ALL PASS");process.exit(0)}})();
