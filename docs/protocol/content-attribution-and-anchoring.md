# Content Attribution and Anchoring — Honest Model (Design)

Status: DESIGN / narrative-and-scope correction. The on-chain primitive already exists (`anchor_content_hash` / `ContentHashAnchor`); this document fixes what we *claim* it does and specifies the achievable strengthening path. No financial or seed semantics change here.
Last updated: 2026-06-19

## The Problem This Fixes

Our own pitch (Slide 3, and the index deck) correctly lists "fake content ownership" as one of the structural reasons Web3 social products failed. But the content anchor was never positively defined anywhere, which leaves it open to being read as an ownership/provenance claim it cannot back up. A keccak digest of a URL is a timestamped, signed attestation — it does not prevent copying, does not prove originality, and confers no enforceable rights.

We are resolving this by being explicit and honest rather than by overbuilding:

- We explicitly drop the Web3 "content ownership" framing. Content is not tokenized, not turned into an NFT, and not owned-by-the-chain.
- We state exactly what the anchor is (a creator-signed publication record) and what it is not (ownership).
- We keep its real, achievable job: verifiable attribution that routes revenue to the right creator, with zero content lock-in.

## Design Goals (what we actually want)

1. Reasonable attribution and revenue routing. Tie a specific piece of content to a verifiable creator identity and a specific campaign/settlement, so USDC and fan rewards flow to the right party based on a signed, timestamped, tamper-evident reference.
2. At least priority/authorship evidence. Provide a creator-signed, on-chain-timestamped record that is useful as precedence and authorship evidence — the honest version of "proof of originality."
3. Zero content lock-in. The creator's content lives on the creator's own platforms. StreamPump stores a reference and a digest, never custody, never an exclusive license. Creators can publish anywhere, edit, delete, or leave; the anchor is only a historical attestation.

## What the On-Chain Anchor Actually Is

`anchor_content_hash` writes a `ContentHashAnchor` PDA at seeds `["content_anchor", creator_profile, url_digest]` containing:

- `authority` / `creator_profile` — the creator identity that signed the claim.
- `canonical_url` + `url_digest` — the external content location; the program verifies `url_digest == keccak(canonical_url)`.
- `content_digest` — a 32-byte hash of the content/manifest, supplied by the client. The program does NOT fetch the URL or verify this against live bytes.
- `anchored_at` + `version` — on-chain timestamp and a monotonically increasing version for re-anchors.

It is, precisely, a creator-signed, timestamped, versioned attestation: "identity X claims this URL and this content digest at time T."

### What it proves

- Authorship attestation: the claim is signed by the creator's key. Its strength is exactly the strength of how well that identity is verified (handle/KYC/publication verification).
- Priority / precedence timestamp: a tamper-evident, ordered record that the claim existed by time T. This is useful corroborating evidence in a dispute (a notarized timestamp, a "poor man's" precedence record).
- Integrity / tamper-evidence: anyone holding the original bytes (or the committed manifest) can recompute the digest and confirm the content has not changed since anchoring.

### What it does NOT prove (state this plainly, everywhere)

- Not originality. A copier can anchor a copy. Anchoring earlier is evidence, not proof.
- Not ownership or exclusive rights. It confers no legal right and does not stop anyone from copying or re-posting.
- Not live-content integrity by itself. Without the original bytes/manifest, the on-chain `content_digest` is just an opaque 32 bytes; the program never verified it against the URL.

## Naming and Narrative Rules

- Call it a publication record / authorship attestation / content-integrity anchor / publication timestamp. Never "ownership", "copyright", "exclusive", "protected from copying", "provenance" (provenance implies a verified capture-to-publish chain we do not have without C2PA).
- Never tokenize content or mint content NFTs.
- In the pitch: keep "fake content ownership" as a named Web3 failure, then state our differentiator honestly — we do not claim to own your content; we make your published content verifiably attributable so the money flows correctly, and your content stays portable.

## No Lock-In Guarantee (product commitment)

- Content is hosted by the creator on the creator's own platforms (the `canonical_url`). StreamPump stores only a reference + digest + signed attestation.
- No exclusive license is taken. Creators may publish the same content anywhere, including before or after anchoring.
- Leaving StreamPump does not remove the creator's content from their platforms; the anchor remains only as an immutable historical attestation of a past claim.

## Revenue Distribution Role (the achievable core)

The anchor's real product job is to be the canonical reference that settlement and reward routing bind to:

- `Proposal.content_hash` + optional `Proposal.content_anchor` bind an S2 campaign to a specific, creator-signed content reference (`create_proposal` already enforces that a supplied content hash matches the anchored digest).
- Settlement therefore pays the verified creator identity tied to that reference, and fan endorsement rewards attach to that campaign.

So "content + its revenue are reasonably distributed" is delivered by verifiable attribution to an identity and a campaign — not by an ownership claim. This is honest and already largely wired.

## Strengthening Toward Originality (honest, optional, ordered)

Do not overclaim. If we want to move from "attestation" toward stronger originality signals, do it with real mechanisms, each clearly labeled and verified before promotion:

1. Cross-platform publication verification (strongest near-term; partly in schema already). Prove the same creator identity controls the external account where the content is natively published (e.g. a verified YouTube/X handle), via `ContentPublication` verification. "Published under verified handle @x at T, anchored here at T'." This uses the creator's own platform, so it adds an authorship signal without any lock-in.
2. C2PA / Content Credentials. Optionally attach C2PA manifests so capture/edit-to-publish provenance can be verified by standard tooling. Future integration; do not claim until built.
3. Perceptual fingerprint / third-party originality service. Optional near-duplicate detection via a real provider. Blocker: requires a real merchant/provider contract — do not fake it (per repo blocker policy).

## Optional Code Clarifications (non-urgent, not in this pass)

- No on-chain change is required for the reframe; the primitive is fine as an attestation. Field/event names (`content_digest`, `ContentAnchored`) are acceptable.
- If/when publication verification is wired, consider adding a verified-publication reference so the anchor can point at the external proof. Treat any state/seed change as audit-sensitive.

## Open Questions

- How strong an identity check do we require before an anchor carries weight (handle verification vs KYC)?
- Do we surface a public "first anchored at / verified publication" badge on content, and how do we word it to avoid implying ownership?
- Which strengthening step (publication verification first) to schedule, and behind which readiness label.
