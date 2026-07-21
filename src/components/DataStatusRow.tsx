import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { useLocalization } from "../i18n/useLocalization";

type DataStatusRowProps = {
  message: string;
  isLoading?: boolean;
  onRetry?: () => void;
};

export function DataStatusRow({
  message,
  isLoading = false,
  onRetry,
}: DataStatusRowProps) {
  const { t } = useLocalization();

  return (
    <div className="data-status-row" role={onRetry ? "alert" : "status"}>
      {isLoading ? (
        <FontAwesomeIcon
          className="is-spinning"
          icon={faSpinner}
          aria-hidden="true"
        />
      ) : null}
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          aria-label={t("common.retryLoading")}
          title={t("common.retry")}
          onClick={onRetry}
        >
          <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
