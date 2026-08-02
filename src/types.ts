export interface Book {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface BookCollaborator {
  id: string;
  book_id: string;
  user_email: string;
  created_at: string;
}

export interface Department {
  id: string;
  book_id: string;
  name: string;
  created_at: string;
}

export interface CashbookEntry {
  id: string;
  book_id: string;
  department_id: string | null;
  type: 'in' | 'out'; // 'in' = રોકડ આવી, 'out' = રોકડ ગઈ
  amount: number;
  description: string | null;
  created_by: string | null;
  transaction_date: string;
  departments?: { name: string } | null; // Joined department data
}
