// src/app/version-chip.js
// MCQ-only: fc bunu bootstrap içinde tutar; MCQ test edilebilirlik için ayrı modüle alır.
export function renderAppVersionChip(buildInfo, documentRef = document) {
  const version = buildInfo?.version;
  const label = version && version !== "unknown" ? `v${version}` : "dev";
  ["app-version-chip", "statusbar-version-chip"].forEach((chipId) => {
    const chip = documentRef.getElementById(chipId);
    if (chip) chip.textContent = label;
  });
}
