import type { Transaction } from "../types";

interface CategoryMeta {
  label: string;
  essential: boolean;
}

const mccMap: Record<string, CategoryMeta> = {
  "4111": { label: "Transport", essential: true },
  "4900": { label: "Utilities", essential: true },
  "5411": { label: "Groceries", essential: true },
  "5691": { label: "Retail", essential: false },
  "5812": { label: "Dining", essential: false },
  "6300": { label: "Insurance", essential: true },
  "6513": { label: "Rent", essential: true },
  "6540": { label: "Internal Transfer", essential: false },
  "7832": { label: "Entertainment", essential: false },
  "8011": { label: "Healthcare", essential: true },
  "9001": { label: "Income", essential: false },
};

export const getTransactionCategory = (transaction: Transaction) => {
  return (
    mccMap[transaction.merchant_category_code]?.label ??
    (transaction.type === "credit" ? "Income" : "Other")
  );
};

export const isEssentialTransaction = (transaction: Transaction) => {
  return Boolean(mccMap[transaction.merchant_category_code]?.essential);
};
