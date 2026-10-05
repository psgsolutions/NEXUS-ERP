import re

def process_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # The block for Delivery Days:
    delivery_days_block = """            <div className="space-y-1">
              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">เวลาจัดส่ง</label>
              <StepperInput 
                value={expectedDeliveryDays || deliveryDays} 
                onChange={(val) => {
                  if (typeof setExpectedDeliveryDays === 'function') setExpectedDeliveryDays(val);
                  else if (typeof setDeliveryDays === 'function') setDeliveryDays(val);
                }}
                min={0}
                className="w-full h-7 bg-black/20 focus:bg-[#0D0D0D]/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 text-white focus:text-nexus-teal text-[12px] focus:border-nexus-teal focus:shadow-[0_0_15px_rgba(20,184,166,0.15)] placeholder:text-white/30 focus:placeholder-transparent"
              />
            </div>
"""

    # First, remove it from its current position
    content = content.replace(delivery_days_block, "")
    
    # Now, insert it right after the Probability block
    probability_block = """            <div className="space-y-1">
              <label className="text-[12px] font-black uppercase tracking-widest text-white/40">โอกาสการขาย</label>
              <StepperInput 
                value={probability} 
                onChange={(val) => setProbability(val)}
                min={0}
                max={100}
                className="w-full h-7 bg-black/20 focus:bg-[#0D0D0D]/90 focus:backdrop-blur-md border border-white/10 focus:border-nexus-teal/50 text-white focus:text-nexus-teal text-[12px] focus:border-nexus-teal focus:shadow-[0_0_15px_rgba(20,184,166,0.15)] placeholder:text-white/30 focus:placeholder-transparent"
              />
            </div>
"""

    content = content.replace(probability_block, probability_block + delivery_days_block)

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/app/(authenticated)/sales/quotations/new/page.tsx')
print("Reordered Delivery Days block")
