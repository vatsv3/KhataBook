import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, Alert, RefreshControl } from 'react-native';
import { Button, Card, Text, TextInput, FAB, Portal, Dialog, IconButton, ActivityIndicator, Avatar } from 'react-native-paper';
import { getSupabase } from '../utils/supabase';
import { Book, Department } from '../types';

interface DepartmentsScreenProps {
  book: Book;
}

export default function DepartmentsScreen({ book }: DepartmentsScreenProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dialog states
  const [createVisible, setCreateVisible] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = getSupabase();

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('book_id', book.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
      Alert.alert('ભૂલ', 'વિભાગો લોડ કરવામાં સમસ્યા આવી.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDepartments();

    // Subscribe to realtime changes
    const subscription = supabase
      .channel('public:departments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments', filter: `book_id=eq.${book.id}` }, () => {
        loadDepartments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [book.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDepartments();
  };

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) {
      Alert.alert('ભૂલ', 'કૃપા કરીને વિભાગનું નામ દાખલ કરો.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('departments')
        .insert({
          book_id: book.id,
          name: newDeptName.trim()
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('ભૂલ', 'આ વિભાગનું નામ પહેલાથી અસ્તિત્વમાં છે.');
        } else {
          throw error;
        }
      } else {
        setNewDeptName('');
        setCreateVisible(false);
        loadDepartments();
        Alert.alert('સફળતા', 'વિભાગ સફળતાપૂર્વક ઉમેરાઈ ગયો.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('ભૂલ', 'વિભાગ બનાવવામાં સમસ્યા આવી.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = (deptId: string, name: string) => {
    Alert.alert(
      'વિભાગ ડિલીટ કરો',
      `શું તમે ખરેખર "${name}" વિભાગ ડિલીટ કરવા માંગો છો? આ વિભાગ હેઠળના વ્યવહારોમાં વિભાગનું નામ નીકળી જશે.`,
      [
        { text: 'ના', style: 'cancel' },
        {
          text: 'હા, ડિલીટ કરો',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('departments')
                .delete()
                .eq('id', deptId);
              if (error) throw error;
              loadDepartments();
              Alert.alert('સફળતા', 'વિભાગ ડિલીટ થઈ ગયો છે.');
            } catch (error) {
              console.error(error);
              Alert.alert('ભૂલ', 'વિભાગ ડિલીટ કરવામાં સમસ્યા આવી.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Department }) => {
    const initial = item.name.charAt(0);
    return (
      <Card style={styles.card} mode="outlined">
        <View style={styles.cardContent}>
          <Avatar.Text 
            size={40} 
            label={initial} 
            style={styles.avatar} 
            labelStyle={styles.avatarLabel} 
          />
          <View style={styles.details}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.subtitle}>વિભાગ આઈડી: ...{item.id.substring(item.id.length - 8)}</Text>
          </View>
          <IconButton 
            icon="trash-can-outline" 
            iconColor="#d32f2f" 
            size={22} 
            onPress={() => handleDeleteDepartment(item.id, item.name)} 
          />
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>વિભાગોનું વ્યવસ્થાપન</Text>
        <Text style={styles.headerSubtitle}>ચોપડો: {book.name}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      ) : departments.length === 0 ? (
        <View style={styles.center}>
          <IconButton icon="domain-plus" size={60} iconColor="#b0bec5" />
          <Text style={styles.noDataText}>કોઈ વિભાગ નથી</Text>
          <Text style={styles.noDataSubText}>નવો વિભાગ ઉમેરવા માટે નીચે આપેલ '+' બટન દબાવો.</Text>
        </View>
      ) : (
        <FlatList
          data={departments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#1a73e8']} />
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        color="#ffffff"
        onPress={() => setCreateVisible(true)}
        label="નવો વિભાગ"
      />

      <Portal>
        <Dialog visible={createVisible} onDismiss={() => !saving && setCreateVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>નવો વિભાગ ઉમેરો</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="વિભાગનું નામ"
              value={newDeptName}
              onChangeText={setNewDeptName}
              placeholder="દા.ત. પગાર, ખરીદી, ઓફિસ ખર્ચ"
              mode="outlined"
              disabled={saving}
              outlineColor="#bdbdbd"
              activeOutlineColor="#1a73e8"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateVisible(false)} disabled={saving} textColor="#666">કેન્સલ</Button>
            <Button 
              onPress={handleCreateDepartment} 
              loading={saving} 
              disabled={saving} 
              mode="contained" 
              buttonColor="#1a73e8"
            >
              ઉમેરો
            </Button>
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
  header: {
    height: 70,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    paddingHorizontal: 16,
    elevation: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#e3f2fd',
    opacity: 0.9,
  },
  list: {
    padding: 16,
    paddingBottom: 90,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderColor: '#e0e0e0',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatar: {
    backgroundColor: '#e3f2fd',
  },
  avatarLabel: {
    color: '#1a73e8',
    fontWeight: 'bold',
  },
  details: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 11,
    color: '#7f8c8d',
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: 16,
    color: '#90a4ae',
    fontWeight: 'bold',
    marginTop: 10,
  },
  noDataSubText: {
    fontSize: 12,
    color: '#b0bec5',
    textAlign: 'center',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a73e8',
  },
  dialog: {
    borderRadius: 16,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
});
