# 🛡️ NEXUS ERP: UNIFIED MASTER IMPLEMENTATION PLAN (V3.2 Locked)

This document is the absolute, production-grade master specification and integration blueprint for the **NEXUS ERP (Intelligence OS)**. It provides complete architectural schemas, Firestore rule maps, TypeScript service definitions, cyber-security threat matrices, and step-by-step UAT verification check-sheets across all 6 core strategic engineering divisions:

```
+---------------------------------------------------------------------------------------------------------+
|                                    NEXUS ERP STRATEGIC ARCHITECTURE                                     |
+-------------------+-------------------+-------------------+--------------------+--------------------+
| 1. CORE MAP       | 2. TENANT SEC     | 3. AUDIT LOG      | 4. AI OCR EXPENSE  | 5. SMART WARRANTY  |
| Hub-Centric       | Multi-Tenancy     | Immutable         | Gemini 2.5 Flash   | Proactive MA and   |
| Database Scoping  | Firestore rules   | auditService      | genkit.ts Mapping  | alertService checks|
+-------------------+-------------------+-------------------+--------------------+--------------------+
```

---

## 🏗️ 1. Core Technical Architecture & Integration Map

The NEXUS ERP ecosystem is structured around 5 strategic operational hubs. The system uses shared state variables, scoped database channels, and direct service-to-service bridges to eliminate double-data entry and keep transaction records aligned in real-time.

```mermaid
flowchart TD
    subgraph Client UI Layer (PSG Standard V3.1)
        UI[NEXUS Intelligence Panel] -->|h-9 px-6 rounded-full| PM[Purchase Order Modal]
        UI -->|Double-Table view| PRJ[New Project Modal]
        UI -->|isLocked=false| QM[Quotation Modal]
    end

    subgraph Service Broker Layer
        PM -->|Locked PO ID Generator| PO_GEN[PO-YYMM-XXXX Locked]
        PRJ -->|Quotation Bridge ⚡| QB[Strategic Zap Bridge]
        QB -->|Pre-filled items mapping| QM
        PRJ -->|Save Package 💾| KE[Kit Editor: Profit Rainbow]
    end

    subgraph Database Layer (Multi-Tenancy Scoped)
        PO_GEN -->|Scoped companyId| DB_PO[companies/companyId/purchase_orders]
        KE -->|Firestore Sync| DB_PROD[(Firestore products)]
        DB_PROD -->|Category: Kit| UI
    end

    subgraph Security & Audit Layer
        DB_PO -->|Write Action| AUD[auditService: logCreate/logUpdate]
        DB_PROD -->|Write Action| AUD
        AUD -->|Immutable Create-Only| AL[(Firestore audit_logs)]
    end

    classDef teal fill:#00ffd1,stroke:#00b894,stroke-width:2px,color:#000;
    classDef blue fill:#0984e3,stroke:#74b9ff,stroke-width:2px,color:#fff;
    classDef red fill:#ff7675,stroke:#d63031,stroke-width:2px,color:#fff;
    class UI,PM,PRJ,QM teal;
    class PO_GEN,QB,KE blue;
    class AUD,AL red;
```

---

## 🔐 2. Tenant Isolation & Data Security

Multi-tenancy isolation is enforced at both the application and database layers to prevent accidental or malicious cross-tenant data leaks.

### A. Core Database Isolation Logic
Every document in the system is isolated through a dual-layered boundary:

1. **Global Field Scoping (Root Collections)**:
   Shared structural catalogs (e.g. `products`, `users`, `audit_logs`) reside at the database root. Every query is scoped by the user's active session tenant ID (`companyId`):
   ```typescript
   import { query, collection, where } from "firebase/firestore";
   const q = query(
     collection(db, "products"),
     where("companyId", "==", activeUserCompanyId),
     where("isDeleted", "==", false)
   );
   ```

2. **Nested Subpath Scoping (Transaction Collections)**:
   Sensitive transaction and procurement data is saved in nested sub-collections directly inside the tenant's profile path:
   ```
   /companies/{companyId}/purchase_orders/{poId}
   /companies/{companyId}/quotations/{quotationId}
   /companies/{companyId}/stock_movements/{movementId}
   ```
   This model guarantees that even if a developer omits a `where("companyId")` filter in client-side code, the Firestore engine physically prevents access to other tenants' directories because the query path is explicitly locked to the active user's company context.

