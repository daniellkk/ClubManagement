import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app confirmation (no native confirm()) with a loading state on confirm. */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="alertdialog" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {text && <p className="mt-1 text-sm text-gray-500">{text}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
