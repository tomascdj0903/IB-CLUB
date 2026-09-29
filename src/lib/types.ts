export type Role = 'tresorier' | 'president' | 'secretaire' | 'lecteur' | 'en_attente';

export interface Profile { id: string; email: string | null; full_name: string | null; role: Role }
export interface FiscalYear { id: string; label: string; start_date: string; end_date: string; closed: boolean }
export interface Account { id: string; number: string; label: string; class: number; active: boolean }
export interface ThirdParty { id: string; name: string; kind: string; email: string | null; notes: string | null }
export interface EventRow { id: string; fiscal_year_id: string; code: string; name: string; event_date: string | null; hosted_by_bde: boolean; notes: string | null }
export interface BudgetLine { id: string; fiscal_year_id: string; event_id: string | null; account_id: string; label: string | null; amount: number; planned_date: string | null }
export interface Settings { association_name: string; rna: string | null; address: string | null; bank_name: string | null; validation_threshold: number; bank_opening_balance: number }

export interface LedgerRow {
  line_id: string; entry_id: string; fiscal_year_id: string; entry_number: number | null;
  journal_code: string; entry_date: string; entry_label: string; piece_ref: string | null; status: string;
  line_label: string | null; account_id: string; account_number: string; account_label: string; class: number;
  debit: number; credit: number; third_party_id: string | null; event_id: string | null; position: number;
}

export interface EntryRow {
  id: string; fiscal_year_id: string; journal_code: string; entry_date: string; label: string;
  piece_ref: string | null; status: 'brouillon' | 'validee'; number: number | null;
  reverses_entry_id: string | null; created_at: string; total: number; docs: number; has_expense: boolean;
}

export interface BankTx { id: string; tx_date: string; label: string; amount: number; matched_line_id: string | null }

export interface Claim {
  id: string; claimant_id: string; claimant_name: string; description: string; amount: number;
  expense_date: string; account_id: string | null; event_id: string | null; document_path: string | null;
  status: 'soumise' | 'validee' | 'refusee' | 'remboursee'; first_validator: string | null;
  refusal_reason: string | null; created_at: string;
}
