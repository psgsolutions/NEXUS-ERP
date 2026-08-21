const fs = require('fs');
let file = 'src/app/(authenticated)/procurement/requests/new/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const fieldComponent = `function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-bold text-white/60 flex items-center gap-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function NewPurchaseRequestPage()`;

content = content.replace('export default function NewPurchaseRequestPage()', fieldComponent);

// Replace opening tags that have children
content = content.replace(/<NexusDataField label="([^"]+)">/g, '<Field label="$1">');
content = content.replace(/<NexusDataField label="([^"]+)" required>/g, '<Field label="$1" required>');
// Replace closing tags
content = content.replace(/<\/NexusDataField>/g, '</Field>');

fs.writeFileSync(file, content);
