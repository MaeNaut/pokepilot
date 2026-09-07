# Third-Party Notices

## Font Awesome

UI icons are rendered with Font Awesome packages:

- `@fortawesome/free-solid-svg-icons`
- `@fortawesome/react-fontawesome`

Website: https://fontawesome.com

Repository: https://github.com/FortAwesome/Font-Awesome

The installed free solid icon package is licensed under CC BY 4.0 and MIT.
The React component package is licensed under the MIT License.

## html-to-image

Pokemon and team share-card DOM is rendered to PNG with `html-to-image`.

Repository: https://github.com/bubkoo/html-to-image

The installed package is licensed under the MIT License.

## Lucide

Move category SVGs in `src/assets/icons/categories` use Lucide's `swords`,
`orbit`, and `sliders-horizontal` icons. Each SVG includes the license notice.

Source: https://github.com/lucide-icons/lucide

License: https://lucide.dev/license

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

## PokePilot Type Symbols

Type SVGs in `src/assets/icons/types` are custom PokePilot vector designs.
They replace the previously bundled pokemon-type-icons artwork. Existing type
background colors are retained for continuity.

## Pokemon Showdown

Pokemon battle metadata, generated item and ability catalogs, and the generated
Pokemon Champions Regulation M-B legality snapshot are derived from Pokemon
Showdown runtime data and the Pokemon Showdown GitHub repository.

Runtime data: https://play.pokemonshowdown.com/data/

Repository: https://github.com/smogon/pokemon-showdown

Usage stats: https://www.smogon.com/stats/

Pokemon Showdown is licensed under the MIT License. PokePilot uses Showdown
data as a practical legality reference and is not affiliated with Pokemon
Showdown or Smogon.

## PokeAPI

Selected Pokemon sprites and development-time Korean localization source data
come from PokeAPI and its companion repositories.

API repository: https://github.com/PokeAPI/pokeapi

Static data: https://github.com/PokeAPI/api-data

Sprites: https://github.com/PokeAPI/sprites

The PokeAPI software and static data repositories use the BSD 3-Clause License.
The sprites repository is distributed under CC0 1.0, while its license file
also states that all image contents are copyright The Pokemon Company. CC0 does
not waive third-party copyright, trademark, or patent rights. PokePilot claims
no ownership of Pokemon names, characters, artwork, or sprites.

## @smogon/calc

Damage ranges and battle modifiers are calculated with the `@smogon/calc`
package through a PokePilot Pokemon Champions adapter.

Repository: https://github.com/smogon/damage-calc

The installed package declares the MIT License. PokePilot supplies its current
Pokemon Champions species, move, stat-point, and field inputs to the engine and
is not affiliated with Smogon.

## Additional Application Libraries

The browser and server application also include these directly installed open
source libraries:

| Package | License |
| --- | --- |
| React and React DOM | MIT |
| OpenAI JavaScript/TypeScript SDK | Apache-2.0 |
| Upstash Redis JavaScript client | MIT |
| Vite and the Vite React plugin | MIT |
| TypeScript | Apache-2.0 |

Their package distributions and upstream repositories contain the complete
license texts and copyright notices.
