import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { CashbookEntry } from '../types';

export const generateAndShareExcel = async (
  bookName: string,
  entries: CashbookEntry[],
  departmentName: string | null = null
) => {
  try {
    let runningBalance = 0;
    // Sort entries chronologically to compute running balance correctly
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );

    let totalIn = 0;
    let totalOut = 0;

    const filterText = departmentName ? `વિભાગ: ${departmentName}` : 'બધા વિભાગો';
    
    // CSV Header with UTF-8 BOM (\uFEFF) for Excel Gujarati compatibility
    let csvData = '\uFEFF';
    csvData += `રોકડમેળ અહેવાલ (Cashbook Statement)\n`;
    csvData += `ચોપડો: "${bookName}", રીપોર્ટ તારીખ: "${new Date().toLocaleDateString('gu-IN')}", ફિલ્ટર: "${filterText}"\n\n`;

    // Columns Header
    csvData += `"તારીખ (DD/MM/YY)","વાર (Day)","સમય (Time)","વિગત / શેરો","વિભાગ","આવક (+)","જાવક (-)","સિલક (Balance)"\n`;

    sortedEntries.forEach((entry) => {
      const amt = Math.round(Number(entry.amount) || 0);
      const isIn = entry.type === 'in';

      if (isIn) {
        runningBalance = Math.round(runningBalance + amt);
        totalIn = Math.round(totalIn + amt);
      } else {
        runningBalance = Math.round(runningBalance - amt);
        totalOut = Math.round(totalOut + amt);
      }

      const dateObj = new Date(entry.transaction_date);
      const dayNum = String(dateObj.getDate()).padStart(2, '0');
      const monthNum = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yearTwoDigits = String(dateObj.getFullYear()).slice(-2);
      const formattedDate = `${dayNum}/${monthNum}/${yearTwoDigits}`;
      const dayName = dateObj.toLocaleDateString('gu-IN', { weekday: 'long' });
      const timeStr = dateObj.toLocaleTimeString('gu-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const dept = entry.departments?.name || '-';
      const desc = entry.description || (isIn ? 'શ્રી ૧|  આવક' : 'જાવક');
      const inVal = isIn ? amt : 0;
      const outVal = !isIn ? amt : 0;

      csvData += `"${formattedDate}","${dayName}","${timeStr}","${desc.replace(/"/g, '""')}","${dept.replace(/"/g, '""')}",${inVal},${outVal},${runningBalance}\n`;
    });

    // Summary Totals
    csvData += `\n"કુલ આવક (+)",${totalIn}\n`;
    csvData += `"કુલ જાવક (-)",${totalOut}\n`;
    csvData += `"કુલ સિલક (Cash in Hand)",${runningBalance}\n`;

    const safeFileName = `cashbook_statement_${Date.now()}.csv`;
    const destinationUri = `${FileSystem.cacheDirectory}${safeFileName}`;

    await FileSystem.writeAsStringAsync(destinationUri, csvData, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(destinationUri, {
        mimeType: 'text/csv',
        dialogTitle: `એક્સેલ અહેવાલ - ${bookName}`,
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      alert('ફાઇલ શેરિંગ ઉપલબ્ધ નથી.');
    }
  } catch (error) {
    console.error('Excel Generation Error:', error);
    alert('એક્સેલ ફાઇલ બનાવવામાં ભૂલ આવી.');
  }
};
