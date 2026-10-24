import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getSupabase } from './supabase';
import { Book, Department, CashbookEntry } from '../types';

const BACKUP_DIR = `${FileSystem.documentDirectory}Backups/`;
const LAST_SLOT1_KEY = 'khatabook_last_backup_slot1';
const LAST_SLOT2_KEY = 'khatabook_last_backup_slot2';

export interface BookBackupPayload {
  version: string;
  app: string;
  timestamp: string;
  slot: string;
  userId: string;
  userEmail: string;
  targetBookId: string;
  targetBookName: string;
  books: Book[];
  departments: Department[];
  cashbook: CashbookEntry[];
  recordCounts: {
    books: number;
    departments: number;
    cashbook: number;
  };
}

// Ensure Backups directory exists
const ensureDirectoryExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
};

// Helper to sanitize book name for filenames
const sanitizeFileName = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9_\u0A80-\u0AFF]/g, '_').substring(0, 30);
};

// Generate Backup JSON Object for a Specific Book
export const generateBookBackupData = async (
  bookId: string, 
  slotLabel: string = 'manual'
): Promise<BookBackupPayload> => {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('વપરાશકર્તા લોગિન નથી.');
  }

  // 1. Fetch specific target book
  const { data: books, error: err1 } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId);

  if (err1 || !books || books.length === 0) {
    throw new Error('ખાતા બુક મળી નથી.');
  }

  const targetBook = books[0];

  // 2. Fetch departments for this book
  const { data: departments, error: err2 } = await supabase
    .from('departments')
    .select('*')
    .eq('book_id', bookId);

  if (err2) throw err2;

  // 3. Fetch cashbook entries for this book
  const { data: cashbook, error: err3 } = await supabase
    .from('cashbook')
    .select('*')
    .eq('book_id', bookId);

  if (err3) throw err3;

  const payload: BookBackupPayload = {
    version: '1.0.0',
    app: 'KhataBook',
    timestamp: new Date().toISOString(),
    slot: slotLabel,
    userId: user.id,
    userEmail: user.email || '',
    targetBookId: targetBook.id,
    targetBookName: targetBook.name,
    books: books || [],
    departments: departments || [],
    cashbook: cashbook || [],
    recordCounts: {
      books: 1,
      departments: (departments || []).length,
      cashbook: (cashbook || []).length,
    },
  };

  return payload;
};

