import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getProjectRoot } from "@cairn/shared";

const DOCUMENT_FILES = [
  "01_CORE_IDENTITY.md",
  "02_ARCHITECTURE.md",
  "03_CAPABILITY_REGISTRY.md",
  "04_POLICIES_AND_GATES.md",
  "05_ROADMAP.md",
  "06_LOCAL_BRANCH_BUILDER_SPEC.md",
  "07_HOME_LAB_PORTABILITY.md",
  "08_LEAN_ARCHITECTURE.md",
];

export interface SystemDoc {
  id: string;
  title: string;
  content: string;
}

export function loadSystemDocs(): SystemDoc[] {
  const docsDir = join(getProjectRoot(), "documents");
  return DOCUMENT_FILES.map((filename) => {
    const filePath = join(docsDir, filename);
    if (!existsSync(filePath)) return null;
    return {
      id: filename,
      title: filename,
      content: readFileSync(filePath, "utf-8"),
    };
  }).filter((d): d is SystemDoc => Boolean(d));
}
