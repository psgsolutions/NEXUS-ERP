// [E2E] ชุดทดสอบกับฐานข้อมูลจริงผ่าน dev server — รันด้วย npm run test:e2e (คืนตัวนับเลขเอกสารให้อัตโนมัติ)
const E2E_ROOT = require("path").resolve(__dirname, "../../..");
const E2E_OUT = require("path").join(__dirname, "..", ".out"); require("fs").mkdirSync(E2E_OUT, { recursive: true });
const E2E_BASE = process.env.E2E_BASE || "http://localhost:3000";
require("@next/env").loadEnvConfig(E2E_ROOT);const admin=require("firebase-admin");admin.initializeApp({credential:admin.credential.cert({projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g,"\n")})});
const db=admin.firestore();const C="COM-NEXUS-01";const KEY=process.env.NEXT_PUBLIC_FIREBASE_API_KEY;let fails=0;const ok=(l,c,x="")=>{if(!c)fails++;console.log(`${c?"PASS":"FAIL"}  ${l} ${c?"":x}`)};
const tok=async(uid)=>(await(await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:await admin.auth().createCustomToken(uid),returnSecureToken:true})})).json()).idToken;
(async()=>{const s=Date.now();const wuid="test-wh-"+s,suid="test-whs-"+s;
 await db.doc("users/"+wuid).set({companyId:C,roles:["WAREHOUSE"],role:"WAREHOUSE",status:"ACTIVE"});await db.doc("users/"+suid).set({companyId:C,roles:["SALES"],role:"SALES",status:"ACTIVE"});
 const mk=(t)=>(b)=>fetch(E2E_BASE + "/api/inventory/warehouses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({companyId:C,...b})}).then(async r=>({status:r.status,body:await r.json()}));
 const call=mk(await tok(wuid)),callS=mk(await tok(suid));const code="TW"+String(s).slice(-4);const id=`group:${code}`;const balId=`${code}-A-R01-L1-B02_TESTPROD`;
 try{
  for(let i=0;i<20;i++){try{const r=await fetch(E2E_BASE + "/api/health");if(r.ok)break}catch{}await new Promise(r=>setTimeout(r,3000))}
  const c=await call({action:"create",code,name:"TEST คลัง"});ok("create warehouse",c.status===200&&c.body.id===id,JSON.stringify(c.body));
  const d=await call({action:"create",code,name:"x"});ok("duplicate warehouse blocked",d.status===409);
  const sc=await callS({action:"create",code:"ZZ1",name:"x"});ok("SALES cannot create warehouse",sc.status===403);
  const bad=await call({action:"saveLayout",warehouseId:id,zones:[{code:"A@!",racks:[]}]});ok("invalid zone code rejected",bad.status===400,JSON.stringify(bad.body));
  const dupR=await call({action:"saveLayout",warehouseId:id,zones:[{code:"A",racks:[{code:"R01",levels:2,bins:2},{code:"R01",levels:1,bins:1}]}]});ok("duplicate rack rejected",dupR.status===400);
  const sv=await call({action:"saveLayout",warehouseId:id,zones:[{code:"A",name:"โซนอะไหล่",racks:[{code:"R01",levels:4,bins:3},{code:"R02",levels:2,bins:1}]},{code:"B",racks:[{code:"R01",levels:1,bins:5}]}]});
  ok("save layout: 4*3 + 2*1 + 1*5 = 19 locations",sv.status===200&&sv.body.locations===20,JSON.stringify(sv.body));
  const ls=await callS({action:"list"});const locs=ls.body.locations.filter(l=>l.warehouseCode===code).map(l=>l.code);
  ok("list includes bin codes + receiving",locs.includes(`${code}-A-R01-L4-B03`)&&locs.includes(`${code}-A-R02-L2`)&&locs.includes(`${code}-RECV`)&&!locs.includes(`${code}-A-R02-L2-B01`),locs.slice(0,6).join(","));
  await db.doc(`companies/${C}/inventory_balance/${balId}`).set({companyId:C,location:`${code}-A-R01-L1-B02`,productId:"TESTPROD",quantity:5});
  const rm=await call({action:"saveLayout",warehouseId:id,zones:[{code:"A",racks:[{code:"R01",levels:4,bins:1}]}]});ok("cannot remove bin holding stock",rm.status===409&&/R01-L1-B02/.test(rm.body.error),JSON.stringify(rm.body));
  const ls2=await call({action:"list"});ok("stock reported per location",ls2.body.stock[`${code}-A-R01-L1-B02`]?.qty===5);
 }finally{await db.doc(`groups/${C}/warehouses/${code}`).delete();await db.doc(`warehouses/${C}_${code}`).delete();await db.doc(`companies/${C}/inventory_balance/${balId}`).delete();for(const u of [wuid,suid]){await db.doc("users/"+u).delete();await admin.auth().deleteUser(u).catch(()=>{})}console.log(fails?fails+" FAILED":"ALL PASS");process.exit(0)}})();
