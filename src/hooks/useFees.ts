/**
 * useFees — now only holds the PaymentMethod type.
 *
 * The student Fee Management feature (vouchers, payments, reports) was removed
 * from the admin dashboard.  PaymentMethod is still used by the ADMISSION
 * processing-fee payment accounts, so the type stays here and every existing
 * import of "@/hooks/useFees" keeps working.
 */

export interface PaymentMethod {
  type: "bank" | "easypaisa" | "jazzcash" | "cash" | "other";
  // Bank-specific fields
  bank_name?: string;
  account_title?: string;
  account_number?: string;
  iban?: string;
  // Mobile money fields (EasyPaisa, JazzCash)
  account_name?: string;
  phone?: string;
  // Display label for custom types
  label?: string;
  instructions?: string;
}
