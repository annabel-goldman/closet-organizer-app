import { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

interface PrimitiveConfirmationDialogProps {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel?: string;
  description: string;
  confirmClassName?: string;
  destructive?: boolean;
  isConfirmDisabled?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title?: string;
}

function PrimitiveConfirmationDialog({
  cancelLabel = "Cancel",
  children,
  confirmLabel = "Proceed",
  description,
  confirmClassName = "",
  destructive = false,
  isConfirmDisabled = false,
  onConfirm,
  onOpenChange,
  open,
  title = "Proceed?",
}: PrimitiveConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {children ? <AlertDialogTrigger asChild>{children}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirmDisabled}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isConfirmDisabled}
            className={`${destructive ? "bg-destructive text-white hover:bg-destructive/90" : ""} ${confirmClassName}`.trim()}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { PrimitiveConfirmationDialog };
