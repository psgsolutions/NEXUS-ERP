import re

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\quotations\new\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the max-w-6xl container with the xl:flex-row layout
content = content.replace(
    '<div className="max-w-6xl mx-auto w-full px-8 py-10 space-y-12">',
    '<div className="flex flex-col xl:flex-row gap-4 px-4 py-6 w-full max-w-[1800px] mx-auto">' + '\n' +
    '         <div className="flex-1 space-y-4">'
)

# Replace the grid-cols-12 with normal flex stack or keep it inside the flex-1
content = content.replace(
    '<div className="grid grid-cols-12 gap-8">',
    '<div className="flex flex-col gap-4">'
)
content = content.replace(
    '<div className="col-span-8 bg-white/[0.02] border border-white/5 rounded-2xl p-8 space-y-6">',
    '<div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">'
)

# Date column
content = content.replace(
    '<div className="col-span-4 space-y-6">',
    '<div className="grid grid-cols-2 gap-4">'
)
content = content.replace(
    '<div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 space-y-6">',
    '<div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4">'
)

content = content.replace(
    '<div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">',
    '<div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl">'
)


# Replace line items table container
content = content.replace(
    '         {/* Line Items Table */}',
    '         </div>\n         {/* Line Items Table */}'
)
content = content.replace(
    '         {/* Summary Section */}',
    '         </div>\n         {/* Summary Section (Sticky Right) */}\n         <div className="xl:w-[25%] shrink-0 sticky top-[96px] space-y-4 h-fit">'
)

# Change summary container
content = content.replace(
    '<div className="flex justify-end">\n            <div className="w-[480px] bg-white/[0.02] border border-white/5 rounded-2xl p-8 space-y-4">',
    '<div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-2xl space-y-4 w-full">'
)

# Save
with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\quotations\new\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated quotation new page")
