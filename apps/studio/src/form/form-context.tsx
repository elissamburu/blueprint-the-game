// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What every field of the form shares: whether it is read-only, how to send an edit command, the
// issues of the validation that belong to it, the status region that announces moves and
// removals, the confirmation before removing, and moving the focus once the edited field renders.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@blueprint/ui/components/alert-dialog";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type { StudioFinding } from "../../shared/validation";
import { EditError, type EditCommand, type EditPath } from "../../shared/document-edit";
import { errorId, fieldId, pathKey } from "./form-paths";

export interface EditOptions {
  /** A structural edit (add, remove, move): an undo step of its own. */
  isolate?: boolean;
  /** Said by the status region once the edit is applied. */
  announce?: string;
  /** Id of the element that gets the focus once it renders. */
  focus?: string;
}

export interface ConfirmRequest {
  title: string;
  description: string;
  action: string;
  onConfirm: () => void;
  /**
   * Id of the element that gets the focus when the dialog closes, unless the edit says otherwise:
   * for a dialog opened after an await, whose trigger the dialog may not restore.
   */
  returnFocus?: string;
}

export interface FormContextValue {
  readOnly: boolean;
  /** Raw data of the document. */
  raw: unknown;
  edit: (commands: readonly EditCommand[], options?: EditOptions) => void;
  findingsAt: (path: EditPath) => readonly StudioFinding[];
  confirm: (request: ConfirmRequest) => void;
  focusLater: (id: string) => void;
  /** Ids of the fields of this provider (fieldId and errorId in its scope). */
  fieldId: (path: EditPath) => string;
  errorId: (path: EditPath) => string;
}

const FormContext = createContext<FormContextValue | undefined>(undefined);

export const useForm = (): FormContextValue => {
  const value = useContext(FormContext);
  if (value === undefined) throw new Error("useForm fuera de FormProvider");
  return value;
};

export interface FormProviderProps {
  readOnly: boolean;
  raw: unknown;
  /** Findings by the key of the path of their anchor (form-paths). */
  findings: ReadonlyMap<string, readonly StudioFinding[]>;
  onEdit: (commands: readonly EditCommand[], isolate: boolean) => void;
  /** Prefix of the ids of the fields: "form" (default), or "diagram" for the inspector. */
  idScope?: string;
  children: ReactNode;
}

const NO_FINDINGS: readonly StudioFinding[] = [];

export function FormProvider({
  readOnly,
  raw,
  findings,
  onEdit,
  idScope = "form",
  children,
}: FormProviderProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [request, setRequest] = useState<ConfirmRequest | undefined>();
  const pendingFocus = useRef<string | undefined>(undefined);
  /** Where the focus goes when the confirmation closes after an edit (its trigger is gone). */
  const focusOnClose = useRef<string | undefined>(undefined);

  // After every render: the element that was waiting for the focus may be there now.
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === undefined) return;
    const element = document.getElementById(id);
    if (element === null) return;
    pendingFocus.current = undefined;
    element.focus();
    element.scrollIntoView?.({ block: "nearest" });
  });

  const focusLater = useCallback((id: string) => {
    pendingFocus.current = id;
  }, []);

  const edit = useCallback(
    (commands: readonly EditCommand[], options: EditOptions = {}) => {
      if (readOnly) return;
      try {
        onEdit(commands, options.isolate ?? false);
      } catch (error) {
        if (!(error instanceof EditError)) throw error;
        setMessage(t("form.editFailed", { message: error.message }));
        return;
      }
      if (options.announce !== undefined) setMessage(options.announce);
      if (options.focus !== undefined) {
        pendingFocus.current = options.focus;
        focusOnClose.current = options.focus;
      }
    },
    [onEdit, readOnly, t],
  );

  const value = useMemo<FormContextValue>(
    () => ({
      readOnly,
      raw,
      edit,
      findingsAt: (path) => findings.get(pathKey(path)) ?? NO_FINDINGS,
      confirm: (next) => {
        focusOnClose.current = next.returnFocus;
        setRequest(next);
      },
      focusLater,
      fieldId: (path) => fieldId(path, idScope),
      errorId: (path) => errorId(path, idScope),
    }),
    [readOnly, raw, edit, findings, focusLater, idScope],
  );

  return (
    <FormContext.Provider value={value}>
      {children}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </p>
      <AlertDialog
        open={request !== undefined}
        onOpenChange={(open) => {
          if (!open) setRequest(undefined);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            // After removing, the focus goes where the edit said (the trigger is gone); after
            // cancelling, back to the trigger.
            const id = focusOnClose.current;
            if (id === undefined) return;
            event.preventDefault();
            focusOnClose.current = undefined;
            document.getElementById(id)?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            <AlertDialogDescription>{request?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => request?.onConfirm()}>
              {request?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </FormContext.Provider>
  );
}