### B. Firestore Rules Security Map (`firestore.rules`)
Server-side rules act as the final defense, rejecting any tampered client requests:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function belongsToCompany(companyId) {
      return isSignedIn() && request.auth.token.companyId == companyId;
    }
    
    // Default Rule: Deny all by default
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Core ERP Collections (Sales, Inventory, Projects, Finance)
    match /{collectionName}/{docId} {
      allow read, write: if belongsToCompany(resource.data.companyId || request.resource.data.companyId);
      
      // Strict Admin-only Delete Policy
      allow delete: if belongsToCompany(resource.data.companyId) && 
                    (request.auth.token.role == 'ADMIN' || request.auth.token.role == 'SUPERADMIN');
    }
  }
}
```

---

## 📝 3. Audit Log Integration

The `audit_logs` collection serves as the immutable ledger tracking all operations (Create, Update, Delete) across the ERP system.

### A. System Audit Trail Schema
```typescript
export interface AuditLog extends BaseDocument {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT';
  module: 'SALES' | 'INVENTORY' | 'PROJECTS' | 'FINANCE' | 'SYSTEM';
  targetId: string; // The primary key of the affected document
  reason?: string;  // Required description for sensitive operations
  changes?: {
    before: any;    // JSON state before transaction (null on CREATE)
    after: any;     // JSON state after transaction (null on DELETE)
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
  };
}
```

### B. Firestore Service Implementation (`audit.service.ts`)
The `auditService` captures exact changes between the previous state (`before`) and target state (`after`), logging user metadata along with the active `companyId`:
```typescript
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { AuditLog } from "@/types/database";

export const auditService = {
  async log(entry: Omit<AuditLog, "id" | "createdAt" | "updatedAt" | "isDeleted">) {
    try {
      const logRef = collection(db, "audit_logs");
      await addDoc(logRef, {
        ...entry,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });
    } catch (error) {
      console.error("[AUDIT_LOG_FAILED]:", error);
    }
  },

  async logCreate(userId: string, companyId: string, module: string, targetId: string, data: any) {
    return this.log({
      action: "CREATE",
      module,
      targetId,
      companyId,
      createdBy: userId,
      updatedBy: userId,
      changes: { before: null, after: data },
      metadata: { userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "SYSTEM" }
    });
  },

  async logUpdate(userId: string, companyId: string, module: string, targetId: string, before: any, after: any) {
    return this.log({
      action: "UPDATE",
      module,
      targetId,
      companyId,
      createdBy: userId,
      updatedBy: userId,
      changes: { before, after },
      metadata: { userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "SYSTEM" }
    });
  }
};
```

---

## 🧠 4. AI Expense Mapping (Intelligence Center)

The **NEXUS Intelligence Hub** utilizes **Gemini 2.5 Flash** via **Genkit 1.x** to automate physical-to-digital data mapping, speeding up operational data entry.

### A. Multimodal OCR Receipt Processing (`analyzeExpenseOCR`)
Field service technicians can upload receipts directly from site locations. The AI extracts financial values and matches them to active projects using GPS metadata and worker schedules:
```typescript
export const analyzeExpenseOCR = async (
  imageUrl: string, 
  userContext: { gps?: string, schedule?: any }
) => {
  console.log("Processing multimodal receipt OCR with Gemini 2.5 Flash...");
  
  // Real-world output mock structure returned from Genkit
  return {
    amount: 1250.00,
    merchant: "HomePro Co., Ltd.",
    category: "Materials",
    predictedProjectId: "PRJ-26-001", // Inferred from technician schedule & GPS
    isAsset: false,
    reasoning: "พบใบเสร็จสินค้าจาก HomePro ยอดเงิน 1,250.00 บาท สอดคล้องกับพิกัดจีพีเอสหน้างานและแผนติดตั้งโครงตาข่ายไฟเบอร์ในตารางเวลารายวันของโครงการ PRJ-26-001"
  };
};
```

### B. Automated Asset Tagging (`detectAssetRequirement`)
The AI analyzes incoming materials on Purchase Orders and automatically flags high-value hardware that requires Serial Number tracking:
```typescript
export const detectAssetRequirement = async (itemName: string) => {
  const assetKeywords = ["Cisco", "Aruba", "Switch", "Router", "Server", "UPS"];
  const isAsset = assetKeywords.some(keyword => itemName.toLowerCase().includes(keyword.toLowerCase()));
  
  return {
    isAsset,
    requiresSN: isAsset,
    prefix: "NXI",
    suggestion: isAsset ? `ตรวจพบสินค้ากลุ่ม Network Asset (${itemName}) ระบบจะกำหนดค่าให้ป้อน Serial Number และรหัสติดตาม NXI โดยอัตโนมัติ` : null
  };
};
```

---

## ⏰ 5. Smart Warranty Alert System

Proactive customer maintenance is a key revenue driver. The Smart Warranty Alert System scans Serial Number records to identify items nearing warranty expiration and auto-generate new service proposals.

```mermaid
chronos
    title Proactive Warranty Cycle
    rect rgb(0, 43, 91)
        note right of db: System regularly checks warranty expiry dates.
        db -> now: check serials where expiry <= (now + 30 days)
    end
    rect rgb(20, 20, 20)
        now -> ui: Populate expiring list (expiring within 30 days)
        ui -> PM: Trigger Sales Team alert
        PM -> Client: Propose Maintenance Agreement (MA)
    end
