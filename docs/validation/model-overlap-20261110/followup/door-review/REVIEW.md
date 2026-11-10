# Dishwasher door-back independent review

## Conclusion

The additional door-back trim is geometrically correct for all 82 currently
generated dishwasher states. Relative to commit
`48ef920779cd7d76244061bad9dd31ffc2f6b57a`, only group5 cube0's local Z size
changes in each state. The new value is the old value multiplied by 0.985 and
rounded to six decimal places. No checkout files were changed by this review.

- All 82 files exactly match the isolated candidate, including their bytes.
- Calling the actual converter's `make_blocks()` into temporary storage
  reproduces all 82 runtime geometries exactly.
- The remaining 328 model files are byte-identical to the comparison commit.
- Independently transformed front vertices are exactly unchanged. The door's
  origin, X/Y size, cube/bone pivots and rotations, all UV definitions, and all
  other geometry fields are identical.
- Door thickness stays positive at 0.906212–0.985175 model pixels. Its back
  retreats 0.0138–0.015003 pixels. With origin and rigid transforms unchanged,
  the trimmed solid is contained in the previous solid. Side-face texture
  coordinates stay unchanged, so side-face physical texel density changes.
- Door-back/basket-front coplanarity decreases from 25 states to zero. In
  those 25 states, the resulting plane separation is 0.0138–0.015 pixels.
- Exhaustive transformed-face comparisons over all affected geometry find
  200 prior and 175 current positive-area coplanar pairs, with zero new or
  enlarged pairs. The 25 removals are the intended door/basket contacts.
- All eight `ModelOverlapTests` pass.

This establishes the finite geometry repair. It does not establish that every
remaining coplanar contact is a defect, or that all rendered flicker is gone.

## Guard review

The checked source guard rejects changes to the source door's origin and size.
The final posed helper requires finite, positive incoming thickness and a
rounded result strictly between zero and the old thickness. All eight
synthetic negative controls pass: changed source origin, changed source size,
zero source size, and posed sizes zero, -1, 1e-8, NaN and Infinity are rejected.

An initial review found that a previous `<= 0` check allowed tiny values to
round to zero and allowed non-finite numbers through. That guard has been
hardened and independently rechecked. The change leaves all 82 generated
states and all geometric conclusions above unchanged. The focused test suite
also includes these five invalid posed-thickness values and passes.

## Method

`review.py` reads the comparison Git tree and working files. It independently
forms rigid transform matrices and propagates cube/bone transforms, then
checks all face pairs instead of using rounded-plane grouping. Coplanarity
uses a plane-distance tolerance of 1e-5 model pixels and a normal dot-product
tolerance of 1e-10. Polygon intersection must exceed 1e-6 square model pixels.
Faces with zero UV extent are excluded. The census includes all geometry
faces regardless of runtime bone-visibility predicates; it is conservative
candidate detection, not a rendered visibility classification.

The review also regenerates the real block converter output in temporary
storage and compares it with the working runtime. It does not write to the
checkout, open a GUI, deploy, commit, or publish.

Python 3.12.14 was used with NumPy and the converter's Pillow dependency.

## Evidence and reproduction

- `summary.json`: aggregate results and scope.
- `states.json`: all 82 state hashes, candidate comparison, preserved fields,
  thicknesses, plane contacts, and removed pair identities.
- `input-identities.json`: hashes for every model and relevant reviewed inputs.
- `guard-probes.json`: synthetic source/posed guard results.
- `door-helper-identities.json`: final reviewed helper source and hashes, plus
  the converter's whole-file hash at review time.
- `focused-tests.log`: the eight focused test results.
- `review.log`: the complete independent review output.
- `artifact-manifest.json`: evidence hashes.

Run `python3 review.py CHECKOUT CANDIDATE_GEOMETRY --output OUTPUT` with a
checkout containing the reviewed working changes and the isolated candidate
directory. The default comparison commit is `48ef920`; `--baseline` can select
the full commit above. Run the focused test from that checkout with
`PYTHONDONTWRITEBYTECODE=1 python3 tests/test_appliance_geometry.py ModelOverlapTests`.

## Limitations

The conclusions apply to the door helper/source delta and the exact reviewed
model hashes. Other concurrent converter changes are not covered merely by
the whole-file hash recorded here. The final integrator must reconcile that
hash and rerun aggregate checks after unrelated changes.

No game, native renderer, editor or client/world validation was performed.
No claim is made about an engine alpha-test threshold, texture filtering,
depth-buffer precision, visibility from every viewpoint, or temporal flicker.
Only the finite 82 shipped states were evaluated; continuous source motion
between states is outside this repair's verification scope. Pre-existing
descendant-shear/cuboid approximation is unchanged. This review starts from
the earlier repair snapshot, not from the upstream model baseline.

## Published baseline identity

The review originally ran against local commit `4cc310c57f0fa48cc450526458c666d3a30521af`. The published equivalent is `48ef920779cd7d76244061bad9dd31ffc2f6b57a`; both have the exact Git tree `e789e28e00751d54d17e94853efdef87500e511a`. Stored review logs retain their original identifiers. Only baseline metadata and script defaults were rebound; geometry and image findings were not changed.

This is historical **door-only** evidence. The script requires the recorded door-only working snapshot plus the isolated candidate geometry directory. It intentionally rejects the later stain geometry changes, so it is not a final-checkout aggregate test. On the final checkout, run `tests/test_appliance_geometry.py ModelOverlapTests` for the integrated door regression checks and the final report's full suites.
