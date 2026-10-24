import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { CashbookEntry } from '../types';

export const generateAndSharePDF = async (
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

    const rowsHtml = sortedEntries.map((entry) => {
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
      const time = dateObj.toLocaleTimeString('gu-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const dept = entry.departments?.name || '-';
      const desc = entry.description || (isIn ? 'શ્રી ૧|  આવક' : 'જાવક');
      const inVal = isIn ? `₹${amt}` : '-';
      const outVal = !isIn ? `₹${amt}` : '-';

      return `
        <tr>
          <td>${formattedDate} (${dayName})<br/><small style="color: #7f8c8d;">${time}</small></td>
          <td>${desc}</td>
          <td><span class="dept-badge">${dept}</span></td>
          <td class="text-right text-success">${inVal}</td>
          <td class="text-right text-danger">${outVal}</td>
          <td class="text-right font-bold">₹${runningBalance}</td>
        </tr>
      `;
    }).join('');

    const filterText = departmentName ? `વિભાગ: ${departmentName}` : 'બધા વિભાગો';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>રોકડમેળ અહેવાલ</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;700&display=swap');
          body {
            font-family: 'Noto Sans Gujarati', sans-serif;
            margin: 20px;
            color: #2c3e50;
          }
          h2 {
            text-align: center;
            color: #1a73e8;
            margin-bottom: 5px;
          }
          .subtitle {
            text-align: center;
            font-size: 13px;
            color: #7f8c8d;
            margin-bottom: 20px;
          }
          .summary-container {
            display: flex;
            justify-content: space-between;
            margin-bottom: 25px;
            gap: 15px;
          }
          .summary-card {
            flex: 1;
            padding: 12px;
            border-radius: 8px;
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            text-align: center;
          }
          .summary-title {
            font-size: 10px;
            color: #757575;
            font-weight: bold;
            margin-bottom: 6px;
            text-transform: uppercase;
          }
          .summary-value {
            font-size: 18px;
            font-weight: bold;
          }
          .text-success { color: #2e7d32; }
          .text-danger { color: #d32f2f; }
          .font-bold { font-weight: bold; }
          .text-right { text-align: right; }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            border: 1px solid #e0e0e0;
            padding: 10px 8px;
            font-size: 12px;
            text-align: left;
          }
          th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #2c3e50;
          }
          tr:nth-child(even) {
            background-color: #fbfbfb;
          }
          .dept-badge {
            background-color: #e8f0fe;
            color: #1a73e8;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #bdc3c7;
            border-top: 1px solid #f1f2f6;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <h2>રોકડમેળ અહેવાલ (Cashbook Statement)</h2>
        <div class="subtitle">ચોપડો: ${bookName} &nbsp;|&nbsp; ફિલ્ટર: ${filterText} &nbsp;|&nbsp; તારીખ: ${new Date().toLocaleDateString('gu-IN')}</div>

        <div class="summary-container">
          <div class="summary-card">
            <div class="summary-title">કુલ આવક (+)</div>
            <div class="summary-value text-success">₹${totalIn}</div>
          </div>
          <div class="summary-card">
            <div class="summary-title">કુલ જાવક (-)</div>
            <div class="summary-value text-danger">₹${totalOut}</div>
          </div>
          <div class="summary-card" style="background-color: #e8f0fe; border-color: #d2e3fc;">
            <div class="summary-title" style="color: #1a73e8;">સિલક (Cash in Hand)</div>
            <div class="summary-value" style="color: #1a73e8;">₹${runningBalance}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 20%">તારીખ / સમય</th>
              <th style="width: 35%">વિગત / શેરો</th>
              <th style="width: 15%">વિભાગ</th>
              <th style="width: 10%; text-align: right;">આવક (+)</th>
              <th style="width: 10%; text-align: right;">જાવક (-)</th>
              <th style="width: 10%; text-align: right;">સિલક</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">કોઈ વ્યવહાર મળ્યા નથી.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          આ અહેવાલ ડિજિટલ ખાતા બુક એપ્લિકેશન દ્વારા જનરેટ કરવામાં આવ્યો છે.
        </div>
      </body>
      </html>
    `;

    const { uri: tempUri, base64 } = await Print.printToFileAsync({
      html: htmlContent,
      base64: true
    });
    
    // Copy the file to the app's cache directory with a friendly file name
    // This resolves the permission error: "Not allowed to read file under given URL"
    const safeFileName = `cashbook_statement_${Date.now()}.pdf`;
    const destinationUri = `${FileSystem.cacheDirectory}${safeFileName}`;
    let shareUri = tempUri;
    try {
      if (base64) {
        await FileSystem.writeAsStringAsync(destinationUri, base64, {
          encoding: 'base64'
        });
        shareUri = destinationUri;
      } else {
        await FileSystem.copyAsync({
          from: tempUri,
          to: destinationUri
        });
        shareUri = destinationUri;
      }
    } catch (copyError) {
      console.warn('FileSystem writing/copying failed, sharing tempUri directly:', copyError);
      shareUri = tempUri;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: `રોકડમેળ અહેવાલ - ${bookName}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      alert('પીડીએફ શેરિંગ ઉપલબ્ધ નથી.');
    }
  } catch (error) {
    console.error('PDF Generation Error:', error);
    alert('પીડીએફ ફાઇલ બનાવવામાં ભૂલ આવી.');
  }
};

