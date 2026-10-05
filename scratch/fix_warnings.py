import sys

file_path = r'd:\NEXUS-ERP\src\components\document\DocumentHeader.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Props
props_target = '''  phone: string;
  email: string;
  creditTerms: string;
  deliveryDate: string;
  onDocNoChange?: (val: string) => void;
  onEntitySelect?: () => void;
}'''
props_replacement = '''  phone: string;
  email: string;
  creditTerms: string;
  deliveryDate: string;
  onDocNoChange?: (val: string) => void;
  onEntitySelect?: () => void;
  onIssueDateChange?: (val: string) => void;
  onDeliveryDateChange?: (val: string) => void;
  onCreditTermsChange?: (val: string) => void;
}'''
content = content.replace(props_target, props_replacement)

# 2. Update destructured arguments
args_target = '''  deliveryDate,
  onDocNoChange,
  onEntitySelect,
}: DocumentHeaderProps) {'''
args_replacement = '''  deliveryDate,
  onDocNoChange,
  onEntitySelect,
  onIssueDateChange,
  onDeliveryDateChange,
  onCreditTermsChange,
}: DocumentHeaderProps) {'''
content = content.replace(args_target, args_replacement)

# 3. Add readOnly to entityName input
content = content.replace(
'''          <PillInput 
            value={entityName} 
            placeholder={entityPlaceholder} 
            onClick={onEntitySelect}
            className="w-full"
          />''',
'''          <PillInput 
            value={entityName} 
            placeholder={entityPlaceholder} 
            onClick={onEntitySelect}
            readOnly
            className="w-full cursor-pointer bg-white/[0.03]"
          />'''
)

# 4. Add onChange to Issue Date
content = content.replace(
'''<PillInput type="date" value={issueDate} className="font-mono" />''',
'''<PillInput type="date" value={issueDate} onChange={(e) => onIssueDateChange?.(e.target.value)} className="font-mono bg-white/[0.03]" />'''
)

# 5. Add onChange to Delivery Date
content = content.replace(
'''<PillInput type="date" value={deliveryDate} className="font-mono" />''',
'''<PillInput type="date" value={deliveryDate} onChange={(e) => onDeliveryDateChange?.(e.target.value)} className="font-mono bg-white/[0.03]" />'''
)

# 6. Add onChange to Credit Terms
content = content.replace(
'''<PillInput value={creditTerms} className="font-mono" />''',
'''<PillInput value={creditTerms} onChange={(e) => onCreditTermsChange?.(e.target.value)} className="font-mono bg-white/[0.03]" />'''
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
