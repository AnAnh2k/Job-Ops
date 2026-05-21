import type { StepId, ValidationState } from "./types";

export const EMPTY_VALIDATION_STATE: ValidationState = {
  valid: false,
  message: null,
  checked: false,
  hydrated: false,
};

export const STEP_COPY: Record<
  StepId,
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  llm: {
    eyebrow: "Bước 1",
    title: "Chọn kết nối LLM (AI) cho JobOps.",
    description:
      "Chọn nhà cung cấp, xác nhận endpoint và xác thực thông tin đăng nhập sẽ dùng để chấm điểm và tinh chỉnh CV.",
  },
  baseresume: {
    eyebrow: "Bước 2",
    title: "Nhập CV hiện tại của bạn.",
    description:
      "Chọn cách đưa CV gốc của bạn vào JobOps. Tải lên tệp PDF, DOCX, hoặc JSON từ Reactive Resume để tạo tài liệu Resume Studio cục bộ, hoặc kết nối Reactive Resume bằng khóa API v5 và chọn CV sẵn có.",
  },
  searchterms: {
    eyebrow: "Bước 3",
    title: "Chọn chức danh công việc muốn tìm kiếm.",
    description:
      "Bắt đầu từ các chức danh được đề xuất từ CV của bạn, sau đó chỉnh sửa danh sách để JobOps tìm kiếm chính xác các vai trò bạn mong muốn.",
  },
};
