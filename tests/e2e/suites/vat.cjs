// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
require("@next/env").loadEnvConfig(E2E_ROOT);
const admin=require("firebase-admin");admin.initializeApp({credential:admin.credential.cert({projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g,"\n")})});
const db=admin.firestore();const C="COM-NEXUS-01";const KEY=process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
let fails=0;const ok=(l,c,x="")=>{if(!c)fails++;console.log(`${c?"PASS":"FAIL"}  ${l} ${c?"":x}`)};
const tok=async(uid)=>(await(await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:await admin.auth().createCustomToken(uid),returnSecureToken:true})})).json()).idToken;
const P=(c,id)=>db.doc(`companies/${C}/${c}/${id}`);
const docs=[
 ["invoices","TEST-VI-1",{issueDate:"2020-01-10",invoiceNo:"TEST-INV-1",customerSnapshot:{name:"TEST ลูกค้า",taxId:"0105555000001",branch:"00000"},subTotal:10000,vatAmount:700,status:"issued"}],
 ["invoices","TEST-VI-2",{issueDate:"2020-01-12",invoiceNo:"TEST-INV-2",customerSnapshot:{name:"X"},subTotal:5000,vatAmount:350,status:"cancelled"}],
 ["cndn","TEST-VC-1",{type:"CN",issueDate:"2020-01-15",cndnNo:"TEST-CN-1",invoiceNo:"TEST-INV-1",customerSnapshot:{name:"TEST ลูกค้า"},amount:1000,vatAmount:70,status:"issued"}],
 ["expenses","TEST-VE-1",{supplierTaxInvoiceNo:"TEST-TAX-9",supplierTaxInvoiceDate:"2020-01-08",supplierName:"TEST ผู้ขาย",supplierTaxId:"0105555000002",subTotal:4000,vatAmount:280,totalAmount:4280,status:"Unpaid"}],
 ["expenses","TEST-VE-2",{expenseId:"TEST-EXP-2",supplierName:"TEST ผู้ขาย 2",subTotal:2000,vatAmount:140,totalAmount:2140,status:"Paid"}],
 ["payments","TEST-VP-1",{paymentNo:"TEST-PV-1",paymentDate:"2020-01-20",payeeName:"TEST ผู้ขาย 2",lines:[{expenseDocId:"TEST-VE-2",expenseNo:"TEST-EXP-2",preVat:2000,vat:140},{expenseDocId:"TEST-VE-1",expenseNo:"X",preVat:4000,vat:280}],status:"posted"}],
];
(async()=>{const uid="test-vat-"+Date.now();await db.doc("users/"+uid).set({companyId:C,roles:["ACCOUNTANT"],role:"ACCOUNTANT",status:"ACTIVE"});
 for(const [c,id,d] of docs) await P(c,id).set({companyId:C,isTest:true,...d});
 const t=await tok(uid);const call=(b)=>fetch(E2E_BASE + "/api/reports/financial",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({companyId:C,...b})}).then(r=>r.json());
 try{
  const o=await call({report:"vat-out",to:"2020-01"});
  ok("output VAT: invoice + CN (cancelled excluded)",o.rows.length===2&&o.totals.vat===630&&o.totals.base===9000,JSON.stringify(o.totals));
  ok("CN is negative",o.rows.find(r=>r.kind==="ใบลดหนี้")?.vat===-70);
  ok("head office branch label",o.rows[0].branch==="สำนักงานใหญ่");
  const i=await call({report:"vat-in",to:"2020-01"});
  ok("input VAT: tax invoice + payment-time (no double count)",i.rows.length===2&&i.totals.vat===420,JSON.stringify(i.rows.map(r=>[r.kind,r.vat])));
  ok("reconciliation fields present",typeof i.ledgerVat==="number"&&typeof i.difference==="number");
 }finally{for(const [c,id] of docs) await P(c,id).delete();await db.doc("users/"+uid).delete();await admin.auth().deleteUser(uid).catch(()=>{});console.log(fails?fails+" FAILED":"ALL PASS");process.exit(0);}})();
