import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SavedTeamRow } from "./SavedTeamRow";

vi.mock("../i18n/useLocalization", () => ({ useLocalization: () => ({ t: (key: string) => key }) }));

describe("saved-team import input", () => {
  it.each([false, true])("locks editing only while importing (%s)", (importing) => {
    const noop = vi.fn();
    const props: ComponentProps<typeof SavedTeamRow> = {
      team: { id: "qa", name: "QA", version: 1, battleFormat: "singles", slots: Array(6).fill(null), bench: [], createdAt: "2026-09-30", updatedAt: "2026-09-30" },
      index: 0, isActive: false, isRenaming: false, renameDraft: "", isDeletePending: false,
      isShowdownOpen: true, showdownDraft: "Charizard", isImportingShowdown: importing,
      reorder: { dragState: null } as ComponentProps<typeof SavedTeamRow>["reorder"],
      onSelect: noop, onKeyDown: noop, onRenameDraftChange: noop, onRenameKeyDown: noop,
      onConfirmRename: noop, onCancelRename: noop, onStartRename: noop, onDuplicate: noop,
      onToggleShowdown: noop, onToggleDelete: noop, onCancelDelete: noop, onDelete: noop,
      onShowdownDraftChange: noop, onImportShowdown: noop, onExportShowdown: noop,
    };
    const html = renderToStaticMarkup(<SavedTeamRow {...props} />);
    expect(/<textarea[^>]*readOnly=""/i.test(html)).toBe(importing);
    expect(html).toContain("Charizard</textarea>");
  });
});
