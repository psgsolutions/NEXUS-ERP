import re

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\quotations\new\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# I will rewrite the main body from line 75 onwards using a safe regex or just parse it.
# Let's just find the exact structure.
# Currently it is:
#          </div>
#
#          {/* Line Items Table */}
# Let's remove this `</div>` so Line Items Table is inside flex-1.
content = content.replace(
    '         </div>\n\n         {/* Line Items Table */}',
    '         {/* Line Items Table */}'
)

# And right now the summary section looks like this:
#          </div>
#
#          {/* Summary Section (Sticky Right) */}
# Since I removed one `</div>` above, the `flex-1` will now be closed by the `</div>` just before `Summary Section`.
# Let's make sure it's:
#          </div>
#
#          {/* Summary Section (Sticky Right) */}
# And the extra `</div>` at the end:
content = content.replace(
    '      </div>\n    </div>\n  </div>\n  );\n}',
    '      </div>\n    </div>\n  );\n}'
)
content = content.replace(
    '      </div>\n    </div>\n  );\n}',
    '      </div>\n    </div>\n  );\n}'
)

with open(r"d:\NEXUS-ERP\src\app\(authenticated)\sales\quotations\new\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed structure")