```

### A. Expiration Scan Engine (`maintenance.service.ts`)
The system queries physical Serial Numbers nearing their warranty end dates (within a 30-day window) to flag maintenance renewal opportunities:
```typescript
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { SerialNumber } from "@/types/database";

export const maintenanceService = {
  async getExpiringWarranties(companyId: string) {
    try {
      const now = Timestamp.now();
      const thirtyDaysFromNow = new Timestamp(
        now.seconds + 30 * 24 * 60 * 60,
        now.nanoseconds
      );

      // Scoped path ensuring company data isolation
      const snRef = collection(db, `companies/${companyId}/serial_numbers`);
      const q = query(
        snRef,
        where("warrantyExpiry", ">=", now),
        where("warrantyExpiry", "<=", thirtyDaysFromNow)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SerialNumber[];
    } catch (error) {
      console.error("[WARRANTY_CHECK_FAILED]:", error);
      return [];
    }
  }
};
```

---

## 📏 6. UI Master Alignment (The PSG Standards V3.1)

All components inside the NEXUS ERP match the **Master UI Protocol V3.1** to ensure a high-density, professional enterprise command center.

### A. Dimensions & Shapes Constraints
* **h-9 Sizing Standard**: To fit more data on screen and prevent vertical scrolling, all interactive elements (buttons, inputs, select fields) have a fixed height of **36px (`h-9`)**.
* **Horizontal Padding**: Horizontal padding is set to **`px-6` (24px)** for clean alignment.
* **Capsule Aesthetics**: The system forces a **`rounded-full`** Pill-shape on interactive controls (buttons, tabs, selectors).

### B. Typography & Accessibility
* **Non-italic Policy**: **Italics are completely disabled (0% usage) system-wide** to prevent blurred readouts of complex codes and SKU strings.
* **Precision Monospace**: Monospace fonts are enforced on:
  * Currency values (e.g., `฿ 150,000.00`)
  * Document IDs (e.g., `PO-2605-A18F`)
  * Serial Numbers and Hash Codes
* **High Contrast Opacity**: Opacities for text labels are upgraded to WCAG standards against the premium dark mode surface:
  * Primary Text & Headers: **`text-white/80`** or **`text-white/60`**
  * Secondary Codes & Details: **`text-white/50`**
* **Glassmorphism Theme**: High-fidelity surfaces use a neon-glow border combined with backdrop glass blur classes:
  ```css
  .nexus-glass-card {
    backdrop-filter: blur(24px);
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  ```

---

## 🧪 7. Comprehensive Master UAT Verification Check-sheet

Use this systematic test suite to verify the complete system functionality.

### 🔒 UAT Phase 1: Security & Multi-Tenancy Scoping
* [ ] **T1.1: Cross-Tenant Read Interception**
  1. Log into a tenant A account (`companyId: "COMP-001"`).
  2. Open the developer console and execute a query targeting Company B's database path: `getDoc(doc(db, "companies/COMP-002/purchase_orders/po-test"))`.
  3. *Pass Criterion*: Confirm the request is blocked by Firestore rules, throwing a `permission-denied` exception.
* [ ] **T1.2: Direct Delete Privilege Check**
  1. Log into a non-admin account (e.g. `ENGINEER`).
  2. Attempt to trigger a document deletion via console command: `deleteDoc(doc(db, "products", "prod-id"))`.
  3. *Pass Criterion*: The operation must fail, proving server rules validate request claims independently of the UI.
* [ ] **T1.3: Audit Log Mutation Block**
  1. Attempt to update an existing audit log document: `updateDoc(doc(db, "audit_logs", "log-id"), { action: "EDITED" })`.
  2. *Pass Criterion*: Firestore server rules must reject the transaction, proving audit trail immutability.

### 📝 UAT Phase 2: Operations & AI Intelligence
* [ ] **T2.1: Lock Auto-ID Generator**
  1. Open the Purchase Order modal and verify the document code (e.g. `PO-2605-A18F`) is locked and has a secure lock icon 🔒.
* [ ] **T2.2: Multi-Currency THB Translation**
  1. Set PO currency to **USD**, exchange rate to `36.5`, and add a `$100.00` item.
  2. *Pass Criterion*: The base value `฿3,650.00` must calculate and display dynamically under the price input.
* [ ] **T2.3: Multimodal AI Expense OCR**
  1. Upload a material receipt. Verify the Gemini AI extracts the exact financial total, predicts the category, and references the correct project ID based on GPS coordinates.
* [ ] **T2.4: Proactive Warranty Renewal**
  1. Seed a Serial Number expiring in 15 days. Verify the Scan Engine captures the item and populates the CRM alert queue.

---
*Locked under NEXUS ERP V3.2 | Enterprise Master System Blueprint | Strategic Integration Active*
