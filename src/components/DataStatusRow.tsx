import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight, faSpinner } from "@fortawesome/free-solid-svg-icons";

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
          aria-label="Retry loading data"
          title="Retry"
          onClick={onRetry}
        >
          <FontAwesomeIcon icon={faRotateRight} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
