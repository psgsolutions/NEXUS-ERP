"use client";

import React, { useState } from "react";
import { ShieldCheck, ChevronRight, Building2, Globe } from "lucide-react";
import { cn } from "@/components/ui/Base";

export function EntitySelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState({ id: "hq", name: "PSG HQ (BANGKOK)", type: "HEADQUARTERS" });

  const entities = [
    { id: "hq", name: "PSG HQ (BANGKOK)", type: "HEADQUARTERS", color: "text-nexus-teal" },
    { id: "ry", name: "NEXUS TECH (RAYONG)", type: "BRANCH OFFICE", color: "text-nexus-blue" },
    { id: "gl", name: "GLOBAL CONSOLIDATED", type: "VIRTUAL NODE", color: "text-warning" },
  ];

  return (
    <div className="relative">
       <div 
          onClick={() => setIsOpen(!isOpen)}
          className="mb-8 p-5 rounded-xl bg-white/[0.03] border border-white/10 relative group cursor-pointer hover:bg-white/[0.06] transition-all overflow-hidden"
       >
          <div className="flex items-center gap-4 relative z-10">
             <div className={cn("w-10 h-10 rounded-xl bg-opacity-10 flex items-center justify-center border border-opacity-20 flex-shrink-0", 
                selectedEntity.id === "gl" ? "bg-warning text-warning border-warning" : "bg-nexus-teal text-nexus-teal border-nexus-teal"
             )}>
                {selectedEntity.id === "gl" ? <Globe size={20} /> : <ShieldCheck size={20} />}
             </div>
             <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-bold text-white/20 uppercase tracking-widest mb-1">{selectedEntity.type}</p>
                <p className="text-sm font-black text-white truncate uppercase leading-tight">{selectedEntity.name}</p>
             </div>
             <ChevronRight size={14} className={cn("text-white/20 group-hover:text-white transition-transform", isOpen && "rotate-90")} />
          </div>
       </div>

       {isOpen && (
         <div className="absolute top-full left-0 w-full mt-2 z-[200] bg-[#121215] border border-white/10 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-300">
            {entities.map((entity) => (
               <button 
                  key={entity.id}
                  onClick={() => {
                     setSelectedEntity(entity);
                     setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-white/5 text-left group transition-all"
               >
                  <div className={cn("w-2 h-2 rounded-full", entity.id === selectedEntity.id ? "bg-nexus-teal shadow-neon-teal" : "bg-white/20")} />
                  <div>
                     <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{entity.type}</p>
                     <p className={cn("text-[12px] font-black uppercase transition-colors", entity.id === selectedEntity.id ? "text-white" : "text-white/60 group-hover:text-white")}>
                        {entity.name}
                     </p>
                  </div>
               </button>
            ))}
         </div>
       )}
    </div>
  );
}
