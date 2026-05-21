import { parseSearchTermsInput } from "@client/pages/orchestrator/automatic-run";
import { TokenizedInput } from "@client/pages/orchestrator/TokenizedInput";
import type { SearchTermsSuggestionResponse } from "@shared/types";
import { Info, RefreshCcw } from "lucide-react";
import type React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const SearchTermsStep: React.FC<{
  hasSavedSearchTermsInSession: boolean;
  isBusy: boolean;
  isGeneratingSearchTerms: boolean;
  searchTermDraft: string;
  searchTerms: string[];
  searchTermsSource: SearchTermsSuggestionResponse["source"] | null;
  searchTermsStale: boolean;
  onRegenerate: () => Promise<void>;
  onSearchTermDraftChange: (value: string) => void;
  onSearchTermsChange: (values: string[]) => void;
}> = ({
  hasSavedSearchTermsInSession,
  isBusy,
  isGeneratingSearchTerms,
  searchTermDraft,
  searchTerms,
  searchTermsSource,
  searchTermsStale,
  onRegenerate,
  onSearchTermDraftChange,
  onSearchTermsChange,
}) => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/10 p-5">
      <div className="max-w-2xl space-y-1">
        <div className="text-sm font-medium">Chức danh tìm kiếm</div>
        <p className="text-sm leading-6 text-muted-foreground">
          Chọn các chức danh công việc mà JobOps nên tìm kiếm. Danh sách ban đầu
          có thể được tạo từ CV của bạn và bạn có thể chỉnh sửa mọi mục trước
          khi lưu.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={isBusy || isGeneratingSearchTerms}
        onClick={() => void onRegenerate()}
      >
        <RefreshCcw className="h-4 w-4" />
        {isGeneratingSearchTerms ? "Đang tạo..." : "Tạo lại từ CV"}
      </Button>
    </div>

    {searchTermsStale ? (
      <Alert variant="warning">
        <Info className="h-4 w-4" />
        <AlertTitle>CV đã thay đổi</AlertTitle>
        <AlertDescription>
          Nguồn CV của bạn đã thay đổi sau khi các từ khóa tìm kiếm này được tạo
          hoặc lưu. Vui lòng làm mới hoặc chỉnh sửa danh sách, sau đó lưu lại.
        </AlertDescription>
      </Alert>
    ) : searchTermsSource ? (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>
          {searchTermsSource === "ai"
            ? "Được tạo từ CV của bạn"
            : "Được gợi ý từ CV của bạn"}
        </AlertTitle>
        <AlertDescription>
          {searchTermsSource === "ai"
            ? "Các chức danh này được tạo ra từ CV hiện tại của bạn. Hãy điều chỉnh bất kỳ điều gì chưa phù hợp trước khi lưu."
            : "JobOps đã sử dụng một danh sách dự phòng đơn giản dựa trên CV. Bạn có thể chỉnh sửa hoặc tạo lại danh sách này trước khi lưu."}
        </AlertDescription>
      </Alert>
    ) : hasSavedSearchTermsInSession ? (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Từ khóa tìm kiếm đã lưu</AlertTitle>
        <AlertDescription>
          Các chức danh này đã được lưu và sẽ được sử dụng để tìm kiếm công việc
          trừ khi bạn cập nhật chúng.
        </AlertDescription>
      </Alert>
    ) : null}

    <TokenizedInput
      id="onboarding-search-terms"
      values={searchTerms}
      draft={searchTermDraft}
      parseInput={parseSearchTermsInput}
      onDraftChange={onSearchTermDraftChange}
      onValuesChange={onSearchTermsChange}
      placeholder="Nhập vai trò và nhấn Enter"
      helperText="Ví dụ: Platform Engineer, Senior Backend Engineer, Staff Software Engineer"
      removeLabelPrefix="Xóa từ khóa tìm kiếm"
      disabled={isBusy}
    />
  </div>
);
