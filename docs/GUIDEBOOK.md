# Order To Cook — independent guidebook

This is **Order To Cook's own** book, not a chapter inside Kaleidoscope
Cookery. The requested information architecture is similar to Cookery's
category → subcategory → entry flow, while chapter contents remain OTC-owned.

## Native item and entry points

- Existing item: `ordertocook:guide` (unchanged identifier and permissions).
- The existing recipe remains one `minecraft:book` + one
  `minecraft:paper`; first-time players still receive it.
- The existing item uses a native **16×16 pixel-art book icon** at
  `runtime/RP/textures/ordertocook/item/guide_book.png`: a recolored
  adaptation of Mojang's vanilla Bedrock `book_normal` silhouette with a small
  gold cooking emblem and crimson bookmark, rather than an oversized smooth
  illustration or the order-ticket icon. The atlas path stays unchanged.
- Using that item opens the OTC guide. The order machine retains an entrance
  to the *same* OTC navigation tree.
- The Cookery guidebook, renderer, data, host APIs, item IDs, language
  selection and progression remain untouched.

## Chapters, topics and lessons

| Chapter | Topic groups | Lesson count |
| --- | --- | --- |
| Getting started | Setup; first shift | 4 |
| Restaurant management | Menu; orders; economy and staff | 6 |
| Kitchen and equipment | Preparation; appliances | 4 |
| Dining and dishwashing | Customers; washing | 4 |
| Delivery and vehicles | Deliveries; motorcycles | 4 |
| Progress and compatibility | Achievements; compatibility | 4 |

**Six chapters, thirteen topic groups and twenty-six lessons.** Each main
chapter and topic shows a matching icon, title and visible entry count.
Lesson screens have concise numbered instructions, previous/next (within
the current topic), back, home and close actions. Context actions link
to the existing personal progress, leaderboard, about/licence and admin
test-kit flows, with the same admin check as before.

## Localization and formatting

- `runtime/BP/scripts/guide_book.js` is the only guide tree.
- UI strings use `RawMessage.translate` and the resource pack's three
  `.lang` files (`zh_TW`, `zh_CN`, `en_US`).
- No per-player language property is written; client locale determines which
  language is shown.
- Navigation is one player-owned series of native `ActionFormData` forms,
  using the existing shared busy-form handling and supported icon-path API.
- No global UI JSON override, extra pack, player model, experimental API,
  or dependency on Cookery is needed.
- Plate and helmet buttons use their rendered inventory thumbnails. Equipment
  thumbnails come from the original models through `make_guide_icons`; unfolded
  model UV atlases are not button artwork. The reported screenshot failure,
  source correction and current validation scope are recorded in
  [0.1.27 client assets](validation/0.1.27-alpha.1/CLIENT_ASSETS.md).
- The Book GUI is **not visually pixel-identical** to the author's own
  renderer. A custom skinned book would be a separate visual effort, with
  dedicated Windows, touch, controller and other-client acceptance.

## Tutorials are based on current behavior

The pages explain the actual restaurant loop, five-block supply radius,
24-block work area, 27+54 refrigerator capacity, three stove lanes and nine
explicit vanilla cooking conversions, plate recovery, dishwashing, delivery,
motorcycles, in-pack progress, and verified public Senluo food V1 variants.
Unported food catalogs, external recipes, effects and Java-only mechanics are
explicitly identified as incomplete. These are instructions for the current
Bedrock implementation, not evidence of full Java parity.

## Checks and acceptance

`tests/guide-book.test.js` checks the immutable chapter tree, all reachable
screens, icon paths, three-language key coverage, admin visibility and the
existing item/recipe identity. Every button image must be an actual inventory
sprite or a thumbnail linked to an original model source in the conversion
manifest; an existing PNG alone is insufficient, because UV atlases are also
valid PNG files. This applies to all chapter, topic, lesson and navigation
buttons, including the plate image used by the order/deadline topic.
The main harness exercises a complete
cover→chapter→topic→lesson→next→previous→back→home navigation path.
Run `npm run verify` before merging.

The user's 2026-11-06 client screenshot exposed the incorrect atlas icons.
The corrected source assets and navigation checks are verified; a fresh client
view of the fix has not been observed. This is not a claim of complete
font, touch/controller or cross-device validation, or a new acceptance gate.
