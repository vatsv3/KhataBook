import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, Alert, RefreshControl, ScrollView } from 'react-native';
import { Button, Card, Text, TextInput, Portal, Dialog, IconButton, ActivityIndicator, Chip } from 'react-native-paper';
import { getSupabase } from '../utils/supabase';
import { Book, CashbookEntry, Department } from '../types';
import { generateAndSharePDF } from '../utils/pdf';
import { generateAndShareExcel } from '../utils/excel';

interface CashbookScreenProps {
  book: Book;
}

export default function CashbookScreen({ book }: CashbookScreenProps) {
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Totals
  const [cashInHand, setCashInHand] = useState(0);
  const [todayIn, setTodayIn] = useState(0);
  const [todayOut, setTodayOut] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterDeptId, setSelectedFilterDeptId] = useState<string | null>(null);

  // Entry Dialog States
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashbookEntry | null>(null);
  const [entryType, setEntryType] = useState<'in' | 'out'>('in');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [selectedEntryDept, setSelectedEntryDept] = useState<Department | null>(null);
  
  // Department Picker Dialog State
  const [deptPickerVisible, setDeptPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const supabase = getSupabase();

  const loadData = async () => {
    try {
      // 1. Fetch cashbook entries with joined departments name
      const { data: entriesData, error: entriesError } = await supabase
        .from('cashbook')
        .select('*, departments(name)')
        .eq('book_id', book.id)
        .order('transaction_date', { ascending: false });

      if (entriesError) throw entriesError;
      const items = (entriesData || []) as CashbookEntry[];
      setEntries(items);

      // 2. Fetch departments
      const { data: deptsData, error: deptsError } = await supabase
        .from('departments')
        .select('*')
        .eq('book_id', book.id)
        .order('name', { ascending: true });

      if (deptsError) throw deptsError;
      setDepartments(deptsData || []);

      // Calculations with rounded 2 decimal precision to prevent IEEE 754 floating point artifacts
      let total = 0;
      let inToday = 0;
      let outToday = 0;

      const todayStr = new Date().toDateString();

      items.forEach(item => {
        const amt = Math.round((Number(item.amount) || 0) * 100) / 100;
        const isToday = new Date(item.transaction_date).toDateString() === todayStr;

        if (item.type === 'in') {
          total = Math.round((total + amt) * 100) / 100;
          if (isToday) inToday = Math.round((inToday + amt) * 100) / 100;
        } else {
          total = Math.round((total - amt) * 100) / 100;
          if (isToday) outToday = Math.round((outToday + amt) * 100) / 100;
        }
      });

      setCashInHand(total);
      setTodayIn(inToday);
      setTodayOut(outToday);
    } catch (error) {
      console.error('Error loading cashbook data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to both cashbook and departments changes
    const cashbookSub = supabase
      .channel('public:cashbook')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashbook', filter: `book_id=eq.${book.id}` }, () => {
        loadData();
      })
      .subscribe();

    const deptsSub = supabase
      .channel('public:depts_reload')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments', filter: `book_id=eq.${book.id}` }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(cashbookSub);
      supabase.removeChannel(deptsSub);
    };
  }, [book.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveEntry = async () => {
    const currencyRegex = /^\d+(\.\d{1,2})?$/;
    const cleanAmount = amount.trim();

    if (!cleanAmount || !currencyRegex.test(cleanAmount) || Number(cleanAmount) <= 0) {
      Alert.alert('ભૂલ', 'કૃપા કરીને સાચી રકમ દાખલ કરો (દા.ત. 100 અથવા 100.50).');
      return;
    }

    const amtNum = Math.round(Number(cleanAmount) * 100) / 100;

    let finalDateIso = new Date().toISOString();
    if (transactionDate.trim()) {
      const parsedDate = new Date(transactionDate.trim());
      if (!isNaN(parsedDate.getTime())) {
        finalDateIso = parsedDate.toISOString();
      }
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (editingEntry) {
        // Update existing entry - allows editing every field: amount, type, description, department, date
        const { error } = await supabase
          .from('cashbook')
          .update({
            department_id: selectedEntryDept?.id || null,
            type: entryType,
            amount: amtNum,
            description: description.trim() || null,
            transaction_date: finalDateIso,
          })
          .eq('id', editingEntry.id);

        if (error) throw error;
        Alert.alert('સફળતા', 'વ્યવહાર સફળતાપૂર્વક સુધારી લેવાયો છે (Updated).');
      } else {
        // Insert new entry
        const { error } = await supabase
          .from('cashbook')
          .insert({
            book_id: book.id,
            department_id: selectedEntryDept?.id || null,
            type: entryType,
            amount: amtNum,
            description: description.trim() || null,
            created_by: user?.id || null,
            transaction_date: finalDateIso,
          });

        if (error) throw error;
        Alert.alert('સફળતા', 'કેશબુકમાં વ્યવહાર સેવ થઈ ગયો છે.');
      }

      setEditingEntry(null);
      setAmount('');
      setDescription('');
      setSelectedEntryDept(null);
      setTransactionDate('');
      setDialogVisible(false);
      loadData();
    } catch (error) {
      console.error(error);
      Alert.alert('ભૂલ', 'વ્યવહાર સેવ કરવામાં સમસ્યા આવી.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    Alert.alert(
      'વ્યવહાર કાઢી નાખો',
      'શું તમે ખરેખર આ કેશબુક વ્યવહાર ડિલીટ કરવા માંગો છો?',
      [
        { text: 'ના', style: 'cancel' },
        {
          text: 'હા, કાઢી નાખો',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('cashbook')
                .delete()
                .eq('id', entryId);
              if (error) throw error;
              loadData();
              Alert.alert('સફળતા', 'વ્યવહાર ડિલીટ થઈ ગયો છે.');
            } catch (error) {
              console.error(error);
              Alert.alert('ભૂલ', 'વ્યવહાર ડિલીટ કરવામાં સમસ્યા આવી.');
            }
          }
        }
      ]
    );
  };

  const openAddDialog = (type: 'in' | 'out') => {
    setEditingEntry(null);
    setEntryType(type);
    setAmount('');
    setDescription('');
    setSelectedEntryDept(null);
    setTransactionDate(new Date().toISOString());
    setDialogVisible(true);
  };

  const openEditDialog = (entry: CashbookEntry) => {
    setEditingEntry(entry);
    setEntryType(entry.type);
    setAmount(entry.amount.toString());
    setDescription(entry.description || '');
    setTransactionDate(entry.transaction_date);

    if (entry.department_id) {
      const foundDept = departments.find(d => d.id === entry.department_id);
      setSelectedEntryDept(foundDept || (entry.departments ? { id: entry.department_id, name: entry.departments.name, book_id: entry.book_id, created_at: '' } : null));
    } else {
      setSelectedEntryDept(null);
    }

    setDialogVisible(true);
  };

  const handleExportStatement = () => {
    const selectedDeptName = selectedFilterDeptId 
      ? departments.find(d => d.id === selectedFilterDeptId)?.name || null 
      : null;
    generateAndSharePDF(book.name, filteredEntries, selectedDeptName);
  };

  const handleExportExcel = () => {
    const selectedDeptName = selectedFilterDeptId 
      ? departments.find(d => d.id === selectedFilterDeptId)?.name || null 
      : null;
    generateAndShareExcel(book.name, filteredEntries, selectedDeptName);
  };

  // Filter logic
  const filteredEntries = entries.filter(item => {
    const matchesSearch = 
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.amount.toString().includes(searchQuery);

    const matchesDept = 
      !selectedFilterDeptId || 
      item.department_id === selectedFilterDeptId;

    return matchesSearch && matchesDept;
  });

  const renderEntryItem = ({ item }: { item: CashbookEntry }) => {
    const dateObj = new Date(item.transaction_date);
    const dayNum = String(dateObj.getDate()).padStart(2, '0');
    const monthNum = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yearTwoDigits = String(dateObj.getFullYear()).slice(-2);
    const date = `${dayNum}/${monthNum}/${yearTwoDigits}`;
    const dayName = dateObj.toLocaleDateString('gu-IN', { weekday: 'long' });
    const time = dateObj.toLocaleTimeString('gu-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isIn = item.type === 'in';
    const borderLeftColor = isIn ? '#2e7d32' : '#d32f2f';
    const amtColor = isIn ? '#2e7d32' : '#d32f2f';
    const deptName = item.departments?.name || 'વિભાગ વગર';

    return (
      <Card 
        style={[styles.entryCard, { borderLeftColor }]} 
        mode="contained"
        onPress={() => openEditDialog(item)}
      >
        <View style={styles.entryCardContent}>
          <View style={styles.entryLeft}>
            <Text style={styles.entryDate}>{date} ({dayName})  •  <Text style={styles.entryTime}>{time}</Text></Text>
            <Text style={styles.entryDesc}>{item.description || (isIn ? 'શ્રી ૧|  આવક' : 'જાવક')}</Text>
            <View style={styles.entryDeptRow}>
              <Chip style={styles.entryDeptChip} textStyle={styles.entryDeptChipText} compact>
                {deptName}
              </Chip>
            </View>
          </View>
          <View style={styles.entryRight}>
            <Text style={[styles.entryAmount, { color: amtColor }]}>
              {isIn ? `+ ₹${Math.round(item.amount)}` : `- ₹${Math.round(item.amount)}`}
            </Text>
            <Text style={[styles.entryTypeLabel, { color: amtColor }]}>
              {isIn ? 'શ્રી ૧|  આવક' : 'જાવક'}
            </Text>
          </View>
          <View style={styles.entryActionsRow}>
            <IconButton
              icon="pencil-outline"
              iconColor="#1a73e8"
              size={18}
              onPress={() => openEditDialog(item)}
              style={styles.actionIconBtn}
            />
            <IconButton
              icon="trash-can-outline"
              iconColor="#e57373"
              size={18}
              onPress={() => handleDeleteEntry(item.id)}
              style={styles.actionIconBtn}
            />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Wallet Card Dashboard */}
      <Card style={styles.cashInHandCard} elevation={4}>
        <Card.Content>
          <View style={styles.dashboardHeader}>
            <View>
              <Text style={styles.cashInHandLabel}>ચોપડો: {book.name}</Text>
              <Text style={styles.cashInHandLabel}>હાથ પર સિલક (Cash In Hand)</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <IconButton 
                icon="file-pdf-box" 
                iconColor="#d32f2f" 
                size={26} 
                onPress={handleExportStatement}
                style={styles.pdfIconBtn}
              />
              <IconButton 
                icon="file-excel-box" 
                iconColor="#2e7d32" 
                size={26} 
                onPress={handleExportExcel}
                style={styles.pdfIconBtn}
              />
            </View>
          </View>
          
          <Text style={[
            styles.cashInHandValue, 
            { color: cashInHand >= 0 ? '#2e7d32' : '#d32f2f' }
          ]}>
            ₹{Math.round(cashInHand)}
          </Text>
          <View style={styles.divider} />
          
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>આજની આવક (+)</Text>
              <Text style={[styles.summaryAmount, styles.inText]}>₹{Math.round(todayIn)}</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>આજનો ખર્ચ (-)</Text>
              <Text style={[styles.summaryAmount, styles.outText]}>₹{Math.round(todayOut)}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Horizontal Scrolling Department Filters */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <Chip 
            selected={selectedFilterDeptId === null}
            onPress={() => setSelectedFilterDeptId(null)}
            style={styles.filterChip}
            showSelectedOverlay
          >
            બધા વિભાગો
          </Chip>
          {departments.map((dept) => (
            <Chip
              key={dept.id}
              selected={selectedFilterDeptId === dept.id}
              onPress={() => setSelectedFilterDeptId(dept.id)}
              style={styles.filterChip}
              showSelectedOverlay
            >
              {dept.name}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <TextInput
          placeholder="વ્યવહાર વિગત અથવા રકમ દ્વારા શોધો..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          mode="outlined"
          dense
          left={<TextInput.Icon icon="magnify" color="#1a73e8" />}
          outlineStyle={styles.searchOutline}
          style={styles.searchBar}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      ) : filteredEntries.length === 0 ? (
        <View style={styles.center}>
          <IconButton icon="notebook-outline" size={60} iconColor="#b0bec5" />
          <Text style={styles.noDataText}>કોઈ વ્યવહાર મળ્યા નથી</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntryItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1a73e8']} />
          }
        />
      )}

      {/* Action Buttons (શ્રી ૧|  આવક / જાવક) */}
      <View style={styles.actionButtonsRow}>
        <Button
          mode="contained"
          onPress={() => openAddDialog('in')}
          style={[styles.actionBtn, styles.inBtn]}
          icon="plus-box-outline"
          labelStyle={styles.actionBtnLabel}
        >
          શ્રી ૧|  આવક (+)
        </Button>
        <Button
          mode="contained"
          onPress={() => openAddDialog('out')}
          style={[styles.actionBtn, styles.outBtn]}
          icon="minus-box-outline"
          labelStyle={styles.actionBtnLabel}
        >
          જાવક (-)
        </Button>
      </View>

      {/* Dialog for Adding / Editing Cash Entry */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => !saving && setDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={[styles.dialogTitle, { color: entryType === 'in' ? '#2e7d32' : '#d32f2f' }]}>
            {editingEntry 
              ? (entryType === 'in' ? 'સુધારો: શ્રી ૧|  આવક' : 'સુધારો: જાવક')
              : (entryType === 'in' ? 'શ્રી ૧|  આવક' : 'જાવક')}
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {/* Type selector toggle (allows changing between income and expense) */}
            <View style={styles.dialogTypeToggleRow}>
              <Button
                mode={entryType === 'in' ? 'contained' : 'outlined'}
                onPress={() => setEntryType('in')}
                buttonColor={entryType === 'in' ? '#2e7d32' : undefined}
                textColor={entryType === 'in' ? '#ffffff' : '#2e7d32'}
                style={styles.dialogTypeBtn}
                icon="plus"
                compact
              >
                આવક (+)
              </Button>
              <Button
                mode={entryType === 'out' ? 'contained' : 'outlined'}
                onPress={() => setEntryType('out')}
                buttonColor={entryType === 'out' ? '#d32f2f' : undefined}
                textColor={entryType === 'out' ? '#ffffff' : '#d32f2f'}
                style={styles.dialogTypeBtn}
                icon="minus"
                compact
              >
                જાવક (-)
              </Button>
            </View>

            <TextInput
              label="વ્યવહાર રકમ (₹)"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              mode="outlined"
              keyboardType="numeric"
              style={styles.dialogInput}
              disabled={saving}
              outlineColor="#bdbdbd"
              activeOutlineColor={entryType === 'in' ? '#2e7d32' : '#d32f2f'}
            />
            <TextInput
              label="શેરો (વ્યવહાર વિગત)"
              value={description}
              onChangeText={setDescription}
              placeholder="વિગત લખો (દા.ત. પગાર મળ્યો, ખરીદી કરી...)"
              mode="outlined"
              style={styles.dialogInput}
              disabled={saving}
              outlineColor="#bdbdbd"
              activeOutlineColor={entryType === 'in' ? '#2e7d32' : '#d32f2f'}
            />

            <TextInput
              label="તારીખ અને સમય (ISO/Standard)"
              value={transactionDate}
              onChangeText={setTransactionDate}
              placeholder="YYYY-MM-DDTHH:mm:ss"
              mode="outlined"
              style={styles.dialogInput}
              disabled={saving}
              outlineColor="#bdbdbd"
              activeOutlineColor={entryType === 'in' ? '#2e7d32' : '#d32f2f'}
              right={<TextInput.Icon icon="calendar-clock" />}
            />

            {/* Department Select Trigger */}
            <Text style={styles.deptSelectLabel}>વિભાગ પસંદ કરો (ફરજિયાત નથી):</Text>
            <Button 
              mode="outlined" 
              onPress={() => setDeptPickerVisible(true)}
              disabled={saving}
              textColor="#1a73e8"
              style={styles.deptSelectBtn}
              icon="domain"
            >
              {selectedEntryDept ? selectedEntryDept.name : 'વિભાગ પસંદ કરો (કોઈ નહિ)'}
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)} disabled={saving} textColor="#666">કેન્સલ</Button>
            <Button 
              onPress={handleSaveEntry} 
              loading={saving} 
              disabled={saving}
              mode="contained"
              buttonColor={entryType === 'in' ? '#2e7d32' : '#d32f2f'}
            >
              {editingEntry ? 'અપડેટ કરો' : 'સાચવો'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog for Picking Department */}
      <Portal>
        <Dialog visible={deptPickerVisible} onDismiss={() => setDeptPickerVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>વિભાગ પસંદ કરો</Dialog.Title>
          <Dialog.Content style={styles.pickerDialogContent}>
            <ScrollView style={styles.pickerScroll}>
              <Button 
                mode="text" 
                onPress={() => {
                  setSelectedEntryDept(null);
                  setDeptPickerVisible(false);
                }}
                textColor="#2c3e50"
                style={styles.pickerItem}
                contentStyle={styles.pickerItemContent}
              >
                કોઈ વિભાગ નહિ (વિભાગ વગર)
              </Button>
              {departments.map((dept) => (
                <Button
                  key={dept.id}
                  mode="text"
                  onPress={() => {
                    setSelectedEntryDept(dept);
                    setDeptPickerVisible(false);
                  }}
                  textColor="#1a73e8"
                  style={styles.pickerItem}
                  contentStyle={styles.pickerItemContent}
                  icon="domain"
                >
                  {dept.name}
                </Button>
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeptPickerVisible(false)}>બંધ કરો</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  cashInHandCard: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cashInHandLabel: {
    fontSize: 12,
    color: '#757575',
    fontWeight: 'bold',
  },
  pdfIconBtn: {
    margin: 0,
  },
  cashInHandValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 4,
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 12,
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 35,
    backgroundColor: '#e0e0e0',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  inText: {
    color: '#2e7d32',
  },
  outText: {
    color: '#d32f2f',
  },
  filterSection: {
    marginBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#ffffff',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    backgroundColor: '#ffffff',
  },
  searchOutline: {
    borderRadius: 12,
    borderColor: '#e0e0e0',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  entryCard: {
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderColor: '#e0e0e0',
  },
  entryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingRight: 4,
  },
  entryLeft: {
    flex: 1,
  },
  entryDate: {
    fontSize: 10,
    color: '#7f8c8d',
  },
  entryTime: {
    fontSize: 9,
    color: '#bdc3c7',
  },
  entryDesc: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 4,
  },
  entryDeptRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  entryDeptChip: {
    backgroundColor: '#e8f0fe',
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryDeptChipText: {
    fontSize: 9,
    color: '#1a73e8',
    fontWeight: 'bold',
    marginHorizontal: 4,
    marginVertical: 0,
  },
  entryRight: {
    alignItems: 'flex-end',
    marginRight: 8,
    minWidth: 90,
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  entryTypeLabel: {
    fontSize: 9,
    marginTop: 2,
  },
  entryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBtn: {
    margin: 0,
  },
  deleteIconBtn: {
    margin: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: 15,
    color: '#90a4ae',
    marginTop: 10,
    fontWeight: 'bold',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
  },
  actionBtn: {
    flex: 1,
    marginHorizontal: 6,
    height: 48,
    justifyContent: 'center',
    borderRadius: 12,
  },
  inBtn: {
    backgroundColor: '#2e7d32',
  },
  outBtn: {
    backgroundColor: '#d32f2f',
  },
  actionBtnLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  dialog: {
    borderRadius: 16,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  dialogContent: {
    paddingBottom: 8,
  },
  dialogTypeToggleRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  dialogTypeBtn: {
    flex: 1,
    borderRadius: 8,
  },
  dialogInput: {
    marginBottom: 14,
  },
  deptSelectLabel: {
    fontSize: 12,
    color: '#757575',
    marginTop: 10,
    marginBottom: 6,
    fontWeight: 'bold',
  },
  deptSelectBtn: {
    borderColor: '#bdbdbd',
    borderRadius: 8,
  },
  pickerDialogContent: {
    paddingHorizontal: 10,
  },
  pickerScroll: {
    maxHeight: 250,
  },
  pickerItem: {
    marginVertical: 4,
    borderRadius: 8,
  },
  pickerItemContent: {
    justifyContent: 'flex-start',
    height: 44,
  },
});
