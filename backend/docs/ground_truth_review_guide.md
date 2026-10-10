# Ground-Truth Review Guide

Use this sheet to make a human decision for each benchmark pair. Do not infer labels from the AI prediction, benchmark score, or recommendations. Only a human reviewer can decide the final label.

## Label definitions

- `true`: a human reviewer confirms at least one material mismatch between the ad and the landing page.
- `false`: a human reviewer confirms there is no material mismatch.
- `uncertain`: the page or evidence is incomplete or ambiguous, so a reliable decision cannot be made.
- blank: the pair has not been reviewed yet.

## What counts as a material mismatch?

Label `true` when the ad makes a claim that is clearly unsupported or contradicted by the landing page, such as:

- promises of approval, funding, rates, or eligibility not shown on the page
- contradictory offers, deadlines, or guarantees
- price, fee, or payment terms not supported by the page copy
- missing material eligibility or disclosure information when the ad implies it is available

Label `false` when the landing page supports the claim or does not materially contradict the ad.

Label `uncertain` when the snapshot is incomplete, missing the relevant section, or the claim cannot be verified reliably from the available evidence.

## Review workflow

1. Open the worksheet CSV for the current pair.
2. Read the ad copy and the landing-page excerpt together.
3. Check for direct contradictions or missing material offers.
4. If the page is incomplete or the evidence is unclear, use `uncertain`.
5. Save the final label in `expected_mismatch` and add your name in `reviewer`.
6. Add notes in `review_notes` when the evidence is borderline or needs context.

Do not automatically convert AI suggestions into ground truth. Keep blank values blank until a real reviewer decides.
