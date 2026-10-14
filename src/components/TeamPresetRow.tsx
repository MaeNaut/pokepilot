import type { TeamPreset } from "../data/teamPresets";
import { useLocalization } from "../i18n/useLocalization";
import { PokemonIcon } from "./PokemonIcon";

export function TeamPresetRow({ preset, onSelect, disabled = false }: {
  preset: TeamPreset;
  onSelect: (preset: TeamPreset) => void;
  disabled?: boolean;
}) {
  const { t } = useLocalization();
  const name = t(preset.nameKey);
  return (
    <button className="saved-team-row team-preset-row" type="button"
      aria-label={t("team.loadNamed", { name })} disabled={disabled} onClick={() => onSelect(preset)}>
      <span className="saved-team-header-row">
        <span className="saved-team-name-button">{name}</span>
        <small>{t("battleFormat.singles")}</small>
      </span>
      <span className="saved-team-preview" aria-hidden="true">
        {preset.pokemon.map((pokemon, index) => (
          <span className="saved-team-preview-slot" key={index}><PokemonIcon pokemon={pokemon} /></span>
        ))}
      </span>
    </button>
  );
}
