import { Upload } from "lucide-react";
import type React from "react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { ResumeSetupMode, ValidationState } from "../types";
import { InlineValidation } from "./InlineValidation";
import { RxResumeStep } from "./RxResumeStep";

export const BaseResumeStep: React.FC<{
  baseResumeValidation: ValidationState;
  baseResumeValue: string | null;
  hasRxResumeAccess: boolean;
  isBusy: boolean;
  isImportingResume: boolean;
  isResumeReady: boolean;
  isRxResumeSelfHosted: boolean;
  resumeSetupMode: ResumeSetupMode;
  rxresumeApiKey: string;
  rxresumeApiKeyHint: string | null | undefined;
  rxresumeUrl: string;
  rxresumeValidation: ValidationState;
  onImportResumeFile: (file: File) => Promise<void>;
  onResumeSetupModeChange: (mode: ResumeSetupMode) => void;
  onRxresumeApiKeyChange: (value: string) => void;
  onRxresumeSelfHostedChange: (next: boolean) => void;
  onRxresumeUrlChange: (value: string) => void;
  onTemplateResumeChange: (value: string | null) => void;
}> = ({
  baseResumeValidation,
  baseResumeValue,
  hasRxResumeAccess,
  isBusy,
  isImportingResume,
  isResumeReady,
  isRxResumeSelfHosted,
  resumeSetupMode,
  rxresumeApiKey,
  rxresumeApiKeyHint,
  rxresumeUrl,
  rxresumeValidation,
  onImportResumeFile,
  onResumeSetupModeChange,
  onRxresumeApiKeyChange,
  onRxresumeSelfHostedChange,
  onRxresumeUrlChange,
  onTemplateResumeChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            void onImportResumeFile(file);
          }
          event.currentTarget.value = "";
        }}
      />

      <RadioGroup
        value={resumeSetupMode}
        onValueChange={(value) =>
          onResumeSetupModeChange(value === "rxresume" ? "rxresume" : "upload")
        }
        className="grid gap-4 lg:grid-cols-2"
      >
        {[
          {
            value: "upload",
            title: "Tải lên tệp",
            description:
              "Tạo tài liệu Resume Studio cục bộ từ tệp CV PDF, DOCX hoặc JSON từ Reactive Resume.",
          },
          {
            value: "rxresume",
            title: "Sử dụng Reactive Resume",
            description:
              "Kết nối bằng khóa API v5 và chọn bản CV bạn sẵn có trên Reactive Resume.",
          },
        ].map((option) => {
          const checked = resumeSetupMode === option.value;
          const radioId = `resume-setup-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={radioId}
              className={cn(
                "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors",
                checked
                  ? "border-primary bg-muted/40"
                  : "border-border/60 hover:bg-muted/20",
              )}
            >
              <RadioGroupItem
                id={radioId}
                value={option.value}
                className="mt-1"
              />
              <div className="space-y-1">
                <div className="text-base font-medium text-foreground">
                  {option.title}
                </div>
                <div className="text-sm leading-6 text-muted-foreground">
                  {option.description}
                </div>
              </div>
            </label>
          );
        })}
      </RadioGroup>

      {resumeSetupMode === "upload" ? (
        <>
          <div className="rounded-xl border border-border/60 bg-muted/10 p-5">
            <div className="space-y-2">
              <div className="text-sm font-medium">Tải lên tệp CV của bạn</div>
              <p className="text-sm text-muted-foreground">
                JobOps nhập trực tiếp tệp JSON từ Reactive Resume. Các tệp PDF
                và DOCX sẽ được gửi đến mô hình AI đã cấu hình để chuyển đổi và
                lưu cục bộ dưới dạng Design Resume.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy || isImportingResume}
              >
                <Upload className="h-4 w-4" />
                {isImportingResume ? "Đang nhập CV..." : "Tải lên tệp CV"}
              </Button>
              <div className="text-xs text-muted-foreground">
                Định dạng hỗ trợ: PDF, DOCX và JSON của Reactive Resume.
              </div>
            </div>
          </div>

          {(baseResumeValidation.checked || rxresumeValidation.checked) &&
          !hasRxResumeAccess &&
          !baseResumeValidation.valid ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              Hãy tải lên CV tại đây, hoặc chuyển sang tùy chọn Reactive Resume
              nếu bạn muốn nhập trực tiếp từ bản CV mẫu có sẵn.
            </div>
          ) : null}

          <InlineValidation
            state={baseResumeValidation}
            successMessage="CV gốc của bạn đã được tải và sẵn sàng."
          />
        </>
      ) : (
        <>
          <RxResumeStep
            baseResumeValue={baseResumeValue}
            hasRxResumeAccess={hasRxResumeAccess}
            isBusy={isBusy}
            isResumeReady={isResumeReady}
            isSelfHosted={isRxResumeSelfHosted}
            rxresumeApiKey={rxresumeApiKey}
            rxresumeApiKeyHint={rxresumeApiKeyHint}
            rxresumeUrl={rxresumeUrl}
            rxresumeValidation={rxresumeValidation}
            onRxresumeApiKeyChange={onRxresumeApiKeyChange}
            onRxresumeUrlChange={onRxresumeUrlChange}
            onSelfHostedChange={onRxresumeSelfHostedChange}
            onTemplateResumeChange={onTemplateResumeChange}
          />
          <InlineValidation
            state={baseResumeValidation}
            successMessage="CV gốc của bạn đã được tải và sẵn sàng."
          />
        </>
      )}
    </div>
  );
};
