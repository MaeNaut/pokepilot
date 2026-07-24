import type { PokemonAbility, PokemonItem } from "../types";
import { useLocalization } from "../i18n/useLocalization";
import { ItemSprite } from "./ItemSprite";

function normalizeEffectText(value: string | undefined, fallback: string) {
  return (
    value
      ?.replace(/\$effect_chance/g, "effect chance")
      .replace(/\s+/g, " ")
      .trim() || fallback
  );
}

export function ItemDetailsContent({ item }: { item: PokemonItem }) {
  const { gameDescription, gameName, t } = useLocalization();
  const effect = normalizeEffectText(
    item.effect,
    "Item details are not available from Showdown.",
  );

  return (
    <>
      <div className="item-tooltip-header">
        <ItemSprite item={item} />
        <div>
          <strong>
            {gameName("items", item.showdownId ?? item.id, item.name)}
          </strong>
          {item.category ? (
            <small>
              {item.category === "Mega Stones"
                ? t("builder.megaStones")
                : item.category}
            </small>
          ) : null}
        </div>
      </div>
      <p>
        {gameDescription(
          "items",
          item.showdownId ?? item.id,
          effect,
        )}
      </p>
    </>
  );
}

export function AbilityDetailsContent({
  ability,
}: {
  ability: PokemonAbility;
}) {
  const { gameDescription, gameName, t } = useLocalization();
  const effect = normalizeEffectText(
    ability.shortEffect ?? ability.effect,
    "Ability details are not available from Showdown.",
  );

  return (
    <>
      <div className="ability-tooltip-header">
        <strong>
          {gameName("abilities", ability.id, ability.name)}
        </strong>
        <small>{t("builder.ability")}</small>
      </div>
      <p>{gameDescription("abilities", ability.id, effect)}</p>
    </>
  );
}
