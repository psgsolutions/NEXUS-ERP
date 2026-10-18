// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
require("@next/env").loadEnvConfig(E2E_ROOT);const admin=require("firebase-admin");admin.initializeApp({credential:admin.credential.cert({projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g,"\n")})});
const db=admin.firestore();const C="COM-NEXUS-01";const KEY=process.env.NEXT_PUBLIC_FIREBASE_API_KEY;let fails=0;const ok=(l,c,x="")=>{if(!c)fails++;console.log(`${c?"PASS":"FAIL"}  ${l} ${c?"":x}`)};
const tok=async(uid)=>(await(await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:await admin.auth().createCustomToken(uid),returnSecureToken:true})})).json()).idToken;
(async()=>{const s=Date.now();const U={sales:"test-pos-s-"+s,acct:"test-pos-a-"+s};
 await db.doc("users/"+U.sales).set({companyId:C,roles:["SALES"],role:"SALES",status:"ACTIVE"});await db.doc("users/"+U.acct).set({companyId:C,roles:["ACCOUNTANT"],role:"ACCOUNTANT",status:"ACTIVE"});
 const mk=(t)=>(b)=>fetch(E2E_BASE + "/api/pos/checkout",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({companyId:C,...b})}).then(async r=>({status:r.status,body:await r.json()}));
 const sales=mk(await tok(U.sales)),acct=mk(await tok(U.acct));
 const counters={};for(const id of ["POS","INV"])counters[id]=(await db.doc(`companies/${C}/counters/${id}`).get()).data()||null;
 const prod=db.doc("products/TEST-POS-PROD-"+s);await prod.set({companyId:C,name:"TEST น้ำดื่ม",sku:"TEST-POS",unit:"ขวด",itemType:"PRODUCT",pricing:{pricePOS:100,costWAC:60},costPrice:60,stockStatus:{onHand:10,reserved:0,available:10}});
 const txs=[];
 try{
  const a=await acct({items:[{id:prod.id,qty:1}],paymentMethod:"CASH",cashReceived:200});ok("ACCOUNTANT cannot sell",a.status===403);
  const c=await sales({items:[{id:prod.id,qty:2}],paymentMethod:"CASH",cashReceived:500,discount:10,paymentRef:""});if(c.body.transactionNo)txs.push(c.body.transactionNo);
  ok("cash: 200 - 10 = 190 + VAT 13.30 = 203.30, change 296.70",c.status===200&&c.body.netBeforeVat===190&&c.body.vatAmount===13.3&&c.body.grandTotal===203.3&&c.body.change===296.7,JSON.stringify(c.body).slice(0,200));
  ok("stock 10 -> 8",(await prod.get()).data().stockStatus.onHand===8);
  const tx=(await db.doc(`companies/${C}/sales_transactions/${c.body.transactionNo}`).get()).data();
  const j=(await db.collection(`companies/${C}/journal_entries`).where("reference","==",c.body.transactionNo).get()).docs.map(d=>d.data()).find(x=>x.items.some(i=>i.accountCode==="4111-00"));
  ok("bill + journal record discount (revenue 190)",tx.discount===10&&j&&j.items.find(i=>i.accountCode==="4111-00").credit===190,JSON.stringify(j&&j.items));
  const low=await sales({items:[{id:prod.id,qty:1}],paymentMethod:"CASH",cashReceived:10});ok("cash short rejected",low.status===500&&/ไม่พอ/.test(low.body.error),JSON.stringify(low.body));
  const pp=await sales({items:[{id:prod.id,qty:1}],paymentMethod:"PROMPTPAY",paymentRef:"SLIP123",customer:{name:"TEST บริษัท",taxId:"0105555000001"}});if(pp.body.transactionNo)txs.push(pp.body.transactionNo);
  ok("PromptPay with full tax-invoice customer",pp.status===200&&pp.body.paymentMethod==="PROMPTPAY"&&pp.body.customer?.taxId==="0105555000001"&&pp.body.change===0,JSON.stringify(pp.body).slice(0,200));
  const ppj=(await db.collection(`companies/${C}/journal_entries`).where("reference","==",pp.body.transactionNo).get()).docs.map(d=>d.data()).find(x=>x.items.some(i=>i.accountCode==="4111-00"));
  ok("PromptPay posts to bank 1112-00",ppj&&ppj.items[0].accountCode==="1112-00");
  const over=await sales({items:[{id:prod.id,qty:50}],paymentMethod:"CARD"});ok("over-stock rejected",over.status===500&&/สต็อก/.test(over.body.error),JSON.stringify(over.body));
 }catch(e){fails++;console.log("ERROR",e)}finally{
  for(const n of txs){await db.doc(`companies/${C}/sales_transactions/${n}`).delete();for(const c of ["stock_movements","journal_entries"]){const q=await db.collection(`companies/${C}/${c}`).where(c==="stock_movements"?"referenceId":"reference","==",n).get();for(const d of q.docs)await d.ref.delete()}}
  await prod.delete();for(const id of Object.keys(counters))counters[id]?await db.doc(`companies/${C}/counters/${id}`).set(counters[id]):await db.doc(`companies/${C}/counters/${id}`).delete();
  for(const u of Object.values(U)){await db.doc("users/"+u).delete();await admin.auth().deleteUser(u).catch(()=>{})}
  console.log(fails?fails+" FAILED":"ALL PASS");process.exit(0)}})();
