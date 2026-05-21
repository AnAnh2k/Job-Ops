import { BaseResumeSelection } from "@client/pages/settings/components/BaseResumeSelection";
import { SettingsInput } from "@client/pages/settings/components/SettingsInput";
import type React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { ValidationState } from "../types";
import { InlineValidation } from "./InlineValidation";

export const RxResumeStep: React.FC<{
  baseResumeValue: string | null;
  isBusy: boolean;
  isResumeReady: boolean;
  hasRxResumeAccess: boolean;
  isSelfHosted: boolean;
  rxresumeApiKey: string;
  rxresumeUrl: string;
  rxresumeValidation: ValidationState;
  rxresumeApiKeyHint: string | null | undefined;
  onTemplateResumeChange: (value: string | null) => void;
  onSelfHostedChange: (next: boolean) => void;
  onRxresumeApiKeyChange: (value: string) => void;
  onRxresumeUrlChange: (value: string) => void;
}> = ({
  baseResumeValue,
  hasRxResumeAccess,
  isBusy,
  isResumeReady,
  isSelfHosted,
  onTemplateResumeChange,
  onRxresumeApiKeyChange,
  onRxresumeUrlChange,
  onSelfHostedChange,
  rxresumeApiKey,
  rxresumeApiKeyHint,
  rxresumeUrl,
  rxresumeValidation,
}) => (
  <div className="space-y-6">
    <div className="space-y-5">
      <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
        Sử dụng Reactive Resume nếu CV hiện tại của bạn đã có trên đó. Sau khi
        kết nối, chọn một trong các CV hiện có của bạn để nhập vào JobOps.
      </div>

      <SettingsInput
        label="Khóa API v5"
        inputProps={{
          name: "rxresumeApiKey",
          value: rxresumeApiKey,
          onChange: (event) =>
            onRxresumeApiKeyChange(event.currentTarget.value),
        }}
        type="password"
        placeholder="Nhập khóa API v5"
        helper={
          rxresumeApiKeyHint
            ? "Để trống để giữ lại khóa API v5 đã lưu."
            : undefined
        }
        disabled={isBusy}
      />

      <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
        <label
          htmlFor="rxresume-self-hosted"
          className="flex cursor-pointer items-start gap-3"
        >
          <Checkbox
            id="rxresume-self-hosted"
            checked={isSelfHosted}
            onCheckedChange={(checked) => onSelfHostedChange(Boolean(checked))}
            disabled={isBusy}
          />
          <div className="space-y-1">
            <div className="text-sm font-medium">
              Tự host Reactive Resume (Self-hosted)?
            </div>
            <p className="text-xs text-muted-foreground">
              Bật tùy chọn này nếu bạn tự vận hành một phiên bản Reactive Resume
              riêng và cần sử dụng URL tùy chỉnh.
            </p>
          </div>
        </label>
      </div>

      {isSelfHosted ? (
        <SettingsInput
          label="URL tùy chỉnh"
          inputProps={{
            name: "rxresumeUrl",
            value: rxresumeUrl,
            onChange: (event) => onRxresumeUrlChange(event.currentTarget.value),
          }}
          type="url"
          placeholder="https://resume.example.com"
          helper="Nhập URL gốc cho phiên bản Reactive Resume tự host của bạn."
          disabled={isBusy}
        />
      ) : null}

      {hasRxResumeAccess ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-background/70 p-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">CV mẫu</div>
            <p className="text-xs text-muted-foreground">
              Chọn CV mà JobOps sẽ dùng làm CV gốc để nhập trong bước thiết lập
              này.
            </p>
          </div>
          <BaseResumeSelection
            value={baseResumeValue}
            onValueChange={onTemplateResumeChange}
            hasRxResumeAccess={hasRxResumeAccess}
            disabled={isBusy}
          />
          {isResumeReady ? (
            <div className="text-xs text-muted-foreground">
              Bạn đã có nguồn CV có thể sử dụng, do đó lựa chọn này là không bắt
              buộc.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>

    <InlineValidation
      state={rxresumeValidation}
      successMessage="Đã xác minh kết nối Reactive Resume."
    />
  </div>
);
