# 10 - Name the tool

Type: grilling (HITL)
Status: resolved

## Question

Brainstorm and pick the tool's name. It appears in the GUI title, PDF metadata fields (tool name/version), the processing log, and the installer/app identity — so it's worth settling before the spec is assembled. Constraints: sounds trustworthy and professional to a non-technical dealership employee; hints at what it does (invoice prep for RTO / discount removal); no trademark collisions worth worrying about at this scale, but avoid names that imply affiliation with any OEM or government body (no "VAHAN", "RTO Official", brand-like claims). Consult the `grilling` skill for the brainstorm.

## Answer

**Name: "RTO Invoice Prep".**

- **Direction**: descriptive, not a coined brand. For a single trusted tool on one desk, clarity beats branding; the PDF metadata and installer just need to look legitimate.
- **Why this name**: built on the glossary's canonical **RTO invoice** term, so it names the input–output relationship in the domain's own vocabulary; "prep" is honest (it prepares, not generates or issues) and cannot be read as claiming RTO affiliation. Avoided "generator" (the tool transforms an existing PDF, it doesn't generate) and "fix" (implies the original was broken).
- **One name everywhere** (Q3): "RTO Invoice Prep" in the window title, PDF metadata, and processing log; `RTOInvoicePrep` as the executable / NSIS product name; kebab-case `rto-invoice-prep` for repo / release assets. Case variants of a single name, no display/utility split.
- **Tagline** (Q4): *"Prepare dealership invoices for RTO registration"* on the installer and about-screen only — not the window title.
