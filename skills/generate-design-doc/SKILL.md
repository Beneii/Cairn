---
name: generate-design-doc
description: |
  Use when the user asks for architecture/design documentation to be generated in
  a structured format.
use_when:
  - "generate design doc"
  - "document architecture"
  - "write technical design"
dont_use_when:
  - "simple status updates"
  - "code-only changes"
success_criteria:
  - "design document generated in docs/"
  - "document follows template structure"
---

# Generate Design Doc

Creates a structured design document from a reusable template.

# Steps

1) Load template from `templates/design_template.md`.
2) Populate fields from arguments and repo context.
3) Write output file under `docs/`.

# Scripts

- scripts/generate_doc.sh
- templates/design_template.md
