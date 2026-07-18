# Sanctum Shadow portrait library

Portraits are local game assets. Character creation uses the seven race portraits
in `races/`, so it works offline and never sends appearance data to an image API.

Major story characters can have bespoke raster art in this directory and are
mapped in `site/portrait-library.js`. Every other NPC, merchant, boss, enemy, or
dynamic character receives a stable identity-specific local portrait from that
same library. Adding bespoke art later only requires an image and one mapping
entry; existing saves and dialogue IDs continue to work.
