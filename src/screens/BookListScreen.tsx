import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Button, Card, Text, TextInput, FAB, Portal, Dialog, IconButton, ActivityIndicator, Avatar } from 'react-native-paper';
import { getSupabase } from '../utils/supabase';
import { Book } from '../types';

interface BookListScreenProps {
  onSelectBook: (book: Book) => void;
  onLogout: () => void;
}

export default function BookListScreen({ onSelectBook, onLogout }: BookListScreenProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [createVisible, setCreateVisible] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  
  const [shareVisible, setShareVisible] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);

  const supabase = getSupabase();

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser({ id: user.id, email: user.email || '' });

      // 1. Fetch books owned by user
      const { data: ownedBooks, error: err1 } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });

      if (err1) throw err1;

      // 2. Fetch books shared with user by email
      const { data: sharedRelations, error: err2 } = await supabase
        .from('book_collaborators')
        .select('book_id, books(*)')
        .eq('user_email', user.email?.toLowerCase());

      if (err2) throw err2;

      const sharedBooks: Book[] = (sharedRelations || [])
        .map((rel: any) => rel.books)
        .filter((b: any) => b !== null);

      // Merge and remove duplicates
      const allBooks = [...(ownedBooks || [])];
      sharedBooks.forEach(sb => {
        if (!allBooks.some(ab => ab.id === sb.id)) {
          allBooks.push(sb);
        }
      });

      setBooks(allBooks);
    } catch (error) {
      console.error('Error fetching books:', error);
      Alert.alert('ભૂલ', 'ખાતા બુક લોડ કરવામાં સમસ્યા આવી.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleCreateBook = async () => {
    if (!newBookName.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('books')
        .insert({
          name: newBookName.trim(),
          created_by: user.id
        });

      if (error) throw error;

      setNewBookName('');
      setCreateVisible(false);
      fetchBooks();
      Alert.alert('સફળતા', 'નવી ખાતા બુક સફળતાપૂર્વક ઉમેરાઈ ગઈ.');
    } catch (error) {
      console.error(error);
      Alert.alert('ભૂલ', 'નવી ખાતા બુક બનાવવામાં સમસ્યા આવી.');
    }
  };

  const handleOpenShare = async (book: Book) => {
    setSelectedBook(book);
    setShareVisible(true);
    setCollaboratorEmail('');
    
    try {
      const { data, error } = await supabase
        .from('book_collaborators')
        .select('*')
        .eq('book_id', book.id);
      if (error) throw error;
      setCollaborators(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedBook || !collaboratorEmail.trim()) return;
    try {
      const email = collaboratorEmail.trim().toLowerCase();
      
      const { error } = await supabase
        .from('book_collaborators')
        .insert({
          book_id: selectedBook.id,
          user_email: email
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('માહિતી', 'આ ભાગીદાર પહેલાથી ઉમેરાયેલ છે.');
        } else {
          throw error;
        }
        return;
      }

      setCollaboratorEmail('');
      Alert.alert('સફળતા', 'ભાગીદાર સફળતાપૂર્વક ઉમેરાઈ ગયા.');
      
      const { data } = await supabase
        .from('book_collaborators')
        .select('*')
        .eq('book_id', selectedBook.id);
      setCollaborators(data || []);
    } catch (error) {
      console.error(error);
      Alert.alert('ભૂલ', 'ભાગીદાર ઉમેરવામાં સમસ્યા આવી.');
    }
  };

  const handleRemoveCollaborator = async (collabId: string) => {
    Alert.alert(
      'ભાગીદાર દૂર કરો',
      'શું તમે ખરેખર આ ભાગીદારને દૂર કરવા માંગો છો?',
      [
        { text: 'ના', style: 'cancel' },
        {
          text: 'હા, દૂર કરો',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('book_collaborators')
                .delete()
                .eq('id', collabId);
              if (error) throw error;
              
              setCollaborators(collaborators.filter(c => c.id !== collabId));
              Alert.alert('સફળતા', 'ભાગીદારને દૂર કરવામાં આવ્યા.');
            } catch (error) {
              console.error(error);
              Alert.alert('ભૂલ', 'ભાગીદારને દૂર કરવામાં સમસ્યા આવી.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteBook = async (bookId: string, bookName: string) => {
    const book = books.find(b => b.id === bookId);
    if (!book || book.created_by !== currentUser?.id) {
      Alert.alert('મંજૂરી નથી', 'તમે ફક્ત તમારા દ્વારા બનાવેલ ખાતા બુક જ ડિલીટ કરી શકો છો.');
      return;
    }

    Alert.alert(
      'ખાતા બુક ડિલીટ કરો',
      `શું તમે ખરેખર "${bookName}" ખાતા બુક ડિલીટ કરવા માંગો છો? આનાથી તેના બધા જ વ્યવહારો અને ખાતાઓ કાયમ માટે નાશ પામશે.`,
      [
        { text: 'ના', style: 'cancel' },
        {
          text: 'હા, ડિલીટ કરો',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('books')
                .delete()
                .eq('id', bookId);
              if (error) throw error;
              fetchBooks();
              Alert.alert('સફળતા', 'ખાતા બુક સફળતાપૂર્વક ડિલીટ કરી દેવામાં આવી.');
            } catch (error) {
              console.error(error);
              Alert.alert('ભૂલ', 'ખાતા બુક ડિલીટ કરવામાં સમસ્યા આવી.');
            }
          }
        }
      ]
    );
  };

  const renderBookItem = ({ item }: { item: Book }) => {
    const isOwner = item.created_by === currentUser?.id;

    return (
      <Card style={styles.bookCard} onPress={() => onSelectBook(item)} mode="outlined">
        <View style={styles.bookCardContent}>
          <Avatar.Icon 
            size={40} 
            icon="notebook" 
            style={[styles.notebookIcon, { backgroundColor: isOwner ? '#e3f2fd' : '#e8f5e9' }]} 
            color={isOwner ? '#1a73e8' : '#2e7d32'}
          />
          <View style={styles.bookDetails}>
            <Text style={styles.bookTitle}>{item.name}</Text>
            <Text style={[styles.bookSubtitle, { color: isOwner ? '#1a73e8' : '#2e7d32' }]}>
              {isOwner ? '👑 તમારા દ્વારા બનાવેલ' : '👥 ભાગીદારી ખાતું'}
            </Text>
          </View>
          <View style={styles.actionRow}>
            {isOwner && (
              <IconButton
                icon="account-multiple-plus-outline"
                iconColor="#1a73e8"
                size={22}
                onPress={() => handleOpenShare(item)}
                style={styles.actionBtn}
              />
            )}
            {isOwner && (
              <IconButton
                icon="trash-can-outline"
                iconColor="#d32f2f"
                size={22}
                onPress={() => handleDeleteBook(item.id, item.name)}
                style={styles.actionBtn}
              />
            )}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* App Bar */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerSubtitle}>ડિજિટલ ચોપડો</Text>
          <Text style={styles.headerTitle}>ખાતા બુકની યાદી</Text>
        </View>
        <IconButton icon="logout" iconColor="#ffffff" size={24} onPress={onLogout} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>ખાતા બુક લોડ થઈ રહી છે...</Text>
        </View>
      ) : books.length === 0 ? (
        <View style={styles.center}>
          <IconButton icon="notebook-edit-outline" size={80} iconColor="#b0bec5" />
          <Text style={styles.noDataText}>કોઈ ખાતા બુક નથી</Text>
          <Text style={styles.noDataSubText}>નવો ચોપડો ખોલવા માટે નીચે આપેલ '+' બટન દબાવો.</Text>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          renderItem={renderBookItem}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        color="#ffffff"
        onPress={() => setCreateVisible(true)}
        label="નવી ખાતા બુક"
      />

      {/* Dialog for Creating New Book */}
      <Portal>
        <Dialog visible={createVisible} onDismiss={() => setCreateVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>નવી ખાતા બુક ખોલો</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="ખાતા બુકનું નામ (ચોપડા નામ)"
              value={newBookName}
              onChangeText={setNewBookName}
              placeholder="દા.ત. ઘર હિસાબ, દુકાન ઉધાર જમા"
              mode="outlined"
              outlineColor="#bdbdbd"
              activeOutlineColor="#1a73e8"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateVisible(false)} textColor="#666">કેન્સલ</Button>
            <Button onPress={handleCreateBook} mode="contained" buttonColor="#1a73e8">બનાવો</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Dialog for Sharing Book / Collaborators */}
      <Portal>
        <Dialog visible={shareVisible} onDismiss={() => setShareVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>ચોપડામાં ભાગીદારી સેટિંગ્સ ({selectedBook?.name})</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.dialogInfo}>
              જો તમે કોઈ બીજા વ્યક્તિ સાથે આ ખાતા બુક વહેંચવા માંગો છો, તો તેમનો રજીસ્ટર્ડ ઇમેઇલ ઉમેરો.
            </Text>
            
            <View style={styles.addCollabRow}>
              <TextInput
                label="ભાગીદારનો ઇમેઇલ"
                value={collaboratorEmail}
                onChangeText={setCollaboratorEmail}
                placeholder="partner@email.com"
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.collabInput}
                outlineColor="#bdbdbd"
                activeOutlineColor="#1a73e8"
                dense
              />
              <Button mode="contained" onPress={handleAddCollaborator} buttonColor="#1a73e8" style={styles.collabAddBtn}>
                ઉમેરો
              </Button>
            </View>

            <Text style={styles.collabListTitle}>હાલના ભાગીદારો:</Text>
            {collaborators.length === 0 ? (
              <Text style={styles.noCollabText}>હજુ સુધી કોઈ ભાગીદાર ઉમેરેલ નથી.</Text>
            ) : (
              <FlatList
                data={collaborators}
                keyExtractor={(item) => item.id}
                style={styles.collabList}
                renderItem={({ item }) => (
                  <View style={styles.collabItem}>
                    <Text style={styles.collabEmail}>{item.user_email}</Text>
                    <IconButton
                      icon="close-circle-outline"
                      iconColor="#d32f2f"
                      size={20}
                      onPress={() => handleRemoveCollaborator(item.id)}
                      style={styles.collabRemoveBtn}
                    />
                  </View>
                )}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShareVisible(false)} textColor="#1a73e8">બંધ કરો</Button>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#e3f2fd',
    opacity: 0.9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 95,
  },
  bookCard: {
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderColor: '#e0e0e0',
  },
  bookCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  notebookIcon: {
    borderRadius: 8,
  },
  bookDetails: {
    flex: 1,
    marginLeft: 12,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  bookSubtitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionBtn: {
    margin: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  noDataText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#90a4ae',
    marginTop: 10,
  },
  noDataSubText: {
    fontSize: 13,
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
  dialogContent: {
    paddingTop: 0,
  },
  dialogInfo: {
    fontSize: 13,
    color: '#7f8c8d',
    lineHeight: 18,
    marginBottom: 14,
  },
  addCollabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  collabInput: {
    flex: 1,
    marginRight: 8,
  },
  collabAddBtn: {
    height: 48,
    justifyContent: 'center',
    borderRadius: 8,
  },
  collabListTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 8,
    marginBottom: 6,
  },
  noCollabText: {
    fontSize: 12,
    color: '#bdc3c7',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  collabList: {
    maxHeight: 150,
  },
  collabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
  },
  collabEmail: {
    fontSize: 14,
    color: '#34495e',
  },
  collabRemoveBtn: {
    margin: 0,
  },
});
