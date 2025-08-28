import { useI18n } from "../../i18n";
import { useExcalidrawActionManager, useExcalidrawElements } from "../App";
import { openConfirmModal } from "../OverwriteConfirm/OverwriteConfirmState";
import Trans from "../Trans";
import DropdownMenuItem from "../dropdownMenu/DropdownMenuItem";
import { ServerDriveIcon } from "../icons/serverDrive";
import { actionLoadFromServerDrive } from "../../actions/actionLoadFromServerDrive";

export const LoadFromServerDrive = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const elements = useExcalidrawElements();

  if (!actionManager.isActionEnabled(actionLoadFromServerDrive)) {
    return null;
  }

  const handleSelect = async () => {
    if (
      !elements.length ||
      (await openConfirmModal({
        title: t("overwriteConfirm.modal.loadFromFile.title"),
        actionLabel: t("overwriteConfirm.modal.loadFromFile.button"),
        color: "warning",
        description: (
          <Trans
            i18nKey="overwriteConfirm.modal.loadFromFile.description"
            bold={(text) => <strong>{text}</strong>}
            br={() => <br />}
          />
        ),
      }))
    ) {
      actionManager.executeAction(actionLoadFromServerDrive);
    }
  };

  return (
    <DropdownMenuItem
      icon={ServerDriveIcon}
      onSelect={handleSelect}
      data-testid="load-from-server-drive-button"
      aria-label={t("buttons.loadFromServerDrive")}
    >
      {t("buttons.loadFromServerDrive")}
    </DropdownMenuItem>
  );
};
LoadFromServerDrive.displayName = "LoadFromServerDrive";