// Save Individual Book Backup JSON file locally
export const saveBookBackupToFile = async (
  bookId: string, 
  bookName: string, 
  slotLabel: string = 'manual'
): Promise<string> => {
  await ensureDirectoryExists();
  const payload = await generateBookBackupData(bookId, slotLabel);
  const jsonContent = JSON.stringify(payload, null, 2);

  const dateStr = new Date().toISOString().split('T')[0];
  const safeName = sanitizeFileName(bookName);
  const fileName = `khatabook_backup_${safeName}_${dateStr}_${slotLabel}.json`;
  const filePath = `${BACKUP_DIR}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, jsonContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return filePath;
};

// Save Separate Individual Backup files for ALL user books
export const saveAllBooksSeparateBackups = async (slotLabel: string = 'manual'): Promise<string[]> => {
  const supabase = getSupabase();
  const { data: books, error } = await supabase.from('books').select('*');
  if (error || !books || books.length === 0) return [];

  const savedPaths: string[] = [];
  for (const book of books) {
    const filePath = await saveBookBackupToFile(book.id, book.name, slotLabel);
    savedPaths.push(filePath);
  }
  return savedPaths;
};

// Auto Backup Check (Runs 2 times a day: Slot 1 ~ 12:00 PM, Slot 2 ~ 08:00 PM - Separate file per book)
export const performAutoBackupCheck = async (): Promise<boolean> => {
  try {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const now = new Date();
    const todayDateStr = now.toDateString();
    const currentHour = now.getHours();

    // Slot 1: Midday (>= 12:00 PM)
    if (currentHour >= 12 && currentHour < 20) {
      const lastSlot1 = await AsyncStorage.getItem(LAST_SLOT1_KEY);
      if (lastSlot1 !== todayDateStr) {
        await saveAllBooksSeparateBackups('slot1_midday');
        await AsyncStorage.setItem(LAST_SLOT1_KEY, todayDateStr);
        console.log('Automated Per-Book Midday (Slot 1) Backups Completed');
        return true;
      }
    }

    // Slot 2: Evening (>= 8:00 PM / 20:00)
    if (currentHour >= 20 || currentHour < 12) {
      const lastSlot2 = await AsyncStorage.getItem(LAST_SLOT2_KEY);
      if (lastSlot2 !== todayDateStr) {
        await saveAllBooksSeparateBackups('slot2_evening');
        await AsyncStorage.setItem(LAST_SLOT2_KEY, todayDateStr);
        console.log('Automated Per-Book Evening (Slot 2) Backups Completed');
        return true;
      }
    }
  } catch (error) {
    console.warn('Auto backup check deferred:', error);
  }
  return false;
};

// List all local backup files in internal storage
export const listLocalBackups = async () => {
  await ensureDirectoryExists();
  const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
  
  const backupList = [];
  for (const fileName of files) {
    if (fileName.endsWith('.json')) {
      const filePath = `${BACKUP_DIR}${fileName}`;
      const info = await FileSystem.getInfoAsync(filePath);
      backupList.push({
        fileName,
        filePath,
        size: info.exists ? info.size : 0,
        modificationTime: info.exists ? info.modificationTime : 0,
      });
    }
  }

  // Sort newest first
  return backupList.sort((a, b) => (b.modificationTime || 0) - (a.modificationTime || 0));
};

// Share or export a backup file
export const shareLocalBackupFile = async (filePath: string) => {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'ખાતા બુક બેકઅપ ફાઇલ શેર કરો',
      UTI: 'public.json',
    });
  } else {
    alert('ફાઇલ શેરિંગ ઉપલબ્ધ નથી.');
  }
};

// Restore from JSON Content & Verification Check
export const restoreFromBackupJSON = async (jsonString: string) => {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('વપરાશકર્તા લોગિન નથી.');
  }

  const payload: BookBackupPayload = JSON.parse(jsonString);

  // Validate JSON Structure
  if (!payload.books || !payload.cashbook || !Array.isArray(payload.books)) {
    throw new Error('અયોગ્ય બેકઅપ ફાઇલ ફોર્મેટ.');
  }

  let restoredBooksCount = 0;
  let restoredDeptsCount = 0;
  let restoredCashbookCount = 0;

  // 1. Upsert Books
  if (payload.books.length > 0) {
    const formattedBooks = payload.books.map(b => ({
      id: b.id,
      name: b.name,
      created_by: user.id, // Assign to restoring user
      created_at: b.created_at || new Date().toISOString(),
    }));
    const { error: err1 } = await supabase.from('books').upsert(formattedBooks);
    if (err1) throw err1;
    restoredBooksCount = formattedBooks.length;
  }

  // 2. Upsert Departments
  if (payload.departments && payload.departments.length > 0) {
    const formattedDepts = payload.departments.map(d => ({
      id: d.id,
      book_id: d.book_id,
      name: d.name,
      created_at: d.created_at || new Date().toISOString(),
    }));
    const { error: err2 } = await supabase.from('departments').upsert(formattedDepts);
    if (err2) throw err2;
    restoredDeptsCount = formattedDepts.length;
  }

  // 3. Upsert Cashbook Transactions
  if (payload.cashbook.length > 0) {
    const formattedCashbook = payload.cashbook.map(c => ({
      id: c.id,
      book_id: c.book_id,
      department_id: c.department_id || null,
      type: c.type,
      amount: Math.round(Number(c.amount) * 100) / 100,
      description: c.description || null,
      created_by: user.id,
      transaction_date: c.transaction_date || new Date().toISOString(),
    }));
    const { error: err3 } = await supabase.from('cashbook').upsert(formattedCashbook);
    if (err3) throw err3;
    restoredCashbookCount = formattedCashbook.length;
  }

  // VERIFICATION CHECK: Query DB to verify restored record counts match exactly for this book
  const targetBookId = payload.targetBookId || payload.books[0]?.id;
  const { data: dbBooks } = await supabase.from('books').select('id').eq('id', targetBookId);
  const { data: dbCashbook } = await supabase.from('cashbook').select('id').eq('book_id', targetBookId);

  const isVerified = 
    (dbBooks || []).length >= 1 &&
    (dbCashbook || []).length >= restoredCashbookCount;

  return {
    verified: isVerified,
    bookName: payload.targetBookName || payload.books[0]?.name || 'ખાતા બુક',
    booksCount: restoredBooksCount,
    departmentsCount: restoredDeptsCount,
    cashbookCount: restoredCashbookCount,
    timestamp: payload.timestamp,
    slot: payload.slot,
  };
};
