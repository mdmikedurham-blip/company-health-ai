import { generateVerticalSlice } from "./generate";

const { dir, bundle, validation } = generateVerticalSlice();
console.log(
  JSON.stringify(
    {
      ok: true,
      companyId: bundle.profile.companyId,
      dir,
      artifactCount: bundle.manifest.artifacts.length,
      warnings: validation.issues.filter((i) => i.severity === "warning"),
    },
    null,
    2,
  ),
);
